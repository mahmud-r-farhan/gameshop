/**
 * Money helpers.
 *
 * All monetary values crossing the service layer are handled as **integer
 * cents** internally. Floating point arithmetic on currency silently drifts
 * (`0.1 + 0.2 !== 0.3`), and the database stores `NUMERIC(10,2)`, so cents are
 * the natural unit. Prisma returns `Decimal` columns as `Decimal` objects which
 * serialise to strings, therefore every entry point accepts
 * `number | string | { toString() }`.
 */

/**
 * Anything Prisma may hand back for a `Decimal` column: a JS number, the string
 * form used in JSON responses, or a `Prisma.Decimal` instance (duck-typed so
 * this module stays free of a `@prisma/client` import and remains unit-testable
 * without a generated client).
 */
export type MoneyInput = number | string | { toString(): string } | null | undefined;

/** Maximum value representable by `NUMERIC(10, 2)`. */
export const MAX_DECIMAL_10_2 = 99_999_999_99;

/**
 * Convert a monetary value into integer cents.
 *
 * Rounds half-up so that `10.005` becomes `1001` cents rather than truncating.
 * Invalid or empty input is treated as zero — callers validate presence with
 * Zod before arithmetic happens.
 */
export function toCents(value: MoneyInput): number {
  if (value === null || value === undefined || value === '') return 0;

  const numeric = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isFinite(numeric)) return 0;

  // `Math.round` on a float can still land a hair below the .5 boundary, so
  // nudge with an epsilon scaled to the magnitude before rounding.
  const scaled = numeric * 100;
  const epsilon = Math.sign(scaled) * 1e-6;
  return Math.round(scaled + epsilon);
}

/** Convert integer cents back into a decimal amount. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Format cents as a fixed 2-decimal string suitable for a Prisma `Decimal`
 * write. Using a string avoids re-introducing binary float error on the way
 * back into the database.
 */
export function toDecimalString(cents: number): string {
  return fromCents(cents).toFixed(2);
}

/** Round an arbitrary amount to 2 decimal places, half-up. */
export function roundMoney(value: number): number {
  return fromCents(toCents(value));
}

/** Sum line totals (`unitPriceCents * quantity`). */
export function sumLineItems(
  items: ReadonlyArray<{ unitPriceCents: number; quantity: number }>,
): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}

/**
 * Compute a promotion discount in cents.
 *
 * - `PERCENTAGE` — `value` is a percentage (0–100).
 * - `FIXED`      — `value` is an absolute amount.
 *
 * The result is always clamped to `[0, subtotalCents]`; an order total can
 * never go negative, which previously allowed a ৳5000 fixed coupon to be
 * applied to a ৳100 basket.
 */
export function calculateDiscountCents(
  subtotalCents: number,
  discountType: string,
  discountValue: number,
): number {
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) return 0;
  if (!Number.isFinite(discountValue) || discountValue <= 0) return 0;

  const raw =
    String(discountType).toUpperCase() === 'PERCENTAGE'
      ? Math.round((subtotalCents * Math.min(discountValue, 100)) / 100)
      : toCents(discountValue);

  return Math.max(0, Math.min(raw, subtotalCents));
}

/** Price after a percentage markdown, in cents. */
export function applyPercentageDiscount(priceCents: number, percent: number): number {
  const safePercent = Math.min(Math.max(percent, 0), 100);
  return Math.max(0, Math.round(priceCents - (priceCents * safePercent) / 100));
}

/** `subtotal - discount + tax`, floored at zero. */
export function computeTotalCents(
  subtotalCents: number,
  discountCents: number,
  taxCents = 0,
): number {
  const total = subtotalCents - Math.min(Math.max(discountCents, 0), Math.max(subtotalCents, 0)) + Math.max(taxCents, 0);
  return Math.max(0, total);
}

/** Human readable currency string, e.g. `BDT 1,234.50`. */
export function formatCurrency(amount: number | string, currency = 'BDT'): string {
  const value = typeof amount === 'number' ? amount : Number(String(amount));
  const safe = Number.isFinite(value) ? value : 0;
  return `${currency} ${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
