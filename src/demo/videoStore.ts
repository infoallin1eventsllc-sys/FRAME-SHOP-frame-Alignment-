/**
 * DEMO MODE — where uploaded video files go in the preview.
 *
 * On the live site an uploaded clip goes to the shop's Supabase storage. The
 * preview has no server, so the file is kept in this browser's IndexedDB
 * instead, and played from there. Nothing leaves the device.
 */
const DB = 'frameshop-demo-videos';
const STORE = 'files';
const live = new Map<string, string>(); // key -> object URL for this visit

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

/** The site recognises video files by extension; a blob: link has none, so one rides after the #. */
const withExtension = (url: string, type: string) =>
  `${url}#clip.${/webm/.test(type) ? 'webm' : /quicktime/.test(type) ? 'mov' : /ogg/.test(type) ? 'ogg' : 'mp4'}`;

export async function saveVideo(key: string, file: Blob): Promise<string> {
  try {
    await tx('readwrite', (s) => s.put(file, key));
  } catch {
    /* storage unavailable (private window): it still plays until the page closes */
  }
  const url = withExtension(URL.createObjectURL(file), file.type);
  live.set(key, url);
  return url;
}

/** A playable link for a stored clip, or null if it is no longer in this browser. */
export async function videoUrl(key: string): Promise<string | null> {
  if (live.has(key)) return live.get(key)!;
  try {
    const blob = await tx<Blob | undefined>('readonly', (s) => s.get(key));
    if (!blob) return null;
    const url = withExtension(URL.createObjectURL(blob), blob.type);
    live.set(key, url);
    return url;
  } catch {
    return null;
  }
}

export async function deleteVideo(key: string) {
  live.delete(key);
  try {
    await tx('readwrite', (s) => s.delete(key));
  } catch {
    /* already gone */
  }
}

export async function clearVideos() {
  live.clear();
  try {
    await tx('readwrite', (s) => s.clear());
  } catch {
    /* nothing stored */
  }
}
