import { describe, expect, it } from 'vitest';
import {
  applyPercentageDiscount,
  calculateDiscountCents,
  computeTotalCents,
  formatCurrency,
  fromCents,
  roundMoney,
  sumLineItems,
  toCents,
  toDecimalString,
} from '../../../src/utils/money.js';

describe('toCents', () => {
  it('converts whole amounts', () => {
    expect(toCents(10)).toBe(1000);
    expect(toCents('10')).toBe(1000);
  });

  it('converts fractional amounts', () => {
    expect(toCents(10.5)).toBe(1050);
    expect(toCents('10.50')).toBe(1050);
    expect(toCents(0.01)).toBe(1);
  });

  it('rounds half-up rather than truncating', () => {
    expect(toCents(10.005)).toBe(1001);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(2.675)).toBe(268);
  });

  it('accepts Prisma Decimal-like objects via toString()', () => {
    const decimal = { toString: () => '1234.56' };
    expect(toCents(decimal)).toBe(123456);
  });

  it('treats empty and invalid input as zero instead of NaN', () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents('')).toBe(0);
    expect(toCents('not-a-number')).toBe(0);
    expect(toCents(Number.NaN)).toBe(0);
  });

  it('handles negative amounts', () => {
    expect(toCents(-5.25)).toBe(-525);
  });
});

describe('fromCents / toDecimalString', () => {
  it('round-trips values', () => {
    expect(fromCents(123456)).toBe(1234.56);
    expect(toDecimalString(123456)).toBe('1234.56');
    expect(toDecimalString(1)).toBe('0.01');
    expect(toDecimalString(0)).toBe('0.00');
  });

  it('rounds sub-cent input before formatting', () => {
    expect(fromCents(100.4)).toBe(1);
    expect(toDecimalString(100.6)).toBe('1.01');
  });
});

describe('roundMoney', () => {
  it('normalises floating point drift to 2 decimals', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(19.999)).toBe(20);
    expect(roundMoney(1234.5678)).toBe(1234.57);
  });
});

describe('sumLineItems', () => {
  it('multiplies unit price by quantity and sums', () => {
    expect(
      sumLineItems([
        { unitPriceCents: 50000, quantity: 2 },
        { unitPriceCents: 12000, quantity: 3 },
      ]),
    ).toBe(136000);
  });

  it('returns zero for an empty basket', () => {
    expect(sumLineItems([])).toBe(0);
  });

  it('never drifts on values that are not exactly representable', () => {
    const items = Array.from({ length: 10 }, () => ({ unitPriceCents: 1005, quantity: 3 }));
    expect(fromCents(sumLineItems(items))).toBe(301.5);
  });
});

describe('calculateDiscountCents', () => {
  it('applies a percentage to the subtotal', () => {
    expect(calculateDiscountCents(100000, 'PERCENTAGE', 10)).toBe(10000);
    expect(calculateDiscountCents(99900, 'PERCENTAGE', 33.33)).toBe(33297);
  });

  it('is case-insensitive about the discount type', () => {
    expect(calculateDiscountCents(100000, 'percentage', 10)).toBe(10000);
  });

  it('treats any non-percentage type as a fixed amount', () => {
    expect(calculateDiscountCents(100000, 'FIXED', 500)).toBe(50000);
  });

  it('caps a percentage at 100', () => {
    expect(calculateDiscountCents(100000, 'PERCENTAGE', 250)).toBe(100000);
  });

  // Regression: a ৳5000 fixed coupon on a ৳100 basket used to produce a
  // negative order total, i.e. the shop would "pay" the customer.
  it('never exceeds the subtotal', () => {
    expect(calculateDiscountCents(10000, 'FIXED', 500000)).toBe(10000);
  });

  it('returns zero for degenerate inputs', () => {
    expect(calculateDiscountCents(0, 'PERCENTAGE', 10)).toBe(0);
    expect(calculateDiscountCents(-500, 'PERCENTAGE', 10)).toBe(0);
    expect(calculateDiscountCents(10000, 'PERCENTAGE', 0)).toBe(0);
    expect(calculateDiscountCents(10000, 'PERCENTAGE', -5)).toBe(0);
    expect(calculateDiscountCents(10000, 'PERCENTAGE', Number.NaN)).toBe(0);
  });
});

describe('applyPercentageDiscount', () => {
  it('reduces a price by a percentage', () => {
    expect(applyPercentageDiscount(10000, 25)).toBe(7500);
    expect(fromCents(applyPercentageDiscount(59900, 10))).toBe(539.1);
  });

  it('clamps the percentage to 0..100', () => {
    expect(applyPercentageDiscount(10000, -20)).toBe(10000);
    expect(applyPercentageDiscount(10000, 200)).toBe(0);
  });
});

describe('computeTotalCents', () => {
  it('subtracts the discount and adds tax', () => {
    expect(computeTotalCents(100000, 10000, 5000)).toBe(95000);
  });

  it('floors the total at zero', () => {
    expect(computeTotalCents(10000, 99999)).toBe(0);
  });

  it('ignores negative discounts and tax', () => {
    expect(computeTotalCents(100000, -5000, -2000)).toBe(100000);
  });
});

describe('formatCurrency', () => {
  it('formats with thousands separators and two decimals', () => {
    expect(formatCurrency(1234.5)).toBe('BDT 1,234.50');
    expect(formatCurrency(0)).toBe('BDT 0.00');
  });

  it('accepts string amounts (as serialised by Prisma Decimal)', () => {
    expect(formatCurrency('2500.00')).toBe('BDT 2,500.00');
  });

  it('honours a custom currency code', () => {
    expect(formatCurrency(10, 'USD')).toBe('USD 10.00');
  });

  it('falls back to zero for unparseable input', () => {
    expect(formatCurrency('abc')).toBe('BDT 0.00');
  });
});
