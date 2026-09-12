import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  createFeedbackSchema,
  createOrderSchema,
  createProductSchema,
  createPromotionSchema,
  listProductsQuerySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  submitPaymentSchema,
  updateOrderStatusSchema,
  updateProductSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from '../../../src/schemas/index.js';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('auth schemas', () => {
  it('accepts a well-formed registration', () => {
    const result = registerSchema.safeParse({
      email: 'Player@GameShop.test',
      password: 'Sup3rSecret',
      fullName: 'Ada Lovelace',
      phone: '01712345678',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Email is normalised so lookups are case-insensitive.
      expect(result.data.email).toBe('player@gameshop.test');
    }
  });

  it('treats an empty phone as "not provided"', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.co',
      password: 'Sup3rSecret',
      fullName: 'A B',
      phone: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBeUndefined();
  });

  it.each([
    ['short password', { password: 'abc1' }],
    ['password without a digit', { password: 'SuperSecret' }],
    ['password without a letter', { password: '12345678' }],
    ['invalid email', { email: 'not-an-email' }],
    ['missing full name', { fullName: undefined }],
    ['one-character name', { fullName: 'A' }],
    ['invalid phone', { phone: '12345' }],
  ])('rejects %s', (_label, overrides) => {
    expect(
      ok(registerSchema, {
        email: 'a@b.co',
        password: 'Sup3rSecret',
        fullName: 'A B',
        ...overrides,
      }),
    ).toBe(false);
  });

  it('login only needs credentials, not password strength', () => {
    // Otherwise a user with a legacy weak password could never log in to change it.
    expect(ok(loginSchema, { email: 'a@b.co', password: '123' })).toBe(true);
    expect(ok(loginSchema, { email: 'a@b.co', password: '' })).toBe(false);
  });

  it('requires a 6 digit OTP', () => {
    expect(ok(verifyOtpSchema, { email: 'a@b.co', otp: '123456' })).toBe(true);
    expect(ok(verifyOtpSchema, { email: 'a@b.co', otp: '12345' })).toBe(false);
    expect(ok(verifyOtpSchema, { email: 'a@b.co', otp: 'abcdef' })).toBe(false);
  });

  // Regression — CRITICAL: `/auth/reset-password` used to accept only
  // { email, password }, so anyone could overwrite any account's password.
  it('requires a reset token to change a password', () => {
    expect(ok(resetPasswordSchema, { email: 'a@b.co', password: 'Sup3rSecret' })).toBe(false);
    expect(
      ok(resetPasswordSchema, { email: 'a@b.co', password: 'Sup3rSecret', token: 'x'.repeat(32) }),
    ).toBe(true);
    expect(
      ok(resetPasswordSchema, { email: 'a@b.co', password: 'Sup3rSecret', token: 'short' }),
    ).toBe(false);
  });

  it('requires the current password for an authenticated change', () => {
    expect(
      ok(changePasswordSchema, { currentPassword: 'old', newPassword: 'Sup3rSecret' }),
    ).toBe(true);
    expect(ok(changePasswordSchema, { newPassword: 'Sup3rSecret' })).toBe(false);
  });

  // Mass assignment. Zod's default object mode *strips* unknown keys, which
  // would silently accept `{ role: 'SUPER_ADMIN' }`; every auth schema is
  // `.strict()` so the client gets an actionable rejection instead.
  it.each([['role'], ['isActive'], ['email'], ['passwordHash'], ['emailVerified']])(
    'profile updates reject an attempt to set %s',
    (field) => {
      const result = updateProfileSchema.safeParse({ fullName: 'New Name', [field]: 'SUPER_ADMIN' });
      expect(result.success).toBe(false);
    },
  );

  it.each([['role'], ['isActive'], ['emailVerified'], ['id'], ['createdBy']])(
    'registration rejects an attempt to set %s',
    (field) => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'Sup3rSecret',
        fullName: 'A B',
        [field]: 'ADMIN',
      });
      expect(result.success).toBe(false);
    },
  );

  it('login rejects unexpected fields', () => {
    expect(ok(loginSchema, { email: 'a@b.com', password: 'Sup3rSecret', isAdmin: true })).toBe(false);
  });

  it('rejects an empty profile patch', () => {
    expect(ok(updateProfileSchema, {})).toBe(false);
  });

  it('validates profile field lengths and URLs', () => {
    expect(ok(updateProfileSchema, { address: 'x'.repeat(600) })).toBe(false);
    expect(ok(updateProfileSchema, { avatarUrl: 'not-a-url' })).toBe(false);
    expect(ok(updateProfileSchema, { preferredPaymentMethod: 'PAYPAL' })).toBe(false);
    expect(ok(updateProfileSchema, { preferredPaymentMethod: 'BKASH' })).toBe(true);
  });
});

