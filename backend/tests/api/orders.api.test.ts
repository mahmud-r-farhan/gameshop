import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', async () => {
  const { prismaMock } = await import('../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { api, resetDb, model, UUID, asUser, asAdmin, USER, ADMIN } = await import('./helpers.js');
const { prismaMock } = await import('../helpers/prisma-mock.js');

/**
 * HTTP-level coverage for `/api/v1/orders` and `/api/v1/payments`.
 *
 * The interesting failures here are authorisation ones: whose order is this, who
 * may move its state, and whether a customer can influence money.
 */

const ADDRESS = 'House 12, Road 5, Dhanmondi, Dhaka 1209';
const TRANSACTION_ID = 'TRX-8899';

const purchasableProduct = {
  id: UUID.product,
  name: 'PUBG 60 UC',
  price: '120.00',
  isAvailable: true,
  quantityAvailable: -1,
};

function storedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID.order,
    orderNumber: 'ORD-20260912-000001',
    userId: UUID.user,
    subtotal: '360.00',
    discountAmount: '0.00',
    taxAmount: '0.00',
    totalAmount: '360.00',
    paymentStatus: 'PENDING',
    orderStatus: 'PENDING',
    deliveryStatus: 'WAITING',
    deliveryAddress: ADDRESS,
    transactionId: null,
    promoId: null,
    items: [],
    payments: [],
    statusHistory: [],
    ...overrides,
  };
}

beforeEach(() => {
  resetDb();
});

describe('authentication', () => {
  it('401s every order route for an anonymous caller', async () => {
    expect((await api().get('/api/v1/orders')).status).toBe(401);
    expect((await api().post('/api/v1/orders').send({})).status).toBe(401);
    expect((await api().get(`/api/v1/orders/${UUID.order}`)).status).toBe(401);
    expect((await api().get('/api/v1/orders/admin/all')).status).toBe(401);
    expect((await api().post(`/api/v1/orders/${UUID.order}/submit-payment`).send({})).status).toBe(401);
    expect((await api().post(`/api/v1/orders/${UUID.order}/cancel`)).status).toBe(401);
    expect((await api().patch(`/api/v1/orders/${UUID.order}/status`).send({})).status).toBe(401);
    expect((await api().patch(`/api/v1/orders/${UUID.order}/verify-payment`).send({})).status).toBe(401);
    expect((await api().patch(`/api/v1/orders/${UUID.order}/reject-payment`).send({})).status).toBe(401);
  });

  it('never reaches the database when the token is missing', async () => {
    await api().get('/api/v1/orders');
    expect(model('order').findMany).not.toHaveBeenCalled();
  });
});

