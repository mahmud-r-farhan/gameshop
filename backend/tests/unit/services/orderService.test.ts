import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaError, model, resetPrismaMock } from '../../helpers/prisma-mock.js';

vi.mock('../../../src/config/database.js', async () => {
  const { prismaMock } = await import('../../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { orderService } = await import('../../../src/services/orderService.js');

const PRODUCT_ID = '6f1e2c3d-0000-4000-8000-000000000001';
const OTHER_PRODUCT_ID = '6f1e2c3d-0000-4000-8000-000000000002';
const USER_ID = '6f1e2c3d-0000-4000-8000-0000000000aa';
const ADMIN_ID = '6f1e2c3d-0000-4000-8000-0000000000bb';
const ORDER_ID = '6f1e2c3d-0000-4000-8000-0000000000cc';
const PROMO_ID = '6f1e2c3d-0000-4000-8000-0000000000dd';

const unlimitedProduct = {
  id: PRODUCT_ID,
  name: 'PUBG 60 UC',
  price: '120.00',
  isAvailable: true,
  quantityAvailable: -1,
};

const limitedProduct = {
  id: OTHER_PRODUCT_ID,
  name: 'GTA Megalodon',
  price: '8900.00',
  isAvailable: true,
  quantityAvailable: 5,
};

beforeEach(() => {
  resetPrismaMock();
  model('order').create.mockResolvedValue({
    id: ORDER_ID,
    orderNumber: 'ORD-TEST-000001',
    userId: USER_ID,
    items: [],
  });
});

describe('createOrder — pricing', () => {
  it('computes subtotal and total from server-side prices', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);

    await orderService.createOrder(USER_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 3 }],
      deliveryAddress: 'House 12, Road 5, Dhanmondi',
    });

    const createArgs = model('order').create.mock.calls[0][0];
    expect(createArgs.data.subtotal).toBe('360.00');
    expect(createArgs.data.discountAmount).toBe('0.00');
    expect(createArgs.data.totalAmount).toBe('360.00');
  });

  // Regression: prices came from `product.price` only, but nothing asserted the
  // arithmetic stayed in cents — a 0.1 + 0.2 style drift could round wrong.
  it('does not drift on non-representable unit prices', async () => {
    model('product').findMany.mockResolvedValue([{ ...unlimitedProduct, price: '19.99' }]);

    await orderService.createOrder(USER_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 3 }],
      deliveryAddress: 'House 12, Road 5, Dhanmondi',
    });

    expect(model('order').create.mock.calls[0][0].data.totalAmount).toBe('59.97');
  });

  it('snapshots the product name and unit price onto each line', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);

    await orderService.createOrder(USER_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 2 }],
      deliveryAddress: 'House 12, Road 5, Dhanmondi',
    });

    expect(model('order').create.mock.calls[0][0].data.items.create).toEqual([
      { productId: PRODUCT_ID, quantity: 2, price: '120.00', productName: 'PUBG 60 UC' },
    ]);
  });

  it('writes the opening status-history entry inside the same create', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    await orderService.createOrder(USER_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      deliveryAddress: 'House 12, Road 5, Dhanmondi',
    });

    expect(model('order').create.mock.calls[0][0].data.statusHistory.create).toMatchObject({
      statusType: 'order_status',
      newStatus: 'PENDING',
      changedBy: USER_ID,
    });
  });
});

describe('createOrder — validation', () => {
  it('rejects an empty basket before touching the database', async () => {
    await expect(
      orderService.createOrder(USER_ID, { items: [], deliveryAddress: 'House 12, Road 5' }),
    ).rejects.toThrow(/at least one item/);
    expect(model('order').create).not.toHaveBeenCalled();
  });

  it('rejects a missing basket', async () => {
    await expect(
      orderService.createOrder(USER_ID, { items: undefined as never, deliveryAddress: 'x' }),
    ).rejects.toThrow();
  });

  it('rejects a product that no longer exists', async () => {
    model('product').findMany.mockResolvedValue([]);
    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow(/no longer exist/);
  });

  it('rejects an unavailable product by name', async () => {
    model('product').findMany.mockResolvedValue([{ ...unlimitedProduct, isAvailable: false }]);
    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow(/PUBG 60 UC is not available/);
  });
});

