import prisma, { type PrismaTx } from '../config/database.js';
import { AppError, ConflictError, NotFoundError } from '../middleware/errorHandler.js';
import { generateOrderNumber } from '../utils/helpers.js';
import {
  calculateDiscountCents,
  computeTotalCents,
  fromCents,
  toCents,
  toDecimalString,
  type MoneyInput,
} from '../utils/money.js';
import { buildPagination, normalizeLimit, normalizePage, offsetFor } from '../utils/pagination.js';
import {
  DELIVERY_STATUS,
  ORDER_STATUS,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS,
  STATUS_TYPE,
  UNLIMITED_STOCK,
} from '../utils/constants.js';
import { emitNewOrder, emitOrderUpdate, emitPaymentVerified } from '../socket/socketHandlers.js';
import { ordersCreatedTotal, paymentsVerifiedTotal } from '../config/metrics.js';

/** Shape accepted by `createOrder` after Zod validation. */
export interface NewOrderItem {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  items: NewOrderItem[];
  promoCode?: string;
  deliveryAddress?: string;
  deliveryInstructions?: string;
}

/** Minimal projection of `Product` used while pricing an order. */
interface ProductRow {
  id: string;
  name: string;
  price: MoneyInput;
  isAvailable: boolean;
  quantityAvailable: number | null;
}

/** Shape returned by `review.groupBy` / `orderItem.groupBy`. */
interface GroupedRow {
  [key: string]: unknown;
}

interface PricedItem {
  productId: string;
  quantity: number;
  unitPriceCents: number;
  productName: string;
}

interface PromotionRecord {
  id: string;
  code: string;
  discountType: string;
  discountValue: unknown;
  minPurchaseAmount: unknown;
  maxUsage: number | null;
  applicableProducts: Array<{ id: string }>;
}

export class OrderService {
  /**
   * Create an order.
   *
   * Everything — product availability, stock reservation, promotion validation
   * and usage accounting — happens inside one transaction, so a failure cannot
   * leave a half-written order or a consumed coupon behind.
   */
  async createOrder(userId: string, input: CreateOrderInput) {
    const { items, promoCode, deliveryAddress, deliveryInstructions } = input;

    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError('An order must contain at least one item', 400);
    }

