/**
 * Turns a pasted video link into something the site can play.
 *
 * Paul adds videos by URL rather than by upload: a phone clip runs from tens to
 * hundreds of megabytes, which browser storage cannot hold and which the shop
 * would have to pay to host and stream. A YouTube or Vimeo link costs nothing,
 * streams at the viewer's bandwidth, and is where his footage already lives.
 */

export type VideoKind = 'youtube' | 'vimeo' | 'file' | 'unknown';

export interface ParsedVideo {
  kind: VideoKind;
  /** Provider id, for youtube and vimeo. */
  id?: string;
  /** Src for the player iframe, or the file itself for direct links. */
  embedUrl?: string;
  /** Poster image, where the provider exposes one by convention. */
  thumbnailUrl?: string;
  originalUrl: string;
}

/** youtu.be/ID, /watch?v=ID, /embed/ID, /shorts/ID, /live/ID */
const YOUTUBE_PATTERNS = [
  /(?:youtube\.com|youtube-nocookie\.com)\/watch\?(?:.*&)?v=([\w-]{11})/i,
  /youtu\.be\/([\w-]{11})/i,
  /(?:youtube\.com|youtube-nocookie\.com)\/embed\/([\w-]{11})/i,
  /(?:youtube\.com|youtube-nocookie\.com)\/shorts\/([\w-]{11})/i,
  /(?:youtube\.com|youtube-nocookie\.com)\/live\/([\w-]{11})/i,
];

const VIMEO_PATTERNS = [
  /player\.vimeo\.com\/video\/(\d+)/i,
  /vimeo\.com\/(?:channels\/[\w]+\/)?(\d+)/i,
];

const FILE_EXTENSIONS = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;

export function parseVideoUrl(rawUrl: string): ParsedVideo {
  const url = (rawUrl || '').trim();
  if (!url) return { kind: 'unknown', originalUrl: rawUrl };

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      const id = match[1];
      return {
        kind: 'youtube',
        id,
        // nocookie so viewers aren't tracked before they press play.
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&autoplay=1`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        originalUrl: url,
      };
    }
  }

  for (const pattern of VIMEO_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      const id = match[1];
      return {
        kind: 'vimeo',
        id,
        embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1`,
        originalUrl: url,
      };
    }
  }

  if (FILE_EXTENSIONS.test(url)) {
    return { kind: 'file', embedUrl: url, originalUrl: url };
  }

  return { kind: 'unknown', originalUrl: url };
}

/** Whether the site can actually play this link. */
export function isPlayable(rawUrl: string): boolean {
  return parseVideoUrl(rawUrl).kind !== 'unknown';
}

/** Shown next to the URL field so Paul knows a link took before he saves it. */
export function describeVideoUrl(rawUrl: string): string {
  const parsed = parseVideoUrl(rawUrl);
  switch (parsed.kind) {
    case 'youtube':
      return 'YouTube video recognised';
    case 'vimeo':
      return 'Vimeo video recognised';
    case 'file':
      return 'Direct video file recognised';
    default:
      return 'Not a video link we can play — use a YouTube or Vimeo link';
  }
}
