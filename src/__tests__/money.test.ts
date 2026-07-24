import { describe, it, expect } from 'vitest';
import { toCents, fromCents, sumMoney, addMoney, subtractMoney, multiplyMoney } from '../utils/money';

describe('toCents / fromCents', () => {
  it('round-trips a dollar amount', () => {
    expect(toCents(18.5)).toBe(1850);
    expect(fromCents(1850)).toBe(18.5);
  });
});

describe('addMoney', () => {
  it('avoids the classic 0.1 + 0.2 float bug', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // proves the bug exists in plain JS
    expect(addMoney(0.1, 0.2)).toBe(0.3);
  });
});

describe('sumMoney', () => {
  it('sums a long list of odd cent values exactly', () => {
    const values = Array(20).fill(0.15);
    expect(sumMoney(values)).toBe(3);
  });
});

describe('subtractMoney', () => {
  it('subtracts without drift', () => {
    expect(subtractMoney(10.0, 3.33)).toBe(6.67);
  });
});

describe('multiplyMoney', () => {
  it('multiplies a fractional quantity by a unit price', () => {
    expect(multiplyMoney(2.15, 85.37)).toBeCloseTo(183.55, 2);
  });
  it('handles whole-number labor hours', () => {
    expect(multiplyMoney(8, 125)).toBe(1000);
  });
});
