/**
 * The photos Paul controls: the hero, his portrait, the case-study shots.
 *
 * These live on the server, not in his browser. Held locally they were visible
 * only on the machine that uploaded them — not to customers, not on his phone —
 * while the portal reported them live.
 */
import { safeFetch } from './api';

export interface SiteMedia {
  heroImage?: string;
  paulPhoto?: string;
  galleryPhotos?: Record<string, string>;
}

/** Fired after a save so open sections re-read without a reload. */
export const MEDIA_UPDATED_EVENT = 'site_media_updated';

export async function fetchSiteMedia(): Promise<SiteMedia> {
  try {
    const res = await safeFetch('/api/media');
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export async function saveSiteMedia(media: SiteMedia): Promise<void> {
  const res = await safeFetch('/api/media', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(media),
  });
  if (!res.ok) {
    throw new Error(
      res.status === 413
        ? 'That photo is too large to save. Try a smaller one.'
        : `Could not save (${res.status}).`
    );
  }
  window.dispatchEvent(new CustomEvent(MEDIA_UPDATED_EVENT));
}

/** Subscribe a component to media changes. Returns an unsubscribe function. */
export function onMediaUpdated(handler: () => void): () => void {
  window.addEventListener(MEDIA_UPDATED_EVENT, handler);
  return () => window.removeEventListener(MEDIA_UPDATED_EVENT, handler);
}