describe('order schemas', () => {
  const valid = {
    items: [{ productId: '6f1e2c3d-0000-4000-8000-000000000000', quantity: 2 }],
    deliveryAddress: 'House 12, Road 5, Dhanmondi, Dhaka',
  };

  it('accepts a well-formed order', () => {
    expect(ok(createOrderSchema, valid)).toBe(true);
  });

  // Regression: `items` was completely unvalidated.
  it('rejects an order with no items', () => {
    expect(ok(createOrderSchema, { ...valid, items: [] })).toBe(false);
    expect(ok(createOrderSchema, { deliveryAddress: valid.deliveryAddress })).toBe(false);
  });

  it('rejects a non-positive or fractional quantity', () => {
    const withQty = (quantity: unknown) =>
      ok(createOrderSchema, {
        ...valid,
        items: [{ productId: valid.items[0].productId, quantity }],
      });

    expect(withQty(0)).toBe(false);
    expect(withQty(-5)).toBe(false);
    expect(withQty(1.5)).toBe(false);
    expect(withQty('3')).toBe(true); // coerced from a form/JSON string
    expect(withQty(1000)).toBe(false);
  });

  it('rejects duplicate product lines (a stock-check bypass)', () => {
    const id = valid.items[0].productId;
    expect(
      ok(createOrderSchema, {
        ...valid,
        items: [
          { productId: id, quantity: 1 },
          { productId: id, quantity: 1 },
        ],
      }),
    ).toBe(false);
  });

  it('requires a non-UUID product id to be rejected', () => {
    expect(ok(createOrderSchema, { ...valid, items: [{ productId: 'nope', quantity: 1 }] })).toBe(false);
  });

  it('upper-bounds the basket size', () => {
    const items = Array.from({ length: 51 }, (_, index) => ({
      productId: `6f1e2c3d-0000-4000-8000-${String(index).padStart(12, '0')}`,
      quantity: 1,
    }));
    expect(ok(createOrderSchema, { ...valid, items })).toBe(false);
  });

  it('normalises the promo code to upper case', () => {
    const result = createOrderSchema.safeParse({ ...valid, promoCode: ' welcome10 ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.promoCode).toBe('WELCOME10');
  });

  it('rejects unknown fields so the body cannot smuggle in pricing', () => {
    // `totalAmount` / `subtotal` must always be computed server-side.
    expect(ok(createOrderSchema, { ...valid, totalAmount: 1 })).toBe(false);
    expect(ok(createOrderSchema, { ...valid, userId: 'someone-else' })).toBe(false);
  });

  it('requires a real delivery address', () => {
    expect(ok(createOrderSchema, { ...valid, deliveryAddress: 'short' })).toBe(false);
    expect(ok(createOrderSchema, { ...valid, deliveryAddress: '' })).toBe(false);
  });

  it('constrains payment submission', () => {
    expect(ok(submitPaymentSchema, { transactionId: 'TRX12345', paymentMethod: 'BKASH' })).toBe(true);
    expect(ok(submitPaymentSchema, { transactionId: 'TRX12345', paymentMethod: 'PAYPAL' })).toBe(false);
    expect(ok(submitPaymentSchema, { transactionId: 'a', paymentMethod: 'BKASH' })).toBe(false);
    expect(ok(submitPaymentSchema, { transactionId: 'TRX 123', paymentMethod: 'BKASH' })).toBe(false);
    expect(ok(submitPaymentSchema, { paymentMethod: 'BKASH' })).toBe(false);
  });

  it('only accepts known order statuses', () => {
    expect(ok(updateOrderStatusSchema, { status: 'DELIVERED' })).toBe(true);
    expect(ok(updateOrderStatusSchema, { status: 'REFUNDED' })).toBe(false);
    expect(ok(updateOrderStatusSchema, { status: '"; DROP TABLE orders;--' })).toBe(false);
  });
});

describe('product schemas', () => {
  const valid = { name: 'PUBG 60 UC', category: 'CURRENCY', price: 120 };

  it('accepts a well-formed product', () => {
    expect(ok(createProductSchema, valid)).toBe(true);
  });

  it('defaults stock to unlimited and currency to BDT', () => {
    const result = createProductSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantityAvailable).toBe(-1);
      expect(result.data.currency).toBe('BDT');
    }
  });

  it('rejects unknown categories and game types', () => {
    expect(ok(createProductSchema, { ...valid, category: 'HARDWARE' })).toBe(false);
    expect(ok(createProductSchema, { ...valid, gameType: 'MINECRAFT' })).toBe(false);
    expect(ok(createProductSchema, { ...valid, gameType: 'PUBG' })).toBe(true);
  });

  it('rejects non-positive, oversized and sub-cent prices', () => {
    expect(ok(createProductSchema, { ...valid, price: 0 })).toBe(false);
    expect(ok(createProductSchema, { ...valid, price: -10 })).toBe(false);
    expect(ok(createProductSchema, { ...valid, price: 100_000_000 })).toBe(false);
    expect(ok(createProductSchema, { ...valid, price: 10.005 })).toBe(false);
  });

  it('rejects an implausible stock value', () => {
    expect(ok(createProductSchema, { ...valid, quantityAvailable: -2 })).toBe(false);
    expect(ok(createProductSchema, { ...valid, quantityAvailable: 5_000_000 })).toBe(false);
  });

  it('rejects createdBy / id in the payload (mass assignment)', () => {
    expect(ok(createProductSchema, { ...valid, createdBy: 'attacker' })).toBe(false);
    expect(ok(createProductSchema, { ...valid, id: 'preset-id' })).toBe(false);
  });

  it('allows a partial update but not an empty one', () => {
    expect(ok(updateProductSchema, { price: 99 })).toBe(true);
    expect(ok(updateProductSchema, {})).toBe(false);
  });

  it('validates specification shape', () => {
    expect(ok(createProductSchema, { ...valid, specifications: [{ name: 'Region', value: 'Global' }] })).toBe(true);
    expect(ok(createProductSchema, { ...valid, specifications: [{ name: '' }] })).toBe(false);
  });
});

