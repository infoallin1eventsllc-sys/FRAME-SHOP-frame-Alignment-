/**
 * Checks a chosen video before it is uploaded.
 *
 * The failure this exists to prevent is silent: an iPhone records HEVC by
 * default, Safari plays it back perfectly, and Chrome and Android do not. Paul
 * would publish a clip, watch it play on his own machine, and never know that
 * half his customers saw a dead player. Asking the browser whether it can decode
 * the file is no good either — on his Mac the answer is yes.
 *
 * So the codec is read out of the file itself, which gives the same answer on
 * every device, and it is read before the upload rather than after several
 * minutes of waiting.
 */

export type VideoCodec = 'h264' | 'hevc' | 'unknown';

export interface VideoFileReport {
  codec: VideoCodec;
  bytes: number;
  /** Blocking problem — the upload should not proceed. */
  error?: string;
  /** Worth telling the owner, but not a reason to stop. */
  warning?: string;
}

/** Sample codec tags out of the container header rather than the whole file. */
const HEADER_BYTES = 3 * 1024 * 1024;

function findAscii(haystack: Uint8Array, needle: string): boolean {
  const pattern = new TextEncoder().encode(needle);
  outer: for (let i = 0; i <= haystack.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (haystack[i + j] !== pattern[j]) continue outer;
    }
    return true;
  }
  return false;
}

async function readCodec(file: File): Promise<VideoCodec> {
  try {
    const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
    // MP4/MOV sample description entries name the codec by four-character code.
    if (findAscii(head, 'hvc1') || findAscii(head, 'hev1')) return 'hevc';
    if (findAscii(head, 'avc1') || findAscii(head, 'avc3')) return 'h264';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function formatMb(bytes: number): string {
  return bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(0)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export async function inspectVideoFile(
  file: File,
  maxBytes: number
): Promise<VideoFileReport> {
  const codec = await readCodec(file);
  const report: VideoFileReport = { codec, bytes: file.size };

  if (file.size > maxBytes) {
    report.error =
      `This video is ${formatMb(file.size)}, and the limit is ${formatMb(maxBytes)}.\n\n` +
      `Easiest fix: open it in iMovie, choose Share → Export File → Quality "High", ` +
      `and upload the smaller copy it makes.\n\n` +
      `Or post it to YouTube as Unlisted and paste the link here instead — there is no size limit that way.`;
    return report;
  }

  if (codec === 'hevc') {
    report.error =
      `This is an iPhone video in a format that Apple devices can play but Chrome and Android cannot. ` +
      `If it were published, many customers would see a blank player.\n\n` +
      `Easiest fix: open it in iMovie, choose Share → Export File → Quality "High", ` +
      `and upload the copy it makes — that plays everywhere.\n\n` +
      `Or post it to YouTube as Unlisted from your Photos app and paste the link here instead.`;
    return report;
  }

  if (codec === 'unknown') {
    report.warning =
      'We could not confirm this video plays on every device. Check it on the website after it uploads.';
  }

  return report;
}

/** "road-glide-build.mp4" -> "Road glide build" for the title field. */
export function titleFromFilename(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  if (!stem) return '';
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}
