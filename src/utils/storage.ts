/**
 * Thin localStorage wrapper. This app has no backend — everything the
 * shop owner enters lives in the browser's localStorage, namespaced under
 * `frameshop:*` keys. Reads/writes are wrapped in try/catch because
 * localStorage can throw (private browsing, quota exceeded, disabled
 * storage) and a storage hiccup should never crash the app.
 */

const NAMESPACE = 'frameshop';

function key(name: string): string {
  return `${NAMESPACE}:${name}`;
}

export function loadFromStorage<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(name: string, value: T): void {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    // Ignore storage failures (quota exceeded, private mode, etc.) —
    // the app keeps working in-memory for the rest of the session.
  }
}
