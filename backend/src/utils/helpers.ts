import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  calculateDiscountCents,
  applyPercentageDiscount,
  formatCurrency,
  fromCents,
  toCents,
  toDecimalString,
  roundMoney,
} from './money.js';
import { buildPagination } from './pagination.js';
import {
  generateAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  generateOTP,
} from './tokens.js';

export {
  calculateDiscountCents,
  applyPercentageDiscount,
  formatCurrency,
  fromCents,
  toCents,
  toDecimalString,
  roundMoney,
  buildPagination,
  generateAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  generateOTP,
};

/**
 * Human-friendly, collision-resistant order number.
 *
 * `Date.now().toString(36)` + 4 chars of `Math.random()` gave roughly 1.6M
 * combinations per millisecond bucket. Because `orderNumber` is `@unique`, two
 * concurrent checkouts could collide and surface as a raw 500. A CSPRNG widens
 * the space to 2^80 and is still sortable by the leading timestamp.
 */
export function generateOrderNumber(date: Date = new Date()): string {
  const timestamp = date.getTime().toString(36).toUpperCase().padStart(9, '0');
  const random = crypto
    .randomBytes(6)
    .toString('base64url')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .padEnd(6, '0')
    .slice(0, 6);
  return `ORD-${timestamp}-${random}`;
}

/** Internal payment reference (distinct from the customer's gateway TxID). */
export function generateTransactionId(): string {
  return `TRX-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export const BCRYPT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    // A malformed stored hash must not crash the login route.
    return false;
  }
}

/** Legacy alias kept for callers that imported the old helper name. */
export const calculateDiscount = (subtotal: number, discountType: string, discountValue: number): number =>
  fromCents(calculateDiscountCents(toCents(subtotal), discountType, discountValue));

/** Legacy alias for the old percentage-markdown helper. */
export const calculateDiscountedPrice = (price: number, discountPercent: number): number =>
  fromCents(applyPercentageDiscount(toCents(price), discountPercent));

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  [key: string]: unknown;
}

/** Fields that must never leave the API boundary. */
const SENSITIVE_USER_FIELDS = ['passwordHash', 'password', 'resetToken', 'otp'] as const;

/**
 * Strip credentials from a user record.
 *
 * Explicit deny-list plus an allow-list projection for the fields clients
 * actually use, so a future column added to `User` cannot leak by accident.
 */
export function sanitizeUser<T extends Record<string, any>>(user: T): PublicUser {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(user)) {
    if ((SENSITIVE_USER_FIELDS as readonly string[]).includes(key)) continue;
    safe[key] = value;
  }
  return safe as PublicUser;
}

/** Legacy pagination helper — kept for backwards compatibility. */
export const paginateResponse = <T>(data: T[], total: number, page: number, limit: number) => ({
  data,
  pagination: buildPagination(total, page, limit),
});

/** Deterministic, case-insensitive comparison for search keys. */
export function normalizeSearchTerm(term?: string | null): string | undefined {
  if (!term) return undefined;
  const trimmed = term.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