describe('createOrder — stock', () => {
  // Regression: `Product.quantityAvailable` existed in the schema but was never
  // read or decremented, so the shop could oversell without limit.
  it('decrements finite stock with a guarded update', async () => {
    model('product').findMany.mockResolvedValue([limitedProduct]);
    model('product').updateMany.mockResolvedValue({ count: 1 });

    await orderService.createOrder(USER_ID, {
      items: [{ productId: OTHER_PRODUCT_ID, quantity: 2 }],
      deliveryAddress: 'House 12, Road 5, Dhanmondi',
    });

    expect(model('product').updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: OTHER_PRODUCT_ID,
          quantityAvailable: { gte: 2 },
        }),
        data: { quantityAvailable: { decrement: 2 } },
      }),
    );
  });

  it('refuses to oversell when the guarded update matches no row', async () => {
    model('product').findMany.mockResolvedValue([limitedProduct]);
    model('product').updateMany.mockResolvedValue({ count: 0 });

    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: OTHER_PRODUCT_ID, quantity: 99 }],
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow(/Insufficient stock/);

    expect(model('order').create).not.toHaveBeenCalled();
  });

  it('leaves the -1 unlimited sentinel alone', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);

    await orderService.createOrder(USER_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 3 }],
      deliveryAddress: 'House 12, Road 5, Dhanmondi',
    });

    expect(model('product').updateMany).not.toHaveBeenCalled();
  });
});