describe('POST /orders', () => {
  beforeEach(() => {
    model('product').findMany.mockResolvedValue([purchasableProduct]);
    model('order').create.mockResolvedValue(storedOrder());
  });

  it('creates an order priced from the server-side catalogue', async () => {
    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({ items: [{ productId: UUID.product, quantity: 3 }], deliveryAddress: ADDRESS });

    expect(response.status).toBe(201);
    const data = model('order').create.mock.calls[0][0].data;
    expect(data.subtotal).toBe('360.00');
    expect(data.totalAmount).toBe('360.00');
    expect(data.userId).toBe(UUID.user);
  });

  /**
   * Regression: the body was entirely unvalidated, so `items: []` crashed the
   * service and `quantity: -5` produced a negative total — an order the shop
   * would have "paid" the customer for.
   */
  it('rejects an empty basket', async () => {
    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({ items: [], deliveryAddress: ADDRESS });

    expect(response.status).toBe(400);
    expect(model('order').create).not.toHaveBeenCalled();
  });

  it.each([[0], [-5], [1.5], ['abc']])(
    'rejects a non-positive or fractional quantity (%s)',
    async (quantity) => {
      const response = await api()
        .post('/api/v1/orders')
        .set(asUser())
        .send({ items: [{ productId: UUID.product, quantity }], deliveryAddress: ADDRESS });

      expect(response.status).toBe(400);
      expect(model('order').create).not.toHaveBeenCalled();
    },
  );

  it('rejects a quantity above the per-line ceiling', async () => {
    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({ items: [{ productId: UUID.product, quantity: 1000 }], deliveryAddress: ADDRESS });

    expect(response.status).toBe(400);
  });

  it('rejects a delivery address too short to deliver to', async () => {
    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({ items: [{ productId: UUID.product, quantity: 1 }], deliveryAddress: 'here' });

    expect(response.status).toBe(400);
  });

  // Splitting one large quantity across two lines would defeat the stock check.
  it('rejects the same product on two lines', async () => {
    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({
        items: [
          { productId: UUID.product, quantity: 1 },
          { productId: UUID.product, quantity: 1 },
        ],
        deliveryAddress: ADDRESS,
      });

    expect(response.status).toBe(400);
    expect(response.body.errors[0]).toMatchObject({
      field: 'items',
      message: expect.stringMatching(/duplicate products/i),
    });
  });

  it('rejects a client-supplied unit price', async () => {
    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({
        items: [{ productId: UUID.product, quantity: 1, price: 1 }],
        deliveryAddress: ADDRESS,
      });

    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('items.0.price');
  });

  it('rejects a client-supplied order total', async () => {
    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({
        items: [{ productId: UUID.product, quantity: 1 }],
        deliveryAddress: ADDRESS,
        totalAmount: 1,
      });

    expect(response.status).toBe(400);
  });

  it('404s when a product in the basket does not exist', async () => {
    model('product').findMany.mockResolvedValue([]);

    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({ items: [{ productId: UUID.product, quantity: 1 }], deliveryAddress: ADDRESS });

    expect(response.status).toBe(404);
  });

  // The decrement is guarded by `quantityAvailable >= requested`, so Postgres
  // re-checks the predicate under the row lock: two concurrent checkouts can
  // never both get past the last unit.
  it('409s when the basket exceeds available stock', async () => {
    model('product').findMany.mockResolvedValue([{ ...purchasableProduct, quantityAvailable: 2 }]);
    model('product').updateMany.mockResolvedValue({ count: 0 });

    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({ items: [{ productId: UUID.product, quantity: 3 }], deliveryAddress: ADDRESS });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/insufficient stock/i);
    expect(model('order').create).not.toHaveBeenCalled();
  });

  it('decrements stock through a guarded update, not a read-then-write', async () => {
    model('product').findMany.mockResolvedValue([{ ...purchasableProduct, quantityAvailable: 5 }]);
    model('product').updateMany.mockResolvedValue({ count: 1 });

    await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({ items: [{ productId: UUID.product, quantity: 2 }], deliveryAddress: ADDRESS });

    expect(model('product').updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: UUID.product, isAvailable: true, quantityAvailable: { gte: 2 } },
      data: { quantityAvailable: { decrement: 2 } },
    });
  });

  it('does not touch stock for an unlimited product', async () => {
    await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({ items: [{ productId: UUID.product, quantity: 2 }], deliveryAddress: ADDRESS });

    expect(model('product').updateMany).not.toHaveBeenCalled();
  });

  it('409s for a product that has been made unavailable', async () => {
    model('product').findMany.mockResolvedValue([{ ...purchasableProduct, isAvailable: false }]);

    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({ items: [{ productId: UUID.product, quantity: 1 }], deliveryAddress: ADDRESS });

    expect(response.status).toBe(409);
  });

  it('normalises the promo code to upper case before looking it up', async () => {
    await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({
        items: [{ productId: UUID.product, quantity: 1 }],
        deliveryAddress: ADDRESS,
        promoCode: 'welcome10',
      });

    expect(model('promotion').findUnique.mock.calls[0][0].where.code).toBe('WELCOME10');
  });

  it('400s for an unknown promo code rather than silently charging full price', async () => {
    model('promotion').findUnique.mockResolvedValue(null);

    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({
        items: [{ productId: UUID.product, quantity: 1 }],
        deliveryAddress: ADDRESS,
        promoCode: 'NOPE1',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid promo code/i);
    expect(model('order').create).not.toHaveBeenCalled();
  });

  it('400s for an expired promo code', async () => {
    model('promotion').findUnique.mockResolvedValue({
      id: UUID.promo,
      code: 'WELCOME10',
      isActive: true,
      discountType: 'PERCENTAGE',
      discountValue: '10.00',
      validFrom: new Date('2020-01-01T00:00:00.000Z'),
      validUntil: new Date('2020-02-01T00:00:00.000Z'),
      maxUsage: null,
      usedCount: 0,
      minPurchaseAmount: null,
      applicableProducts: [],
    });

    const response = await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({
        items: [{ productId: UUID.product, quantity: 1 }],
        deliveryAddress: ADDRESS,
        promoCode: 'WELCOME10',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/expired/i);
  });

  it('writes the order, its line items and the opening status entry in one call', async () => {
    await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({ items: [{ productId: UUID.product, quantity: 1 }], deliveryAddress: ADDRESS });

    const data = model('order').create.mock.calls[0][0].data;
    expect(data.items.create).toHaveLength(1);
    expect(data.statusHistory.create).toMatchObject({ newStatus: 'PENDING' });
  });

  it('generates a server-side order number', async () => {
    await api()
      .post('/api/v1/orders')
      .set(asUser())
      .send({ items: [{ productId: UUID.product, quantity: 1 }], deliveryAddress: ADDRESS });

    expect(model('order').create.mock.calls[0][0].data.orderNumber).toMatch(/^ORD-/);
  });
});

