/**
 * Safe money math.
 *
 * Dollar amounts are still stored and passed around as plain numbers
 * (e.g. `18.5` for $18.50) so the rest of the app doesn't have to change
 * shape — but every arithmetic operation here converts to integer cents
 * first, does the math in integers, then converts back. This avoids
 * classic floating point drift like `0.1 + 0.2 !== 0.3`, which compounds
 * badly once you're summing dozens of invoice line items.
 *
 * Rule of thumb: never do `+`, `-`, or `*` directly on dollar amounts
 * anywhere else in the app. Use these helpers instead.
 */

/** Convert a dollar amount to integer cents, rounding to the nearest cent. */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Convert integer cents back to a dollar amount. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Sum a list of dollar amounts using integer-cent arithmetic. */
export function sumMoney(amounts: number[]): number {
  const totalCents = amounts.reduce((sum, dollars) => sum + toCents(dollars), 0);
  return fromCents(totalCents);
}

/** Add two dollar amounts safely. */
export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

/** Subtract b from a safely. */
export function subtractMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/** Multiply a dollar unit price by a (possibly fractional) quantity. */
export function multiplyMoney(quantity: number, unitPriceDollars: number): number {
  return fromCents(Math.round(quantity * toCents(unitPriceDollars)));
}

/** Clamp a dollar amount to a minimum of 0 (e.g. payments can't go negative). */
export function clampMoney(dollars: number, min = 0): number {
  return Math.max(min, dollars);
}