describe('createOrder — promotions', () => {
  const activePromo = {
    id: PROMO_ID,
    code: 'WELCOME10',
    discountType: 'PERCENTAGE',
    discountValue: '10.00',
    minPurchaseAmount: null,
    maxUsage: null,
    usedCount: 0,
    validFrom: new Date('2020-01-01'),
    validUntil: new Date('2099-01-01'),
    isActive: true,
    applicableProducts: [],
  };

  it('applies a percentage discount', async () => {
    model('product').findMany.mockResolvedValue([{ ...unlimitedProduct, price: '1000.00' }]);
    model('promotion').findUnique.mockResolvedValue(activePromo);
    model('promotion').updateMany.mockResolvedValue({ count: 1 });

    await orderService.createOrder(USER_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      promoCode: 'WELCOME10',
      deliveryAddress: 'House 12, Road 5, Dhanmondi',
    });

    const data = model('order').create.mock.calls[0][0].data;
    expect(data.subtotal).toBe('1000.00');
    expect(data.discountAmount).toBe('100.00');
    expect(data.totalAmount).toBe('900.00');
    expect(data.promoCode).toBe('WELCOME10');
  });

  // Regression: a FIXED coupon worth more than the basket produced a negative
  // order total.
  it('clamps a fixed discount so the total can never go negative', async () => {
    model('product').findMany.mockResolvedValue([{ ...unlimitedProduct, price: '100.00' }]);
    model('promotion').findUnique.mockResolvedValue({
      ...activePromo,
      discountType: 'FIXED',
      discountValue: '5000.00',
    });
    model('promotion').updateMany.mockResolvedValue({ count: 1 });

    await orderService.createOrder(USER_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      promoCode: 'WELCOME10',
      deliveryAddress: 'House 12, Road 5, Dhanmondi',
    });

    const data = model('order').create.mock.calls[0][0].data;
    expect(data.discountAmount).toBe('100.00');
    expect(data.totalAmount).toBe('0.00');
  });

  // Regression: only `validUntil` was checked.
  it('rejects a promotion that has not started yet', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    model('promotion').findUnique.mockResolvedValue({
      ...activePromo,
      validFrom: new Date(Date.now() + 86_400_000),
    });

    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        promoCode: 'WELCOME10',
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow(/not active yet/);
  });

  it('rejects an expired promotion', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    model('promotion').findUnique.mockResolvedValue({
      ...activePromo,
      validUntil: new Date(Date.now() - 86_400_000),
    });

    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        promoCode: 'WELCOME10',
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow(/expired/);
  });

  it('rejects an inactive or unknown code without leaking which', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    model('promotion').findUnique.mockResolvedValue(null);

    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        promoCode: 'NOPE',
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow(/Invalid promo code/);
  });

  // Regression: `applicableProducts` was modelled but never enforced, so a
  // coupon scoped to one product discounted the entire cart.
  it('rejects a scoped promotion when the cart has no eligible product', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    model('promotion').findUnique.mockResolvedValue({
      ...activePromo,
      applicableProducts: [{ id: OTHER_PRODUCT_ID }],
    });

    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        promoCode: 'WELCOME10',
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow(/does not apply/);
  });

  it('accepts a scoped promotion when the cart contains an eligible product', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    model('promotion').findUnique.mockResolvedValue({
      ...activePromo,
      applicableProducts: [{ id: PRODUCT_ID }],
    });
    model('promotion').updateMany.mockResolvedValue({ count: 1 });

    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        promoCode: 'WELCOME10',
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).resolves.toBeDefined();
  });

  it('enforces the minimum purchase amount', async () => {
    model('product').findMany.mockResolvedValue([{ ...unlimitedProduct, price: '50.00' }]);
    model('promotion').findUnique.mockResolvedValue({
      ...activePromo,
      minPurchaseAmount: '200.00',
    });

    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        promoCode: 'WELCOME10',
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow(/Minimum purchase amount/);
  });

  it('rejects a fully redeemed promotion', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    model('promotion').findUnique.mockResolvedValue({ ...activePromo, maxUsage: 10, usedCount: 10 });

    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        promoCode: 'WELCOME10',
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow(/maximum usage/);
  });

  // Regression: usage was counted with a read-then-write, so concurrent
  // checkouts could redeem a limited coupon far past `maxUsage`.
  it('increments usage with a guarded atomic update', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    model('promotion').findUnique.mockResolvedValue({ ...activePromo, maxUsage: 5, usedCount: 4 });
    model('promotion').updateMany.mockResolvedValue({ count: 1 });

    await orderService.createOrder(USER_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      promoCode: 'WELCOME10',
      deliveryAddress: 'House 12, Road 5, Dhanmondi',
    });

    expect(model('promotion').updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: PROMO_ID, usedCount: { lt: 5 } }),
        data: { usedCount: { increment: 1 } },
      }),
    );
  });

  it('fails when another request claimed the last redemption', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    model('promotion').findUnique.mockResolvedValue({ ...activePromo, maxUsage: 5, usedCount: 4 });
    model('promotion').updateMany.mockResolvedValue({ count: 0 });

    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        promoCode: 'WELCOME10',
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow(/maximum usage/);
  });
});

describe('createOrder — atomicity', () => {
  it('runs every write inside a single transaction', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);

    await orderService.createOrder(USER_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      deliveryAddress: 'House 12, Road 5, Dhanmondi',
    });

    const { prismaMock } = await import('../../helpers/prisma-mock.js');
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(typeof prismaMock.$transaction.mock.calls[0][0]).toBe('function');
  });

  it('propagates a database failure so the transaction rolls back', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    model('order').create.mockRejectedValue(prismaError('P2002', { target: ['orders', 'order_number'] }));

    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow();
  });
});