describe('GET /orders', () => {
  beforeEach(() => {
    model('order').findMany.mockResolvedValue([]);
    model('order').count.mockResolvedValue(0);
  });

  it('scopes the list to the caller', async () => {
    await api().get('/api/v1/orders').set(asUser());
    expect(model('order').findMany.mock.calls[0][0].where).toEqual({ userId: UUID.user });
  });

  it('survives hostile pagination', async () => {
    const response = await api().get('/api/v1/orders?page=abc&limit=-3').set(asUser());

    expect(response.status).toBe(200);
    // `paginationQuerySchema` `.catch()`es invalid input to the defaults, so a
    // garbage query string can never reach Prisma as NaN.
    expect(model('order').findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 20 });
  });
});

describe('GET /orders/:id', () => {
  /**
   * Regression: the handler always filtered by `req.user.id`, so the admin
   * console's order-detail view 404'd on every order that was not the
   * administrator's own.
   */
  it('lets an admin read any order', async () => {
    model('order').findFirst.mockResolvedValue(storedOrder());

    const response = await api().get(`/api/v1/orders/${UUID.order}`).set(asAdmin());

    expect(response.status).toBe(200);
    expect(model('order').findFirst.mock.calls[0][0].where).toEqual({ id: UUID.order });
  });

  it('includes customer contact details for an admin but not for the owner', async () => {
    model('order').findFirst.mockResolvedValue(storedOrder());

    await api().get(`/api/v1/orders/${UUID.order}`).set(asAdmin());
    expect(model('order').findFirst.mock.calls[0][0].include.user).toMatchObject({
      select: { email: true, phone: true },
    });

    await api().get(`/api/v1/orders/${UUID.order}`).set(asUser());
    expect(model('order').findFirst.mock.calls[1][0].include.user).toBe(false);
  });

  it('scopes the lookup to the owner for a customer', async () => {
    model('order').findFirst.mockResolvedValue(storedOrder());

    await api().get(`/api/v1/orders/${UUID.order}`).set(asUser());

    expect(model('order').findFirst.mock.calls[0][0].where).toEqual({
      id: UUID.order,
      userId: UUID.user,
    });
  });

  // Scoping happens in the WHERE clause, so another customer's order is simply
  // "not found" — which also avoids confirming that the order id exists.
  it('404s when a customer asks for somebody else\'s order', async () => {
    model('order').findFirst.mockResolvedValue(null);

    const response = await api().get(`/api/v1/orders/${UUID.order}`).set(asUser());

    expect(response.status).toBe(404);
    expect(response.body.error).not.toMatch(/permission/i);
  });

  it('400s on a malformed id', async () => {
    const response = await api().get('/api/v1/orders/abc').set(asUser());
    expect(response.status).toBe(400);
    expect(model('order').findFirst).not.toHaveBeenCalled();
  });
});

