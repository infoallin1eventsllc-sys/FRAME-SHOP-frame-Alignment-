/**
 * Collision-safe ID generation.
 *
 * IMPORTANT: never derive an ID from `array.length` or a running count.
 * That pattern breaks the moment a record is deleted, because the next
 * "count" reuses an ID that's still referenced elsewhere (e.g. an invoice
 * pointing at a deleted customer's old ID slot gets silently reassigned to
 * a new customer). Every ID here is generated independently of how many
 * records currently exist, so deletions never cause a collision.
 */

function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (very old browsers).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function generateId(prefix: string): string {
  return `${prefix}_${randomToken()}`;
}
