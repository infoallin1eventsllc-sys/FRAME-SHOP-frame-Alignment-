/**
 * Client-side image conditioning for owner-uploaded shop photos.
 *
 * A photo straight off a phone is the wrong shape for the slot it lands in, far
 * larger than the page needs, and soft once it has been scaled down. Everything
 * here runs in the browser on upload: crop to the slot's aspect, step the scale
 * down cleanly, lift contrast/saturation, sharpen, and re-encode small enough to
 * sit in localStorage without tripping the quota.
 */

export interface ProcessOptions {
  /** Target width in px. Never upscales past the source. */
  targetWidth: number;
  /** Target height in px. Together with width this sets the crop aspect. */
  targetHeight: number;
  /** Starting JPEG quality; lowered automatically if the result is too heavy. */
  quality?: number;
  /** 1 = untouched. */
  contrast?: number;
  saturation?: number;
  brightness?: number;
  /** Unsharp-mask strength. 0 disables sharpening. ~0.5 is a natural lift. */
  sharpenAmount?: number;
  /** Unsharp-mask radius in px. */
  sharpenRadius?: number;
  /** Cap on the encoded data-URL length, in characters. */
  maxChars?: number;
  /**
   * How far the source aspect may differ from the slot's before cropping is
   * abandoned. Expressed as a ratio: 1.25 means "crop while the source is
   * within 25% of the slot's shape, otherwise keep the whole frame".
   *
   * Cover-cropping a nearly square photo into a wide banner throws away most of
   * the subject, so past this threshold the image is fitted whole instead and
   * the slot is filled behind it. Omit to always crop.
   */
  maxCropRatio?: number;
}

export interface ProcessResult {
  dataUrl: string;
  width: number;
  height: number;
  /** Approximate encoded size of the result, in bytes. */
  bytes: number;
  originalBytes: number;
  quality: number;
  /** True when the shot was fitted whole rather than cropped into the slot. */
  fittedWhole: boolean;
}

/**
 * localStorage is ~5M UTF-16 chars in most browsers, shared across every key we
 * write. Holding any single photo to ~1.6M chars leaves room for the hero, Paul's
 * portrait, and a full gallery without evicting each other.
 */
const DEFAULT_MAX_CHARS = 1_600_000;

/**
 * Wide landing-page banner. Prefers a 16:9 crop, but a bike shot is usually
 * squarer than that and cropping one to a wide banner cuts the wheels off, so
 * anything past a quarter off the slot's shape is kept whole and the hero fills
 * the rest of the frame behind it.
 */
export const HERO_PRESET: ProcessOptions = {
  targetWidth: 2000,
  targetHeight: 1125,
  quality: 0.86,
  contrast: 1.06,
  saturation: 1.08,
  brightness: 1.02,
  sharpenAmount: 0.55,
  sharpenRadius: 2,
  maxCropRatio: 1.25,
};

/** Portrait card for the "About Paul" section. */
export const PORTRAIT_PRESET: ProcessOptions = {
  targetWidth: 1200,
  targetHeight: 1500,
  quality: 0.88,
  contrast: 1.04,
  saturation: 1.05,
  brightness: 1.02,
  sharpenAmount: 0.45,
  sharpenRadius: 2,
};

/** Case-study gallery tile. */
export const GALLERY_PRESET: ProcessOptions = {
  targetWidth: 1600,
  targetHeight: 1200,
  quality: 0.86,
  contrast: 1.05,
  saturation: 1.06,
  brightness: 1.01,
  sharpenAmount: 0.5,
  sharpenRadius: 2,
};

type Source = ImageBitmap | HTMLImageElement;

function sourceSize(src: Source): { w: number; h: number } {
  return src instanceof HTMLImageElement
    ? { w: src.naturalWidth, h: src.naturalHeight }
    : { w: src.width, h: src.height };
}

/**
 * Decode the file. createImageBitmap is preferred because it applies EXIF
 * orientation, so photos shot in portrait on a phone don't land sideways.
 */
async function loadSource(file: File): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Older Safari rejects the options bag — fall through to <img>.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not read that image file.'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is unavailable in this browser.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

/** Horizontal box blur with a running sum — O(pixels), edges clamped. */
function boxBlurH(data: Uint8ClampedArray, w: number, h: number, r: number) {
  const out = new Uint8ClampedArray(data.length);
  const div = 2 * r + 1;

  for (let y = 0; y < h; y++) {
    const row = y * w * 4;

    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) {
        const xx = x < 0 ? 0 : x >= w ? w - 1 : x;
        sum += data[row + xx * 4 + c];
      }
      for (let x = 0; x < w; x++) {
        out[row + x * 4 + c] = sum / div;
        const outX = x - r < 0 ? 0 : x - r;
        const inX = x + r + 1 >= w ? w - 1 : x + r + 1;
        sum += data[row + inX * 4 + c] - data[row + outX * 4 + c];
      }
    }
    for (let x = 0; x < w; x++) out[row + x * 4 + 3] = data[row + x * 4 + 3];
  }
  data.set(out);
}

/** Vertical counterpart to boxBlurH. Two passes together approximate a gaussian. */
function boxBlurV(data: Uint8ClampedArray, w: number, h: number, r: number) {
  const out = new Uint8ClampedArray(data.length);
  const div = 2 * r + 1;
  const stride = w * 4;

  for (let x = 0; x < w; x++) {
    const col = x * 4;

    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) {
        const yy = y < 0 ? 0 : y >= h ? h - 1 : y;
        sum += data[yy * stride + col + c];
      }
      for (let y = 0; y < h; y++) {
        out[y * stride + col + c] = sum / div;
        const outY = y - r < 0 ? 0 : y - r;
        const inY = y + r + 1 >= h ? h - 1 : y + r + 1;
        sum += data[inY * stride + col + c] - data[outY * stride + col + c];
      }
    }
    for (let y = 0; y < h; y++) out[y * stride + col + 3] = data[y * stride + col + 3];
  }
  data.set(out);
}

