import { describe, expect, it } from 'vitest';
import {
  calculateDiscount,
  calculateDiscountedPrice,
  comparePassword,
  formatCurrency,
  generateOrderNumber,
  generateTransactionId,
  hashPassword,
  normalizeSearchTerm,
  paginateResponse,
  sanitizeUser,
} from '../../../src/utils/helpers.js';

describe('generateOrderNumber', () => {
  it('matches the documented format', () => {
    expect(generateOrderNumber()).toMatch(/^ORD-[A-Z0-9]{9,}-[A-Z0-9]{6}$/);
  });

  it('is stable for a fixed timestamp except for the random suffix', () => {
    const at = new Date('2026-01-01T00:00:00.000Z');
    const [a, b] = [generateOrderNumber(at), generateOrderNumber(at)];
    expect(a.slice(0, 13)).toBe(b.slice(0, 13));
    expect(a).not.toBe(b);
  });

  // Regression: `Math.random().toString(36).substring(2,6)` gave ~1.6M
  // combinations per millisecond bucket. `orderNumber` is UNIQUE, so two
  // concurrent checkouts could collide and surface as an HTTP 500.
  it('does not collide across a large batch', () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 50_000; i += 1) numbers.add(generateOrderNumber());
    expect(numbers.size).toBe(50_000);
  });

  it('does not collide within the same millisecond', () => {
    const at = new Date();
    const sameTick = new Set(Array.from({ length: 5_000 }, () => generateOrderNumber(at)));
    expect(sameTick.size).toBe(5_000);
  });

  it('sorts chronologically by the timestamp segment', () => {
    const early = generateOrderNumber(new Date('2026-01-01T00:00:00Z'));
    const late = generateOrderNumber(new Date('2027-01-01T00:00:00Z'));
    expect(early.split('-')[1] < late.split('-')[1]).toBe(true);
  });
});

describe('generateTransactionId', () => {
  it('uses the TRX prefix and a hex body', () => {
    expect(generateTransactionId()).toMatch(/^TRX-[0-9A-F]{12}$/);
  });

  it('is unique', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => generateTransactionId()));
    expect(ids.size).toBe(10_000);
  });
});

describe('password hashing', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('Sup3rSecret!');
    expect(hash).not.toBe('Sup3rSecret!');
    expect(hash.startsWith('$2')).toBe(true);
    await expect(comparePassword('Sup3rSecret!', hash)).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('Sup3rSecret!');
    await expect(comparePassword('wrong', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(a).not.toBe(b);
  });

  // Regression: an empty/garbage stored hash threw inside bcrypt.compare and
  // turned a login attempt into a 500.
  it('returns false instead of throwing for a malformed stored hash', async () => {
    await expect(comparePassword('anything', '')).resolves.toBe(false);
    await expect(comparePassword('anything', 'not-a-bcrypt-hash')).resolves.toBe(false);
  });
});

describe('sanitizeUser', () => {
  it('strips the password hash', () => {
    const safe = sanitizeUser({
      id: '1',
      email: 'a@b.c',
      fullName: 'A B',
      role: 'USER',
      passwordHash: '$2a$10$secret',
    });
    expect(safe).not.toHaveProperty('passwordHash');
    expect(safe).toMatchObject({ id: '1', email: 'a@b.c' });
  });

  it('strips every credential-bearing field', () => {
    const safe = sanitizeUser({
      id: '1',
      password: 'x',
      resetToken: 'y',
      otp: '123456',
      passwordHash: 'z',
    });
    expect(Object.keys(safe)).toEqual(['id']);
  });

  it('keeps the profile fields the clients rely on', () => {
    const safe = sanitizeUser({
      id: '1',
      email: 'a@b.c',
      fullName: 'A B',
      role: 'USER',
      phone: '01711111111',
      avatarUrl: null,
      isActive: true,
      notificationPreferences: {},
      passwordHash: 'secret',
    });
    expect(safe).toEqual({
      id: '1',
      email: 'a@b.c',
      fullName: 'A B',
      role: 'USER',
      phone: '01711111111',
      avatarUrl: null,
      isActive: true,
      notificationPreferences: {},
    });
  });
});

describe('legacy numeric helpers', () => {
  it('calculateDiscount handles percentage and fixed', () => {
    expect(calculateDiscount(1000, 'PERCENTAGE', 10)).toBe(100);
    expect(calculateDiscount(1000, 'FIXED', 250)).toBe(250);
  });

  it('calculateDiscount clamps to the subtotal', () => {
    expect(calculateDiscount(100, 'FIXED', 5000)).toBe(100);
  });

  it('calculateDiscountedPrice applies a markdown', () => {
    expect(calculateDiscountedPrice(500, 20)).toBe(400);
    expect(calculateDiscountedPrice(599, 10)).toBeCloseTo(539.1, 2);
  });

  it('formatCurrency renders two decimals', () => {
    expect(formatCurrency(1234.5)).toBe('BDT 1,234.50');
  });
});

describe('normalizeSearchTerm', () => {
  it('trims and passes through real terms', () => {
    expect(normalizeSearchTerm('  pubg  ')).toBe('pubg');
  });

  it('returns undefined for empty or whitespace-only input', () => {
    expect(normalizeSearchTerm('')).toBeUndefined();
    expect(normalizeSearchTerm('   ')).toBeUndefined();
    expect(normalizeSearchTerm(null)).toBeUndefined();
    expect(normalizeSearchTerm(undefined)).toBeUndefined();
  });
});

describe('paginateResponse', () => {
  it('wraps data with pagination metadata', () => {
    const result = paginateResponse([1, 2, 3], 7, 2, 3);
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.pagination).toMatchObject({ currentPage: 2, totalPages: 3, totalItems: 7, itemsPerPage: 3 });
  });
});