describe('GET /orders/admin/all', () => {
  beforeEach(() => {
    model('order').findMany.mockResolvedValue([]);
    model('order').count.mockResolvedValue(0);
  });

  it('is admin-only', async () => {
    expect((await api().get('/api/v1/orders/admin/all').set(asUser())).status).toBe(403);
    expect(model('order').findMany).not.toHaveBeenCalled();
  });

  it('is not shadowed by the /:id route', async () => {
    const response = await api().get('/api/v1/orders/admin/all').set(asAdmin());
    // `/:id` would have rejected "admin" as a malformed UUID and returned 400.
    expect(response.status).toBe(200);
  });

  it('filters by status, normalising case from the query string', async () => {
    await api().get('/api/v1/orders/admin/all?status=delivered').set(asAdmin());
    expect(model('order').findMany.mock.calls[0][0].where).toMatchObject({ orderStatus: 'DELIVERED' });
  });

  it('400s on an unknown status', async () => {
    const response = await api().get('/api/v1/orders/admin/all?status=SHIPPED_TO_MOON').set(asAdmin());
    expect(response.status).toBe(400);
  });

  it('searches order number, transaction id and customer', async () => {
    await api().get('/api/v1/orders/admin/all?search=ORD-2026').set(asAdmin());
    const or = model('order').findMany.mock.calls[0][0].where.OR;
    expect(or).toEqual(
      expect.arrayContaining([
        { orderNumber: { contains: 'ORD-2026', mode: 'insensitive' } },
        { transactionId: { contains: 'ORD-2026', mode: 'insensitive' } },
      ]),
    );
  });
});