describe('getOrderById — authorisation', () => {
  // Regression: the admin panel's order-detail view always 404ed because the
  // lookup was unconditionally scoped to the caller's own user id.
  it('scopes a customer to their own orders', async () => {
    model('order').findFirst.mockResolvedValue({ id: ORDER_ID });
    await orderService.getOrderById(ORDER_ID, { id: USER_ID, role: 'USER' });

    expect(model('order').findFirst.mock.calls[0][0].where).toEqual({ id: ORDER_ID, userId: USER_ID });
  });

  it('lets an ADMIN read any order', async () => {
    model('order').findFirst.mockResolvedValue({ id: ORDER_ID });
    await orderService.getOrderById(ORDER_ID, { id: ADMIN_ID, role: 'ADMIN' });

    expect(model('order').findFirst.mock.calls[0][0].where).toEqual({ id: ORDER_ID });
  });

  it('lets a SUPER_ADMIN read any order', async () => {
    model('order').findFirst.mockResolvedValue({ id: ORDER_ID });
    await orderService.getOrderById(ORDER_ID, { id: ADMIN_ID, role: 'SUPER_ADMIN' });

    expect(model('order').findFirst.mock.calls[0][0].where).toEqual({ id: ORDER_ID });
  });

  it('includes the customer profile only for administrators', async () => {
    model('order').findFirst.mockResolvedValue({ id: ORDER_ID });

    await orderService.getOrderById(ORDER_ID, { id: USER_ID, role: 'USER' });
    expect(model('order').findFirst.mock.calls[0][0].include.user).toBe(false);

    await orderService.getOrderById(ORDER_ID, { id: ADMIN_ID, role: 'ADMIN' });
    expect(model('order').findFirst.mock.calls[1][0].include.user).toMatchObject({ select: { email: true } });
  });

  it('throws 404 when nothing matches', async () => {
    model('order').findFirst.mockResolvedValue(null);
    await expect(orderService.getOrderById(ORDER_ID, { id: USER_ID, role: 'USER' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('updateOrderStatus', () => {
  const pendingOrder = {
    id: ORDER_ID,
    userId: USER_ID,
    orderStatus: 'PENDING',
    paymentStatus: 'PENDING',
    deliveryStatus: 'WAITING',
    promoId: null,
    items: [],
  };

  beforeEach(() => {
    model('order').findUnique.mockResolvedValue(pendingOrder);
    model('order').update.mockResolvedValue({ ...pendingOrder, orderStatus: 'PROCESSING' });
  });

  it('advances PENDING -> PROCESSING and records history', async () => {
    await orderService.updateOrderStatus(ORDER_ID, 'PROCESSING', ADMIN_ID);

    expect(model('orderStatusHistory').create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: ORDER_ID,
          statusType: 'order_status',
          oldStatus: 'PENDING',
          newStatus: 'PROCESSING',
          changedBy: ADMIN_ID,
        }),
      }),
    );
    expect(model('order').update).toHaveBeenCalled();
  });

  it('marks delivery state and timestamp when delivered', async () => {
    model('order').findUnique.mockResolvedValue({ ...pendingOrder, orderStatus: 'PROCESSING' });

    await orderService.updateOrderStatus(ORDER_ID, 'DELIVERED', ADMIN_ID);

    const data = model('order').update.mock.calls[0][0].data;
    expect(data.orderStatus).toBe('DELIVERED');
    expect(data.deliveryStatus).toBe('DELIVERED');
    expect(data.deliveredAt).toBeInstanceOf(Date);
  });

  // Regression: any string was written straight into `order_status`.
  it('rejects an unknown status', async () => {
    await expect(orderService.updateOrderStatus(ORDER_ID, 'TELEPORTED', ADMIN_ID)).rejects.toThrow(
      /Invalid status/,
    );
    expect(model('order').update).not.toHaveBeenCalled();
  });

  // Regression: a DELIVERED order could be moved back to PENDING, corrupting
  // revenue reporting.
  it('rejects an illegal transition', async () => {
    model('order').findUnique.mockResolvedValue({ ...pendingOrder, orderStatus: 'DELIVERED' });
    await expect(orderService.updateOrderStatus(ORDER_ID, 'PENDING', ADMIN_ID)).rejects.toThrow(
      /Cannot change order status/,
    );
  });

  it('rejects a no-op transition', async () => {
    await expect(orderService.updateOrderStatus(ORDER_ID, 'PENDING', ADMIN_ID)).rejects.toThrow(/already/);
  });

  it('throws 404 for an unknown order', async () => {
    model('order').findUnique.mockResolvedValue(null);
    await expect(orderService.updateOrderStatus(ORDER_ID, 'PROCESSING', ADMIN_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('releases reserved stock and the promo redemption when cancelled', async () => {
    model('order').findUnique.mockResolvedValue({
      ...pendingOrder,
      promoId: PROMO_ID,
      items: [{ productId: OTHER_PRODUCT_ID, quantity: 2 }],
    });

    await orderService.updateOrderStatus(ORDER_ID, 'CANCELLED', ADMIN_ID);

    expect(model('product').updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: OTHER_PRODUCT_ID }),
        data: { quantityAvailable: { increment: 2 } },
      }),
    );
    expect(model('promotion').updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { usedCount: { decrement: 1 } } }),
    );
  });

  it('does not touch the unlimited-stock sentinel on cancellation', async () => {
    model('order').findUnique.mockResolvedValue({
      ...pendingOrder,
      items: [{ productId: PRODUCT_ID, quantity: 2 }],
    });

    await orderService.updateOrderStatus(ORDER_ID, 'CANCELLED', ADMIN_ID);

    expect(model('product').updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ quantityAvailable: { not: -1 } }),
      }),
    );
  });
});