    const order = await prisma.$transaction(async (tx: PrismaTx) => {
      const now = new Date();

      // ── 1. Load and validate products ────────────────────────────────────
      const productIds = items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          price: true,
          isAvailable: true,
          quantityAvailable: true,
        },
      });

      const byId = new Map<string, ProductRow>(
        (products as unknown as ProductRow[]).map((product) => [product.id, product]),
      );
      const missing = productIds.find((id) => !byId.has(id));
      if (missing) {
        throw new NotFoundError('One or more products in your cart no longer exist');
      }

      const pricedItems: PricedItem[] = [];
      for (const item of items) {
        const product = byId.get(item.productId)!;
        if (!product.isAvailable) {
          throw new AppError(`${product.name} is not available`, 409);
        }
        pricedItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPriceCents: toCents(product.price),
          productName: product.name,
        });
      }

      // ── 2. Reserve stock atomically ──────────────────────────────────────
      for (const item of pricedItems) {
        const product = byId.get(item.productId)!;
        const quantityAvailable = product.quantityAvailable ?? UNLIMITED_STOCK;

        if (quantityAvailable === UNLIMITED_STOCK) continue;

        // Guarded decrement: Postgres re-evaluates the predicate against the
        // latest committed row while holding the row lock, so two concurrent
        // checkouts can never both succeed past the last unit.
        const reserved = await tx.product.updateMany({
          where: {
            id: item.productId,
            isAvailable: true,
            quantityAvailable: { gte: item.quantity },
          },
          data: { quantityAvailable: { decrement: item.quantity } },
        });

        if (reserved.count === 0) {
          throw new ConflictError(
            `Insufficient stock for ${product.name} (requested ${item.quantity})`,
          );
        }
      }

      // ── 3. Promotion ─────────────────────────────────────────────────────
      const subtotalCents = pricedItems.reduce(
        (sum, item) => sum + item.unitPriceCents * item.quantity,
        0,
      );

      let promotion: PromotionRecord | null = null;
      let discountCents = 0;

      if (promoCode) {
        promotion = await this.resolvePromotion(tx, promoCode, now, productIds, subtotalCents);
        discountCents = calculateDiscountCents(
          subtotalCents,
          promotion.discountType,
          Number(promotion.discountValue),
        );

        // Atomic usage accounting — the previous read-then-write allowed a
        // limited coupon to be redeemed far beyond `maxUsage` under load.
        const usageGuard: Record<string, unknown> = {
          id: promotion.id,
          isActive: true,
          usedCount: promotion.maxUsage === null ? undefined : { lt: promotion.maxUsage },
        };

        const consumed = await tx.promotion.updateMany({
          where: usageGuard,
          data: { usedCount: { increment: 1 } },
        });

        if (consumed.count === 0) {
          throw new ConflictError('Promo code has reached maximum usage');
        }
      }

      // A discount can never push the total below zero: a ৳5000 fixed coupon on
      // a ৳100 basket used to create an order the shop would "pay" for.
      const totalCents = computeTotalCents(subtotalCents, discountCents, 0);

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(now),
          userId,
          items: {
            create: pricedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: toDecimalString(item.unitPriceCents),
              productName: item.productName,
            })),
          },
          subtotal: toDecimalString(subtotalCents),
          discountAmount: toDecimalString(discountCents),
          taxAmount: toDecimalString(0),
          totalAmount: toDecimalString(totalCents),
          deliveryAddress: deliveryAddress?.trim() || 'Address pending',
          deliveryInstructions: deliveryInstructions?.trim() || null,
          promoId: promotion?.id ?? null,
          promoCode: promotion?.code ?? null,
          paymentStatus: PAYMENT_STATUS.PENDING,
          orderStatus: ORDER_STATUS.PENDING,
          deliveryStatus: DELIVERY_STATUS.WAITING,
          statusHistory: {
            create: {
              statusType: STATUS_TYPE.ORDER,
              oldStatus: null,
              newStatus: ORDER_STATUS.PENDING,
              changedBy: userId,
              reason: 'Order placed',
            },
          },
        },
        include: { items: true },
      });

      return created;
    });

    ordersCreatedTotal.inc();
    emitNewOrder(order);

    return order;
  }

  /**
   * Validate a promotion against the current basket.
   *
   * Adds the checks the previous implementation was missing: `validFrom` (a
   * coupon scheduled for next month was usable today) and `applicableProducts`
   * (a coupon scoped to one product discounted the entire cart).
   */
  private async resolvePromotion(
    tx: any,
    promoCode: string,
    now: Date,
    productIds: string[],
    subtotalCents: number,
  ): Promise<PromotionRecord> {
    const code = promoCode.trim().toUpperCase();

    const promotion = await tx.promotion.findUnique({
      where: { code },
      include: { applicableProducts: { select: { id: true } } },
    });

    if (!promotion || !promotion.isActive) {
      throw new AppError('Invalid promo code', 400);
    }
    if (promotion.validFrom > now) {
      throw new AppError('Promo code is not active yet', 400);
    }
    if (promotion.validUntil < now) {
      throw new AppError('Promo code has expired', 400);
    }
    if (promotion.maxUsage !== null && promotion.usedCount >= promotion.maxUsage) {
      throw new AppError('Promo code has reached maximum usage', 400);
    }

    const scoped = (promotion.applicableProducts ?? []) as Array<{ id: string }>;
    if (scoped.length > 0) {
      const eligible = productIds.filter((id) => scoped.some((product) => product.id === id));
      if (eligible.length === 0) {
        throw new AppError('Promo code does not apply to the products in your cart', 400);
      }
    }

    if (promotion.minPurchaseAmount !== null) {
      const minimumCents = toCents(promotion.minPurchaseAmount);
      if (subtotalCents < minimumCents) {
        throw new AppError(
          `Minimum purchase amount for this promo code is ${fromCents(minimumCents).toFixed(2)}`,
          400,
        );
      }
    }

    return promotion as PromotionRecord;
  }

  async getUserOrders(userId: string, pageInput?: unknown, limitInput?: unknown) {
    const page = normalizePage(pageInput);
    const limit = normalizeLimit(limitInput, 10);
    const where = { userId };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offsetFor(page, limit),
        take: limit,
        include: {
          items: { include: { product: { select: { id: true, thumbnailUrl: true } } } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, pagination: buildPagination(total, page, limit) };
  }

  /**
   * Fetch one order.
   *
   * `viewerId` scopes the lookup to the owner *unless* the viewer is an
   * administrator. The previous code always scoped by `userId`, so the admin
   * panel's order-detail view returned 404 for every order in the system.
   */
  async getOrderById(orderId: string, viewer?: { id: string; role: string }) {
    const isAdmin = viewer?.role === 'ADMIN' || viewer?.role === 'SUPER_ADMIN';
    const where: Record<string, unknown> = isAdmin ? { id: orderId } : { id: orderId, userId: viewer?.id };

    const order = await prisma.order.findFirst({
      where,
      include: {
        items: { include: { product: { select: { id: true, name: true, thumbnailUrl: true } } } },
        payments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        user: isAdmin
          ? { select: { id: true, fullName: true, email: true, phone: true } }
          : false,
        promotion: { select: { code: true, discountType: true, discountValue: true } },
      },
    });

    if (!order) throw new NotFoundError('Order');
    return order;
  }

  async getAllOrders(params: {
    status?: string;
    paymentStatus?: string;
    page?: unknown;
    limit?: unknown;
    search?: string;
  }) {
    const page = normalizePage(params.page);
    const limit = normalizeLimit(params.limit);
    const where: Record<string, unknown> = {};

    if (params.status) where.orderStatus = params.status;
    if (params.paymentStatus) where.paymentStatus = params.paymentStatus;
    if (params.search) {
      where.OR = [
        { orderNumber: { contains: params.search, mode: 'insensitive' } },
        { transactionId: { contains: params.search, mode: 'insensitive' } },
        { user: { fullName: { contains: params.search, mode: 'insensitive' } } },
        { user: { email: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offsetFor(page, limit),
        take: limit,
        include: {
          items: true,
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, pagination: buildPagination(total, page, limit) };
  }

  /**
   * Move an order to a new status.
   *
   * Transitions are validated against `ORDER_STATUS_TRANSITIONS` (a delivered
   * order can no longer be flipped back to pending), the history row and the
   * order row are written in one transaction, reserved stock is released when an
   * order is cancelled, and the customer is notified over the socket.
   */
  async updateOrderStatus(
    orderId: string,
    status: string,
    changedBy: string,
    reason?: string,
  ) {
    const nextStatus = String(status).toUpperCase();

    if (!ORDER_STATUS_TRANSITIONS[nextStatus]) {
      throw new AppError(
        `Invalid status. Expected one of: ${Object.keys(ORDER_STATUS_TRANSITIONS).join(', ')}`,
        400,
      );
    }

    const updated = await prisma.$transaction(async (tx: PrismaTx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { select: { productId: true, quantity: true } } },
      });
      if (!order) throw new NotFoundError('Order');

      const allowed = ORDER_STATUS_TRANSITIONS[order.orderStatus] ?? [];
      if (order.orderStatus === nextStatus) {
        throw new ConflictError(`Order is already ${nextStatus}`);
      }
      if (!allowed.includes(nextStatus)) {
        throw new AppError(
          `Cannot change order status from ${order.orderStatus} to ${nextStatus}`,
          409,
        );
      }

      const data: Record<string, unknown> = { orderStatus: nextStatus };

      if (nextStatus === ORDER_STATUS.DELIVERED) {
        data.deliveryStatus = DELIVERY_STATUS.DELIVERED;
        data.deliveredAt = new Date();
      } else if (nextStatus === ORDER_STATUS.PROCESSING) {
        data.deliveryStatus = DELIVERY_STATUS.PROCESSING;
      }

      // Release reserved stock so the units can be sold again.
      if (nextStatus === ORDER_STATUS.CANCELLED) {
        for (const item of order.items) {
          await tx.product.updateMany({
            where: { id: item.productId, quantityAvailable: { not: UNLIMITED_STOCK } },
            data: { quantityAvailable: { increment: item.quantity } },
          });
        }
        if (order.promoId) {
          await tx.promotion.updateMany({
            where: { id: order.promoId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          statusType: STATUS_TYPE.ORDER,
          oldStatus: order.orderStatus,
          newStatus: nextStatus,
          changedBy,
          reason: reason ?? null,
        },
      });

      return tx.order.update({
        where: { id: orderId },
        data,
        include: { items: true },
      });
    });

    emitOrderUpdate(updated.userId, updated);
    return updated;
  }

  /**
   * Record a customer's manual payment submission.
   *
   * Now transactional, idempotent-safe and guarded against re-submitting on an
   * order that is already verified or cancelled. `Payment.transactionId` is
   * unique, so a reused gateway reference previously produced a raw 500.
   */
  async submitPayment(
    orderId: string,
    userId: string,
    transactionId: string,
    paymentMethod: string,
    extras: { paymentProofUrl?: string; amount?: number } = {},
  ) {
    const method = String(paymentMethod).toUpperCase();
    if (!PAYMENT_METHOD_VALUES.includes(method)) {
      throw new AppError(
        `Payment method must be one of: ${PAYMENT_METHOD_VALUES.join(', ')}`,
        400,
      );
    }

    const reference = transactionId.trim();

    return prisma.$transaction(async (tx: PrismaTx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, userId } });
      if (!order) throw new NotFoundError('Order');

      if (order.paymentStatus === PAYMENT_STATUS.VERIFIED) {
        throw new ConflictError('Payment for this order has already been verified');
      }
      if (order.orderStatus === ORDER_STATUS.CANCELLED) {
        throw new ConflictError('This order has been cancelled');
      }

      if (extras.amount !== undefined) {
        const submitted = toCents(extras.amount);
        const expected = toCents(order.totalAmount);
        if (submitted !== expected) {
          throw new AppError(
            `Submitted amount (${fromCents(submitted).toFixed(2)}) does not match the order total (${fromCents(expected).toFixed(2)})`,
            400,
          );
        }
      }

      const duplicate = await tx.payment.findFirst({ where: { transactionId: reference } });
      if (duplicate) {
        throw new ConflictError('This transaction ID has already been submitted');
      }

      const payment = await tx.payment.create({
        data: {
          orderId,
          userId,
          amount: order.totalAmount,
          paymentMethod: method,
          transactionId: reference,
          paymentProofUrl: extras.paymentProofUrl ?? null,
          status: 'PENDING',
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PAYMENT_STATUS.PENDING_VERIFICATION,
          transactionId: reference,
          paymentMethod: method,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          statusType: STATUS_TYPE.PAYMENT,
          oldStatus: order.paymentStatus,
          newStatus: PAYMENT_STATUS.PENDING_VERIFICATION,
          changedBy: userId,
          reason: `Payment submitted via ${method} (ref ${reference})`,
        },
      });

      return payment;
    });
  }

  /**
   * Verify a customer payment.
   *
   * Idempotent: re-verifying an already-verified order returns the current state
   * instead of double-counting revenue, and the payment row, order row and
   * history entry are written together.
   */
  async verifyPayment(orderId: string, transactionId: string, verifiedBy: string, note?: string) {
    const result = await prisma.$transaction(async (tx: PrismaTx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { payments: { orderBy: { createdAt: 'desc' } } },
      });
      if (!order) throw new NotFoundError('Order');

      if (order.orderStatus === ORDER_STATUS.CANCELLED) {
        throw new ConflictError('Cannot verify payment on a cancelled order');
      }

      if (order.paymentStatus === PAYMENT_STATUS.VERIFIED) {
        return { order, alreadyVerified: true as const };
      }

      const reference = transactionId?.trim() || order.transactionId;
      if (!reference) {
        throw new AppError('A transaction ID is required to verify a payment', 400);
      }

      const now = new Date();

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PAYMENT_STATUS.VERIFIED,
          transactionId: reference,
          paymentVerifiedBy: verifiedBy,
          paymentVerifiedAt: now,
          paymentCompletedAt: now,
          orderStatus:
            order.orderStatus === ORDER_STATUS.PENDING ? ORDER_STATUS.PROCESSING : order.orderStatus,
          deliveryStatus:
            order.deliveryStatus === DELIVERY_STATUS.WAITING
              ? DELIVERY_STATUS.PROCESSING
              : order.deliveryStatus,
        },
        include: { items: true },
      });

      // Reconcile the payment ledger so the admin Payments view reflects reality.
      if (order.payments.length > 0) {
        await tx.payment.updateMany({
          where: { orderId, status: { not: 'VERIFIED' } },
          data: {
            status: 'VERIFIED',
            verifiedBy,
            verifiedAt: now,
            verificationNote: note ?? null,
            transactionId: order.payments[0].transactionId ?? reference,
          },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          statusType: STATUS_TYPE.PAYMENT,
          oldStatus: order.paymentStatus,
          newStatus: PAYMENT_STATUS.VERIFIED,
          changedBy: verifiedBy,
          reason: note ?? null,
        },
      });

      return { order: updated, alreadyVerified: false as const };
    });

    if (!result.alreadyVerified) {
      paymentsVerifiedTotal.inc();
      emitPaymentVerified(result.order.userId, result.order.id);
      emitOrderUpdate(result.order.userId, result.order);
    }

    return result.order;
  }

  /**
   * Mark a payment as failed / rejected.
   *
   * Previously an admin could only move a payment forward; there was no way to
   * reject a bogus transaction ID, so fraudulent submissions sat in
   * `PENDING_VERIFICATION` forever.
   */
  async rejectPayment(orderId: string, verifiedBy: string, reason?: string) {
    return prisma.$transaction(async (tx: PrismaTx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundError('Order');
      if (order.paymentStatus === PAYMENT_STATUS.VERIFIED) {
        throw new ConflictError('Payment has already been verified');
      }

      await tx.payment.updateMany({
        where: { orderId, status: { not: 'VERIFIED' } },
        data: { status: 'FAILED', verifiedBy, verifiedAt: new Date(), verificationNote: reason ?? null },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          statusType: STATUS_TYPE.PAYMENT,
          oldStatus: order.paymentStatus,
          newStatus: PAYMENT_STATUS.FAILED,
          changedBy: verifiedBy,
          reason: reason ?? null,
        },
      });

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: PAYMENT_STATUS.FAILED },
        include: { items: true },
      });

      emitOrderUpdate(updated.userId, updated);
      return updated;
    });
  }

  /**
   * Dashboard KPIs.
   *
   * The previous implementation loaded *every* order and payment row since the
   * start of each period into Node and filtered them in JavaScript — three times
   * over, since the periods overlap. This pushes the work into Postgres
   * aggregates, so memory use is constant regardless of order volume.
   */
  async getDashboardStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, weekly, monthly, topProducts, statusCounts, lowStock] = await Promise.all([
      this.periodStats(startOfDay),
      this.periodStats(startOfWeek),
      this.periodStats(startOfMonth),
      this.topProducts(startOfMonth),
      prisma.order.groupBy({ by: ['orderStatus'], _count: { _all: true } }),
      prisma.product.count({
        where: {
          isAvailable: true,
          quantityAvailable: { not: UNLIMITED_STOCK, lte: 5 },
        },
      }),
    ]);

    return {
      today,
      weekly,
      monthly,
      topProducts,
      ordersByStatus: Object.fromEntries(
        statusCounts.map((row: any) => [row.orderStatus, row._count._all]),
      ),
      lowStockProducts: lowStock,
    };
  }

  private async periodStats(since: Date) {
    const [orderAgg, verifiedAgg, pendingCount, deliveredCount, methodGroups] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: since }, paymentStatus: PAYMENT_STATUS.VERIFIED },
        _sum: { totalAmount: true },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: since },
          paymentStatus: { in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PENDING_VERIFICATION] },
        },
      }),
      prisma.order.count({
        where: { createdAt: { gte: since }, deliveryStatus: DELIVERY_STATUS.DELIVERED },
      }),
      prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    const paymentMethods: Record<string, number> = {};
    const paymentVolume: Record<string, number> = {};
    for (const row of methodGroups as any[]) {
      const key = String(row.paymentMethod).toLowerCase();
      paymentMethods[key] = row._count._all;
      paymentVolume[key] = fromCents(toCents(row._sum.amount ?? 0));
    }

    return {
      totalOrders: orderAgg._count._all,
      totalRevenue: fromCents(toCents(verifiedAgg._sum.totalAmount ?? 0)),
      pendingPayments: pendingCount,
      deliveredOrders: deliveredCount,
      paymentMethods,
      paymentVolume,
    };
  }

  private async topProducts(since: Date, take = 5) {
    const rows = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: { order: { createdAt: { gte: since }, orderStatus: { not: ORDER_STATUS.CANCELLED } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take,
    });

    return (rows as any[]).map((row) => ({
      id: row.productId,
      name: row.productName ?? 'Unknown product',
      sales: row._sum.quantity ?? 0,
    }));
  }

  /** Daily revenue/order series for the admin analytics chart. */
  async getAnalytics({ from, to, granularity = 'day' }: { from?: Date; to?: Date; granularity?: string }) {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true, totalAmount: true, paymentStatus: true, orderStatus: true },
    });

    const buckets = new Map<string, { orders: number; revenue: number; cancelled: number }>();

    for (const order of orders) {
      const key = bucketKey(order.createdAt, granularity);
      const bucket = buckets.get(key) ?? { orders: 0, revenue: 0, cancelled: 0 };
      bucket.orders += 1;
      if (order.orderStatus === ORDER_STATUS.CANCELLED) bucket.cancelled += 1;
      if (order.paymentStatus === PAYMENT_STATUS.VERIFIED) {
        bucket.revenue = fromCents(toCents(bucket.revenue) + toCents(order.totalAmount));
      }
      buckets.set(key, bucket);
    }

    return {
      granularity,
      from: start.toISOString(),
      to: end.toISOString(),
      series: Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, value]) => ({ period, ...value })),
    };
  }
}

function bucketKey(date: Date, granularity: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (granularity === 'month') return `${year}-${month}`;
  if (granularity === 'week') {
    const copy = new Date(date);
    copy.setDate(copy.getDate() - copy.getDay());
    return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}`;
  }
  return `${year}-${month}-${String(date.getDate()).padStart(2, '0')}`;
}

export const orderService = new OrderService();