describe('list products query', () => {
  it('coerces and defaults pagination', () => {
    const result = listProductsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ page: 1, limit: 20, sort: 'newest' });
  });

  it('normalises "ALL" to no filter', () => {
    const result = listProductsQuerySchema.safeParse({ category: 'ALL', gameType: 'all' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBeUndefined();
      expect(result.data.gameType).toBeUndefined();
    }
  });

  it('accepts known sort keys and falls back for unknown ones', () => {
    for (const sort of ['price_asc', 'price_desc', 'newest', 'oldest', 'name_asc', 'name_desc']) {
      const result = listProductsQuerySchema.safeParse({ sort });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.sort).toBe(sort);
    }
    const fallback = listProductsQuerySchema.safeParse({ sort: 'random' });
    expect(fallback.success).toBe(true);
    if (fallback.success) expect(fallback.data.sort).toBe('newest');
  });

  it('rejects a reversed price range', () => {
    expect(ok(listProductsQuerySchema, { minPrice: 500, maxPrice: 100 })).toBe(false);
    expect(ok(listProductsQuerySchema, { minPrice: 100, maxPrice: 500 })).toBe(true);
  });

  it('caps the page size', () => {
    const result = listProductsQuerySchema.safeParse({ limit: '100000' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBeLessThanOrEqual(100);
  });
});

describe('promotion schema', () => {
  const valid = {
    code: 'welcome10',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: '2026-06-01T00:00:00.000Z',
  };

  it('accepts and upper-cases the code', () => {
    const result = createPromotionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBe('WELCOME10');
  });

  it('rejects a percentage above 100', () => {
    expect(ok(createPromotionSchema, { ...valid, discountValue: 150 })).toBe(false);
    expect(ok(createPromotionSchema, { ...valid, discountType: 'FIXED', discountValue: 150 })).toBe(true);
  });

  it('rejects an inverted validity window', () => {
    expect(
      ok(createPromotionSchema, { ...valid, validFrom: valid.validUntil, validUntil: valid.validFrom }),
    ).toBe(false);
  });

  it('rejects a zero or negative discount', () => {
    expect(ok(createPromotionSchema, { ...valid, discountValue: 0 })).toBe(false);
    expect(ok(createPromotionSchema, { ...valid, discountValue: -10 })).toBe(false);
  });

  it('rejects malformed dates and unknown discount types', () => {
    expect(ok(createPromotionSchema, { ...valid, validFrom: 'tomorrow' })).toBe(false);
    expect(ok(createPromotionSchema, { ...valid, discountType: 'BOGUS' })).toBe(false);
  });
});

describe('feedback schema', () => {
  it('accepts a well-formed ticket', () => {
    expect(
      ok(createFeedbackSchema, { subject: 'Order stuck', message: 'My order has not moved in 3 days.' }),
    ).toBe(true);
  });

  it('enforces minimum lengths so tickets are actionable', () => {
    expect(ok(createFeedbackSchema, { subject: 'hi', message: 'x' })).toBe(false);
  });

  it('defaults the category', () => {
    const result = createFeedbackSchema.safeParse({ subject: 'Order stuck', message: 'Something is wrong here.' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.category).toBe('OTHER');
  });
});