describe('POST /orders/:id/submit-payment', () => {
  const payload = { transactionId: TRANSACTION_ID, paymentMethod: 'BKASH' };

  beforeEach(() => {
    model('order').findFirst.mockResolvedValue(storedOrder());
    model('payment').findFirst.mockResolvedValue(null);
    model('payment').create.mockResolvedValue({ id: 'pay-1', transactionId: TRANSACTION_ID });
    model('order').update.mockResolvedValue(storedOrder({ paymentStatus: 'PENDING_VERIFICATION' }));
  });

  it('records the payment for the owner', async () => {
    const response = await api()
      .post(`/api/v1/orders/${UUID.order}/submit-payment`)
      .set(asUser())
      .send(payload);

    expect(response.status).toBe(201);
    expect(model('payment').create.mock.calls[0][0].data).toMatchObject({
      orderId: UUID.order,
      userId: UUID.user,
      transactionId: TRANSACTION_ID,
      paymentMethod: 'BKASH',
    });
  });

  it('records the order total, never a client-chosen amount', async () => {
    await api().post(`/api/v1/orders/${UUID.order}/submit-payment`).set(asUser()).send(payload);
    expect(model('payment').create.mock.calls[0][0].data.amount).toBe('360.00');
  });

  it('400s when a declared amount does not match the order total', async () => {
    const response = await api()
      .post(`/api/v1/orders/${UUID.order}/submit-payment`)
      .set(asUser())
      .send({ ...payload, amount: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/does not match the order total/);
    expect(model('payment').create).not.toHaveBeenCalled();
  });

  it('404s when the order belongs to somebody else', async () => {
    model('order').findFirst.mockResolvedValue(null);

    const response = await api()
      .post(`/api/v1/orders/${UUID.order}/submit-payment`)
      .set(asUser())
      .send(payload);

    expect(response.status).toBe(404);
    expect(model('payment').create).not.toHaveBeenCalled();
  });

  it('400s for a payment method outside the supported set', async () => {
    const response = await api()
      .post(`/api/v1/orders/${UUID.order}/submit-payment`)
      .set(asUser())
      .send({ transactionId: 'TRX-1', paymentMethod: 'PAYPAL' });

    expect(response.status).toBe(400);
  });

  it('400s for a transaction id containing shell metacharacters', async () => {
    const response = await api()
      .post(`/api/v1/orders/${UUID.order}/submit-payment`)
      .set(asUser())
      .send({ transactionId: 'TRX;rm -rf /', paymentMethod: 'BKASH' });

    expect(response.status).toBe(400);
  });

  // `Payment.transactionId` is `@unique`, so a reused gateway reference used to
  // surface as a raw P2002 / HTTP 500.
  it('409s when the transaction id was already submitted', async () => {
    model('payment').findFirst.mockResolvedValue({ id: 'existing' });

    const response = await api()
      .post(`/api/v1/orders/${UUID.order}/submit-payment`)
      .set(asUser())
      .send(payload);

    expect(response.status).toBe(409);
    expect(model('payment').create).not.toHaveBeenCalled();
  });

  it('409s when payment has already been verified', async () => {
    model('order').findFirst.mockResolvedValue(storedOrder({ paymentStatus: 'VERIFIED' }));

    const response = await api()
      .post(`/api/v1/orders/${UUID.order}/submit-payment`)
      .set(asUser())
      .send(payload);

    expect(response.status).toBe(409);
  });

  it('409s for a cancelled order', async () => {
    model('order').findFirst.mockResolvedValue(storedOrder({ orderStatus: 'CANCELLED' }));

    const response = await api()
      .post(`/api/v1/orders/${UUID.order}/submit-payment`)
      .set(asUser())
      .send(payload);

    expect(response.status).toBe(409);
  });

  it('keeps the ownership check, the duplicate check and the write in one transaction', async () => {
    await api().post(`/api/v1/orders/${UUID.order}/submit-payment`).set(asUser()).send(payload);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('POST /orders/:id/cancel', () => {
  beforeEach(() => {
    model('order').findFirst.mockResolvedValue(storedOrder());
    model('order').findUnique.mockResolvedValue(storedOrder());
    model('order').update.mockResolvedValue(storedOrder({ orderStatus: 'CANCELLED' }));
    model('orderStatusHistory').create.mockResolvedValue({});
    model('product').updateMany.mockResolvedValue({ count: 1 });
  });

  it('lets the owner cancel an unpaid order', async () => {
    const response = await api().post(`/api/v1/orders/${UUID.order}/cancel`).set(asUser());

    expect(response.status).toBe(200);
    expect(model('order').update.mock.calls[0][0].data).toMatchObject({ orderStatus: 'CANCELLED' });
  });

  it('releases reserved stock so the units can be sold again', async () => {
    model('order').findUnique.mockResolvedValue(
      storedOrder({ items: [{ productId: UUID.product, quantity: 2 }] }),
    );

    await api().post(`/api/v1/orders/${UUID.order}/cancel`).set(asUser());

    expect(model('product').updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: UUID.product, quantityAvailable: { not: -1 } },
      data: { quantityAvailable: { increment: 2 } },
    });
  });

  it('never decrements the unlimited sentinel', async () => {
    model('order').findUnique.mockResolvedValue(
      storedOrder({ items: [{ productId: UUID.product, quantity: 2 }] }),
    );

    await api().post(`/api/v1/orders/${UUID.order}/cancel`).set(asUser());

    expect(model('product').updateMany.mock.calls[0][0].where.quantityAvailable).toEqual({ not: -1 });
  });

  it('403s when an admin tries to cancel somebody else\'s order through the customer route', async () => {
    model('order').findFirst.mockResolvedValue(storedOrder({ userId: 'someone-else' }));

    const response = await api().post(`/api/v1/orders/${UUID.order}/cancel`).set(asAdmin());

    expect(response.status).toBe(403);
    expect(model('order').update).not.toHaveBeenCalled();
  });

  it('409s once payment has been verified', async () => {
    model('order').findFirst.mockResolvedValue(storedOrder({ paymentStatus: 'VERIFIED' }));

    const response = await api().post(`/api/v1/orders/${UUID.order}/cancel`).set(asUser());

    expect(response.status).toBe(409);
    expect(model('order').update).not.toHaveBeenCalled();
  });
});

describe('PATCH /orders/:id/status', () => {
  beforeEach(() => {
    model('order').findUnique.mockResolvedValue(storedOrder());
    model('order').update.mockResolvedValue(storedOrder({ orderStatus: 'PROCESSING' }));
    model('orderStatusHistory').create.mockResolvedValue({});
  });

  it('is admin-only', async () => {
    const response = await api()
      .patch(`/api/v1/orders/${UUID.order}/status`)
      .set(asUser())
      .send({ status: 'DELIVERED' });

    expect(response.status).toBe(403);
    expect(model('order').update).not.toHaveBeenCalled();
  });

  /**
   * Regression: the handler passed `req.body.status` straight to Prisma, so an
   * admin (or a typo in the console) could write an arbitrary string into
   * `order_status` and break every downstream filter and report.
   */
  it.each([['SHIPPED_TO_MOON'], [''], ['PENDING; DROP TABLE orders']])(
    'rejects a status outside the enum (%s)',
    async (status) => {
      const response = await api()
        .patch(`/api/v1/orders/${UUID.order}/status`)
        .set(asAdmin())
        .send({ status });

      expect(response.status).toBe(400);
      expect(model('order').update).not.toHaveBeenCalled();
    },
  );

  it('applies a legal transition', async () => {
    const response = await api()
      .patch(`/api/v1/orders/${UUID.order}/status`)
      .set(asAdmin())
      .send({ status: 'PROCESSING' });

    expect(response.status).toBe(200);
    expect(model('order').update.mock.calls[0][0].data).toMatchObject({
      orderStatus: 'PROCESSING',
      deliveryStatus: 'PROCESSING',
    });
  });

  it('rejects an illegal transition with a 409 explaining both states', async () => {
    model('order').findUnique.mockResolvedValue(storedOrder({ orderStatus: 'CANCELLED' }));

    const response = await api()
      .patch(`/api/v1/orders/${UUID.order}/status`)
      .set(asAdmin())
      .send({ status: 'PENDING' });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/CANCELLED to PENDING/);
  });

  it('rejects re-applying the current status', async () => {
    const response = await api()
      .patch(`/api/v1/orders/${UUID.order}/status`)
      .set(asAdmin())
      .send({ status: 'PENDING' });

    expect(response.status).toBe(409);
    expect(model('order').update).not.toHaveBeenCalled();
  });

  it('records who changed the status and why', async () => {
    await api()
      .patch(`/api/v1/orders/${UUID.order}/status`)
      .set(asAdmin())
      .send({ status: 'PROCESSING', reason: 'Payment confirmed by phone' });

    expect(model('orderStatusHistory').create.mock.calls[0][0].data).toMatchObject({
      orderId: UUID.order,
      changedBy: UUID.admin,
      oldStatus: 'PENDING',
      newStatus: 'PROCESSING',
      reason: 'Payment confirmed by phone',
    });
  });

  it('stamps deliveredAt when an order is delivered', async () => {
    model('order').findUnique.mockResolvedValue(storedOrder({ orderStatus: 'PROCESSING' }));

    await api().patch(`/api/v1/orders/${UUID.order}/status`).set(asAdmin()).send({ status: 'DELIVERED' });

    const data = model('order').update.mock.calls[0][0].data;
    expect(data).toMatchObject({ orderStatus: 'DELIVERED', deliveryStatus: 'DELIVERED' });
    expect(data.deliveredAt).toBeInstanceOf(Date);
  });

  it('rejects an unrecognised body field', async () => {
    const response = await api()
      .patch(`/api/v1/orders/${UUID.order}/status`)
      .set(asAdmin())
      .send({ status: 'PROCESSING', totalAmount: 1 });

    expect(response.status).toBe(400);
  });

  it('keeps the transition check and the write in one transaction', async () => {
    await api().patch(`/api/v1/orders/${UUID.order}/status`).set(asAdmin()).send({ status: 'PROCESSING' });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('PATCH /orders/:id/verify-payment', () => {
  beforeEach(() => {
    model('order').findUnique.mockResolvedValue(
      storedOrder({ paymentStatus: 'PENDING_VERIFICATION', transactionId: TRANSACTION_ID }),
    );
    model('order').update.mockResolvedValue(storedOrder({ paymentStatus: 'VERIFIED' }));
    model('orderStatusHistory').create.mockResolvedValue({});
    model('payment').updateMany.mockResolvedValue({ count: 1 });
  });

  it('is admin-only', async () => {
    const response = await api().patch(`/api/v1/orders/${UUID.order}/verify-payment`).set(asUser()).send({});
    expect(response.status).toBe(403);
  });

  it('records the verifying admin and the moment of verification', async () => {
    const response = await api().patch(`/api/v1/orders/${UUID.order}/verify-payment`).set(asAdmin()).send({});

    expect(response.status).toBe(200);
    const data = model('order').update.mock.calls[0][0].data;
    expect(data).toMatchObject({ paymentStatus: 'VERIFIED', paymentVerifiedBy: UUID.admin });
    expect(data.paymentVerifiedAt).toBeInstanceOf(Date);
  });

  it('advances a PENDING order to PROCESSING so fulfilment can start', async () => {
    await api().patch(`/api/v1/orders/${UUID.order}/verify-payment`).set(asAdmin()).send({});
    expect(model('order').update.mock.calls[0][0].data).toMatchObject({ orderStatus: 'PROCESSING' });
  });

  it('400s when neither the body nor the order carries a transaction id', async () => {
    model('order').findUnique.mockResolvedValue(storedOrder({ paymentStatus: 'PENDING_VERIFICATION' }));

    const response = await api().patch(`/api/v1/orders/${UUID.order}/verify-payment`).set(asAdmin()).send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/transaction id/i);
  });

  // Idempotent by design: an admin double-clicking "Verify" must not corrupt the
  // ledger or double-count revenue.
  it('is a no-op when the payment is already verified', async () => {
    model('order').findUnique.mockResolvedValue(
      storedOrder({ paymentStatus: 'VERIFIED', transactionId: TRANSACTION_ID }),
    );

    const response = await api().patch(`/api/v1/orders/${UUID.order}/verify-payment`).set(asAdmin()).send({});

    expect(response.status).toBe(200);
    expect(model('order').update).not.toHaveBeenCalled();
    expect(model('orderStatusHistory').create).not.toHaveBeenCalled();
  });

  it('409s when the order was cancelled', async () => {
    model('order').findUnique.mockResolvedValue(
      storedOrder({ orderStatus: 'CANCELLED', transactionId: TRANSACTION_ID }),
    );

    const response = await api().patch(`/api/v1/orders/${UUID.order}/verify-payment`).set(asAdmin()).send({});
    expect(response.status).toBe(409);
  });

  it('reconciles the payment ledger so the admin Payments view reflects reality', async () => {
    model('order').findUnique.mockResolvedValue(
      storedOrder({
        paymentStatus: 'PENDING_VERIFICATION',
        transactionId: TRANSACTION_ID,
        payments: [{ id: 'pay-1', transactionId: TRANSACTION_ID, status: 'PENDING' }],
      }),
    );

    await api().patch(`/api/v1/orders/${UUID.order}/verify-payment`).set(asAdmin()).send({ note: 'Matched' });

    expect(model('payment').updateMany.mock.calls[0][0]).toMatchObject({
      where: { orderId: UUID.order, status: { not: 'VERIFIED' } },
      data: { status: 'VERIFIED', verifiedBy: UUID.admin, verificationNote: 'Matched' },
    });
  });
});

describe('PATCH /orders/:id/reject-payment', () => {
  beforeEach(() => {
    model('order').findUnique.mockResolvedValue(storedOrder({ paymentStatus: 'PENDING_VERIFICATION' }));
    model('order').update.mockResolvedValue(storedOrder({ paymentStatus: 'FAILED' }));
    model('orderStatusHistory').create.mockResolvedValue({});
    model('payment').updateMany.mockResolvedValue({ count: 1 });
  });

  it('is admin-only', async () => {
    const response = await api().patch(`/api/v1/orders/${UUID.order}/reject-payment`).set(asUser()).send({});
    expect(response.status).toBe(403);
  });

  /**
   * Without this an admin could only move a payment forward, so a bogus
   * transaction id sat in PENDING_VERIFICATION forever.
   */
  it('marks the payment failed and records the reason', async () => {
    const response = await api()
      .patch(`/api/v1/orders/${UUID.order}/reject-payment`)
      .set(asAdmin())
      .send({ note: 'Transaction not found in the bKash statement' });

    expect(response.status).toBe(200);
    expect(model('order').update.mock.calls[0][0].data).toMatchObject({ paymentStatus: 'FAILED' });
    expect(model('payment').updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'FAILED',
      verificationNote: 'Transaction not found in the bKash statement',
    });
  });

  it('409s when the payment was already verified', async () => {
    model('order').findUnique.mockResolvedValue(storedOrder({ paymentStatus: 'VERIFIED' }));

    const response = await api().patch(`/api/v1/orders/${UUID.order}/reject-payment`).set(asAdmin()).send({});

    expect(response.status).toBe(409);
    expect(model('order').update).not.toHaveBeenCalled();
  });
});

describe('GET /payments/gateways', () => {
  /**
   * Checkout needs the enabled gateways, but they were only exposed through an
   * admin-authenticated endpoint — so the storefront could never render them.
   */
  it('is public', async () => {
    model('paymentGateway').findMany.mockResolvedValue([
      { id: UUID.gateway, gatewayName: 'bKash', accountIdentifier: '01700000000' },
    ]);

    const response = await api().get('/api/v1/payments/gateways');

    expect(response.status).toBe(200);
    expect(model('paymentGateway').findMany.mock.calls[0][0].where).toEqual({ isEnabled: true });
  });

  it('never returns gateway credentials to a customer', async () => {
    model('paymentGateway').findMany.mockResolvedValue([]);

    await api().get('/api/v1/payments/gateways');

    const select = model('paymentGateway').findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('settings');
    expect(select).not.toHaveProperty('accountNumber');
  });
});

describe('cross-tenant isolation', () => {
  beforeEach(() => {
    model('order').findMany.mockResolvedValue([]);
    model('order').count.mockResolvedValue(0);
  });

  it('scopes each customer to their own order list', async () => {
    await api().get('/api/v1/orders').set(asUser(USER));
    expect(model('order').findMany.mock.calls[0][0].where.userId).toBe(USER.id);

    const other = { id: 'other-customer', email: 'other@example.com', role: 'USER' };
    await api().get('/api/v1/orders').set(asUser(other));
    expect(model('order').findMany.mock.calls[1][0].where.userId).toBe(other.id);
  });

  it('keeps the customer list scoped even for an admin', async () => {
    await api().get('/api/v1/orders').set(asAdmin());
    expect(model('order').findMany.mock.calls[0][0].where).toEqual({ userId: ADMIN.id });
  });
});