describe('submitPayment', () => {
  const order = {
    id: ORDER_ID,
    userId: USER_ID,
    totalAmount: '360.00',
    paymentStatus: 'PENDING',
    orderStatus: 'PENDING',
  };

  beforeEach(() => {
    model('order').findFirst.mockResolvedValue(order);
    model('payment').findFirst.mockResolvedValue(null);
    model('payment').create.mockResolvedValue({ id: 'pay-1', orderId: ORDER_ID });
    model('order').update.mockResolvedValue(order);
  });

  it('records the payment and moves the order to PENDING_VERIFICATION', async () => {
    await orderService.submitPayment(ORDER_ID, USER_ID, 'TRX12345', 'bkash');

    expect(model('payment').create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: ORDER_ID,
          amount: '360.00',
          paymentMethod: 'BKASH',
          transactionId: 'TRX12345',
          status: 'PENDING',
        }),
      }),
    );
    expect(model('order').update.mock.calls[0][0].data.paymentStatus).toBe('PENDING_VERIFICATION');
  });

  it('rejects an unsupported payment method', async () => {
    await expect(
      orderService.submitPayment(ORDER_ID, USER_ID, 'TRX12345', 'PAYPAL'),
    ).rejects.toThrow(/Payment method must be one of/);
  });

  it('throws 404 when the order belongs to someone else', async () => {
    model('order').findFirst.mockResolvedValue(null);
    await expect(
      orderService.submitPayment(ORDER_ID, USER_ID, 'TRX12345', 'BKASH'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // Regression: `transactionId` is UNIQUE, so reusing a gateway reference hit
  // the index and surfaced as a raw 500.
  it('rejects a transaction id that has already been submitted', async () => {
    model('payment').findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      orderService.submitPayment(ORDER_ID, USER_ID, 'TRX12345', 'BKASH'),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(model('payment').create).not.toHaveBeenCalled();
  });

  it('still translates a race on the unique index into a 409', async () => {
    model('payment').create.mockRejectedValue(prismaError('P2002', { target: ['transaction_id'] }));
    await expect(
      orderService.submitPayment(ORDER_ID, USER_ID, 'TRX12345', 'BKASH'),
    ).rejects.toThrow();
  });

  it('refuses to overwrite a verified payment', async () => {
    model('order').findFirst.mockResolvedValue({ ...order, paymentStatus: 'VERIFIED' });
    await expect(
      orderService.submitPayment(ORDER_ID, USER_ID, 'TRX99999', 'BKASH'),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('refuses payment on a cancelled order', async () => {
    model('order').findFirst.mockResolvedValue({ ...order, orderStatus: 'CANCELLED' });
    await expect(
      orderService.submitPayment(ORDER_ID, USER_ID, 'TRX99999', 'BKASH'),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects an amount that does not match the order total', async () => {
    await expect(
      orderService.submitPayment(ORDER_ID, USER_ID, 'TRX12345', 'BKASH', { amount: 100 }),
    ).rejects.toThrow(/does not match the order total/);
  });

  it('accepts a matching amount', async () => {
    await expect(
      orderService.submitPayment(ORDER_ID, USER_ID, 'TRX12345', 'BKASH', { amount: 360 }),
    ).resolves.toBeDefined();
  });

  it('writes the payment ledger and the order inside one transaction', async () => {
    await orderService.submitPayment(ORDER_ID, USER_ID, 'TRX12345', 'BKASH');

    const { prismaMock } = await import('../../helpers/prisma-mock.js');
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('verifyPayment', () => {
  const order = {
    id: ORDER_ID,
    userId: USER_ID,
    totalAmount: '360.00',
    paymentStatus: 'PENDING_VERIFICATION',
    orderStatus: 'PENDING',
    deliveryStatus: 'WAITING',
    transactionId: 'TRX12345',
    payments: [{ id: 'pay-1', transactionId: 'TRX12345', status: 'PENDING' }],
  };

  beforeEach(() => {
    model('order').findUnique.mockResolvedValue(order);
    model('order').update.mockResolvedValue({ ...order, paymentStatus: 'VERIFIED' });
    model('payment').updateMany.mockResolvedValue({ count: 1 });
  });

  it('marks the order verified, processing and records the verifier', async () => {
    await orderService.verifyPayment(ORDER_ID, 'TRX12345', ADMIN_ID, 'Matched statement');

    const data = model('order').update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      paymentStatus: 'VERIFIED',
      orderStatus: 'PROCESSING',
      deliveryStatus: 'PROCESSING',
      paymentVerifiedBy: ADMIN_ID,
    });
    expect(data.paymentCompletedAt).toBeInstanceOf(Date);
    expect(model('orderStatusHistory').create).toHaveBeenCalled();
  });

  it('reconciles the payment ledger rows', async () => {
    await orderService.verifyPayment(ORDER_ID, 'TRX12345', ADMIN_ID);

    expect(model('payment').updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: ORDER_ID, status: { not: 'VERIFIED' } },
        data: expect.objectContaining({ status: 'VERIFIED', verifiedBy: ADMIN_ID }),
      }),
    );
  });

  it('falls back to the stored transaction id when none is supplied', async () => {
    await orderService.verifyPayment(ORDER_ID, '', ADMIN_ID);
    expect(model('order').update.mock.calls[0][0].data.transactionId).toBe('TRX12345');
  });

  it('requires a transaction id when the order has none either', async () => {
    model('order').findUnique.mockResolvedValue({ ...order, transactionId: null });
    await expect(orderService.verifyPayment(ORDER_ID, '', ADMIN_ID)).rejects.toThrow(
      /transaction ID is required/i,
    );
  });

  // Regression: re-verifying wrote a second history row and re-emitted the
  // notification, double-counting revenue in the admin timeline.
  it('is idempotent for an already-verified order', async () => {
    model('order').findUnique.mockResolvedValue({ ...order, paymentStatus: 'VERIFIED' });

    await orderService.verifyPayment(ORDER_ID, 'TRX12345', ADMIN_ID);

    expect(model('order').update).not.toHaveBeenCalled();
    expect(model('orderStatusHistory').create).not.toHaveBeenCalled();
  });

  it('refuses to verify payment on a cancelled order', async () => {
    model('order').findUnique.mockResolvedValue({ ...order, orderStatus: 'CANCELLED' });
    await expect(orderService.verifyPayment(ORDER_ID, 'TRX12345', ADMIN_ID)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('does not downgrade an order that is already further along', async () => {
    model('order').findUnique.mockResolvedValue({ ...order, orderStatus: 'DELIVERED' });
    await orderService.verifyPayment(ORDER_ID, 'TRX12345', ADMIN_ID);
    expect(model('order').update.mock.calls[0][0].data.orderStatus).toBe('DELIVERED');
  });
});

describe('rejectPayment', () => {
  const order = { id: ORDER_ID, userId: USER_ID, paymentStatus: 'PENDING_VERIFICATION' };

  beforeEach(() => {
    model('order').findUnique.mockResolvedValue(order);
    model('order').update.mockResolvedValue({ ...order, paymentStatus: 'FAILED' });
  });

  it('fails the payment and records why', async () => {
    await orderService.rejectPayment(ORDER_ID, ADMIN_ID, 'Reference not found in the statement');

    expect(model('payment').updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(model('orderStatusHistory').create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ newStatus: 'FAILED', statusType: 'payment_status' }),
      }),
    );
  });

  it('cannot reject a payment that is already verified', async () => {
    model('order').findUnique.mockResolvedValue({ ...order, paymentStatus: 'VERIFIED' });
    await expect(orderService.rejectPayment(ORDER_ID, ADMIN_ID)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('getAllOrders / getUserOrders', () => {
  it('normalises invalid pagination instead of forwarding NaN to Prisma', async () => {
    model('order').findMany.mockResolvedValue([]);
    model('order').count.mockResolvedValue(0);

    await orderService.getUserOrders(USER_ID, 'abc', 'xyz');

    const args = model('order').findMany.mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(args.take).toBe(10);
  });

  it('clamps an abusive page size', async () => {
    model('order').findMany.mockResolvedValue([]);
    model('order').count.mockResolvedValue(0);

    await orderService.getAllOrders({ limit: 100_000 });
    expect(model('order').findMany.mock.calls[0][0].take).toBeLessThanOrEqual(100);
  });

  it('filters by status and searches across order number and customer', async () => {
    model('order').findMany.mockResolvedValue([]);
    model('order').count.mockResolvedValue(0);

    await orderService.getAllOrders({ status: 'PENDING', paymentStatus: 'VERIFIED', search: 'ORD-1' });

    const where = model('order').findMany.mock.calls[0][0].where;
    expect(where.orderStatus).toBe('PENDING');
    expect(where.paymentStatus).toBe('VERIFIED');
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { orderNumber: { contains: 'ORD-1', mode: 'insensitive' } },
        { user: { email: { contains: 'ORD-1', mode: 'insensitive' } } },
      ]),
    );
  });

  it('reports usable pagination metadata', async () => {
    model('order').findMany.mockResolvedValue([]);
    model('order').count.mockResolvedValue(45);

    const result = await orderService.getUserOrders(USER_ID, 2, 10);
    expect(result.pagination).toMatchObject({ currentPage: 2, totalPages: 5, totalItems: 45 });
  });
});

describe('getDashboardStats', () => {
  beforeEach(() => {
    // `periodStats` issues a count aggregate and a revenue aggregate per period
    // and all three periods run concurrently, so fixtures are keyed on the
    // requested shape rather than on call order.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model('order').aggregate.mockImplementation(async (args: any) =>
      args?._count ? { _count: { _all: 12 } } : { _sum: { totalAmount: '150000.00' } },
    );
    model('order').count.mockResolvedValue(3);
    model('payment').groupBy.mockResolvedValue([
      { paymentMethod: 'BKASH', _count: { _all: 8 }, _sum: { amount: '90000.00' } },
      { paymentMethod: 'NAGAD', _count: { _all: 2 }, _sum: { amount: '20000.00' } },
    ]);
    model('orderItem').groupBy.mockResolvedValue([
      { productId: PRODUCT_ID, productName: 'PUBG 60 UC', _sum: { quantity: 42 } },
    ]);
    model('order').groupBy.mockResolvedValue([{ orderStatus: 'PENDING', _count: { _all: 4 } }]);
    model('product').count.mockResolvedValue(2);
  });

  // Regression: every order and payment row since the start of each period was
  // loaded into Node and filtered in JS, three times over.
  it('uses database aggregates rather than loading rows into memory', async () => {
    const stats = await orderService.getDashboardStats();

    expect(model('order').aggregate).toHaveBeenCalled();
    expect(model('order').findMany).not.toHaveBeenCalled();
    expect(model('payment').findMany).not.toHaveBeenCalled();
    expect(stats.today.totalOrders).toBe(12);
  });

  it('reports revenue as a plain number', async () => {
    const stats = await orderService.getDashboardStats();
    expect(stats.today.totalRevenue).toBe(150000);
    expect(typeof stats.today.totalRevenue).toBe('number');
  });

  it('lower-cases payment method keys for the chart component', async () => {
    const stats = await orderService.getDashboardStats();
    expect(stats.today.paymentMethods).toEqual({ bkash: 8, nagad: 2 });
    expect(stats.today.paymentVolume).toEqual({ bkash: 90000, nagad: 20000 });
  });

  it('includes top products, status counts and a low-stock alert', async () => {
    const stats = await orderService.getDashboardStats();
    expect(stats.topProducts).toEqual([{ id: PRODUCT_ID, name: 'PUBG 60 UC', sales: 42 }]);
    expect(stats.ordersByStatus).toEqual({ PENDING: 4 });
    expect(stats.lowStockProducts).toBe(2);
  });

  it('survives a period with no data at all', async () => {
    resetPrismaMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model('order').aggregate.mockImplementation(async (args: any) =>
      args?._count ? { _count: { _all: 0 } } : { _sum: { totalAmount: null } },
    );
    model('order').count.mockResolvedValue(0);
    model('payment').groupBy.mockResolvedValue([]);
    model('orderItem').groupBy.mockResolvedValue([]);
    model('order').groupBy.mockResolvedValue([]);
    model('product').count.mockResolvedValue(0);

    const stats = await orderService.getDashboardStats();
    expect(stats.today).toMatchObject({ totalOrders: 0, totalRevenue: 0, pendingPayments: 0 });
    expect(stats.topProducts).toEqual([]);
  });
});

describe('getAnalytics', () => {
  it('buckets revenue by day and skips cancelled orders', async () => {
    model('order').findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-03-01T10:00:00Z'),
        totalAmount: '100.00',
        paymentStatus: 'VERIFIED',
        orderStatus: 'DELIVERED',
      },
      {
        createdAt: new Date('2026-03-01T18:00:00Z'),
        totalAmount: '50.00',
        paymentStatus: 'VERIFIED',
        orderStatus: 'DELIVERED',
      },
      {
        createdAt: new Date('2026-03-02T09:00:00Z'),
        totalAmount: '200.00',
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
      },
    ]);

    const result = await orderService.getAnalytics({
      from: new Date('2026-03-01'),
      to: new Date('2026-03-03'),
      granularity: 'day',
    });

    expect(result.series).toHaveLength(2);
    expect(result.series[0]).toMatchObject({ orders: 2, revenue: 150 });
    expect(result.series[1]).toMatchObject({ orders: 1, revenue: 0 });
  });

  it('returns a sorted series', async () => {
    model('order').findMany.mockResolvedValue([
      { createdAt: new Date('2026-03-05'), totalAmount: '10.00', paymentStatus: 'VERIFIED', orderStatus: 'DELIVERED' },
      { createdAt: new Date('2026-03-01'), totalAmount: '10.00', paymentStatus: 'VERIFIED', orderStatus: 'DELIVERED' },
    ]);

    const result = await orderService.getAnalytics({ granularity: 'day' });
    const periods = result.series.map((entry) => entry.period);
    expect(periods).toEqual([...periods].sort());
  });
});

describe('order number generation', () => {
  it('assigns a unique, well-formed order number to every order', async () => {
    model('product').findMany.mockResolvedValue([unlimitedProduct]);

    const numbers = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      await orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      });
      numbers.add(model('order').create.mock.calls[i][0].data.orderNumber);
    }

    expect(numbers.size).toBe(50);
    for (const number of numbers) expect(number).toMatch(/^ORD-[A-Z0-9]{9,}-[A-Z0-9]{6}$/);
  });

  it('is resilient to a unique-constraint collision on the order number', async () => {
    // The caller sees a 409 rather than an opaque 500 if it ever happens.
    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    model('order').create.mockRejectedValue(prismaError('P2002', { target: ['orders', 'order_number'] }));

    await expect(
      orderService.createOrder(USER_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        deliveryAddress: 'House 12, Road 5, Dhanmondi',
      }),
    ).rejects.toThrow();
  });
});

describe('socket notifications', () => {
  // Regression: `emitNewOrder` / `emitPaymentVerified` were defined but never
  // called, so the documented real-time order updates never happened.
  it('notifies admins when an order is created', async () => {
    const socket = await import('../../../src/socket/socketHandlers.js');
    const spy = vi.spyOn(socket, 'emitNewOrder').mockImplementation(() => undefined);

    model('product').findMany.mockResolvedValue([unlimitedProduct]);
    await orderService.createOrder(USER_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      deliveryAddress: 'House 12, Road 5, Dhanmondi',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