/**
 * Unsharp mask: push each pixel away from its blurred neighbourhood, which
 * restores the local contrast that downscaling flattens. Uint8ClampedArray
 * clamps the over/undershoot for us.
 */
function unsharpMask(imageData: ImageData, amount: number, radius: number) {
  const { data, width, height } = imageData;
  const blurred = new Uint8ClampedArray(data);

  boxBlurH(blurred, width, height, radius);
  boxBlurV(blurred, width, height, radius);
  boxBlurH(blurred, width, height, radius);
  boxBlurV(blurred, width, height, radius);

  for (let i = 0; i < data.length; i += 4) {
    data[i] += amount * (data[i] - blurred[i]);
    data[i + 1] += amount * (data[i + 1] - blurred[i + 1]);
    data[i + 2] += amount * (data[i + 2] - blurred[i + 2]);
  }
}

/**
 * Crop, scale, enhance and encode an uploaded photo for one of the shop's image
 * slots. Returns a JPEG data URL ready to hand straight to localStorage.
 */
export async function processImage(
  file: File,
  opts: ProcessOptions
): Promise<ProcessResult> {
  const {
    targetWidth,
    targetHeight,
    quality = 0.86,
    contrast = 1,
    saturation = 1,
    brightness = 1,
    sharpenAmount = 0,
    sharpenRadius = 2,
    maxChars = DEFAULT_MAX_CHARS,
    maxCropRatio,
  } = opts;

  const source = await loadSource(file);
  const { w: srcW, h: srcH } = sourceSize(source);
  if (!srcW || !srcH) throw new Error('That image appears to be empty or corrupt.');

  const targetAspect = targetWidth / targetHeight;
  const srcAspect = srcW / srcH;

  // How different are the two shapes? 1 means identical; 1.9 means the slot is
  // nearly twice as wide, relatively, as the photo.
  const aspectDelta = Math.max(srcAspect / targetAspect, targetAspect / srcAspect);
  const fittedWhole = maxCropRatio != null && aspectDelta > maxCropRatio;

  let cropW: number;
  let cropH: number;
  let cropX: number;
  let cropY: number;
  let outW: number;
  let outH: number;

  if (fittedWhole) {
    // The shapes are too far apart to crop between without gutting the subject.
    // Keep every pixel and just bound the size; the slot fills in behind it.
    cropW = srcW;
    cropH = srcH;
    cropX = 0;
    cropY = 0;
    const scale = Math.min(1, targetWidth / srcW, targetHeight / srcH);
    outW = Math.max(1, Math.round(srcW * scale));
    outH = Math.max(1, Math.round(srcH * scale));
  } else {
    // Close enough to crop: centre-cover to the slot's aspect, done up front so
    // no pixels are carried through the scale that would be cropped away later.
    if (srcAspect > targetAspect) {
      cropH = srcH;
      cropW = srcH * targetAspect;
    } else {
      cropW = srcW;
      cropH = srcW / targetAspect;
    }
    cropX = (srcW - cropW) / 2;
    cropY = (srcH - cropH) / 2;

    // Never upscale — a small source stays its own size, just correctly shaped.
    const scale = Math.min(1, targetWidth / cropW);
    outW = Math.max(1, Math.round(cropW * scale));
    outH = Math.max(1, Math.round(cropH * scale));
  }

  // Step the size down by halves. One big drawImage to the final size aliases
  // badly on large photos; halving repeatedly keeps the detail intact.
  let workW = Math.round(cropW);
  let workH = Math.round(cropH);
  let work = makeCanvas(workW, workH);
  work.ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, workW, workH);

  while (workW >= outW * 2 && workH >= outH * 2 && workW > 1 && workH > 1) {
    const nextW = Math.max(outW, Math.round(workW / 2));
    const nextH = Math.max(outH, Math.round(workH / 2));
    const next = makeCanvas(nextW, nextH);
    next.ctx.drawImage(work.canvas, 0, 0, workW, workH, 0, 0, nextW, nextH);
    work = next;
    workW = nextW;
    workH = nextH;
  }

  const out = makeCanvas(outW, outH);
  out.ctx.filter = `contrast(${contrast}) saturate(${saturation}) brightness(${brightness})`;
  out.ctx.drawImage(work.canvas, 0, 0, workW, workH, 0, 0, outW, outH);
  out.ctx.filter = 'none';

  if (sharpenAmount > 0) {
    const imageData = out.ctx.getImageData(0, 0, outW, outH);
    unsharpMask(imageData, sharpenAmount, sharpenRadius);
    out.ctx.putImageData(imageData, 0, 0);
  }

  if (source instanceof ImageBitmap) source.close();

  // Back off the quality until it fits the storage budget.
  let q = quality;
  let dataUrl = out.canvas.toDataURL('image/jpeg', q);
  while (dataUrl.length > maxChars && q > 0.5) {
    q = Math.max(0.5, q - 0.08);
    dataUrl = out.canvas.toDataURL('image/jpeg', q);
  }

  return {
    dataUrl,
    width: outW,
    height: outH,
    bytes: Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75),
    originalBytes: file.size,
    quality: q,
    fittedWhole,
  };
}

/** "4.2 MB", "812 KB" — for the confirmation line after an upload. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
