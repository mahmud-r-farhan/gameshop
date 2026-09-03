import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateOrderNumber, calculateDiscount } from '../utils/helpers.js';

export class OrderService {
  async createOrder(userId: string, items: { productId: string; quantity: number }[], promoCode?: string, deliveryAddress?: string, deliveryInstructions?: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let promoData = null;
      if (promoCode) {
        promoData = await tx.promotion.findUnique({ where: { code: promoCode } });
        if (!promoData || !promoData.isActive) {
          throw new AppError('Invalid promo code', 400);
        }
        if (promoData.validUntil < new Date()) {
          throw new AppError('Promo code has expired', 400);
        }
        if (promoData.maxUsage && promoData.usedCount >= promoData.maxUsage) {
          throw new AppError('Promo code has reached maximum usage', 400);
        }
      }

      let subtotal = 0;
      const orderItems: any[] = [];

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || !product.isAvailable) {
          throw new AppError(`Product ${product?.name || 'unknown'} is not available`, 400);
        }
        const itemTotal = Number(product.price) * item.quantity;
        subtotal += itemTotal;
        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
          productName: product.name,
        });
      }

      let discountAmount = 0;
      if (promoData) {
        if (promoData.minPurchaseAmount && subtotal < Number(promoData.minPurchaseAmount)) {
          throw new AppError(`Minimum purchase amount is ${promoData.minPurchaseAmount}`, 400);
        }
        discountAmount = calculateDiscount(subtotal, promoData.discountType, Number(promoData.discountValue));

        await tx.promotion.update({
          where: { id: promoData.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      const totalAmount = subtotal - discountAmount;
      const orderNumber = generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          items: { create: orderItems },
          subtotal,
          discountAmount,
          totalAmount,
          deliveryAddress: deliveryAddress || 'Address pending',
          deliveryInstructions,
          promoId: promoData?.id,
          promoCode,
          paymentStatus: 'PENDING',
          orderStatus: 'PENDING',
          deliveryStatus: 'WAITING',
          statusHistory: {
            create: {
              statusType: 'order_status',
              newStatus: 'PENDING',
              changedBy: userId,
            },
          },
        },
        include: { items: true },
      });

      return order;
    });
  }

  async getUserOrders(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: true,
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    return {
      orders,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total, itemsPerPage: limit },
    };
  }

  async getOrderById(orderId: string, userId?: string) {
    const where: any = { id: orderId };
    if (userId) where.userId = userId;

    const order = await prisma.order.findFirst({
      where,
      include: {
        items: { include: { product: { select: { name: true, thumbnailUrl: true } } } },
        payments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) throw new AppError('Order not found', 404);
    return order;
  }

  async getAllOrders(params: { status?: string; paymentStatus?: string; page?: number; limit?: number; search?: string }) {
    const { status, paymentStatus, page = 1, limit = 20, search } = params;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) where.orderStatus = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: true,
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          payments: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total, itemsPerPage: limit },
    };
  }

  async updateOrderStatus(orderId: string, status: string, userId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found', 404);

    const updateData: any = {};
    if (status === 'DELIVERED') {
      updateData.orderStatus = 'DELIVERED';
      updateData.deliveryStatus = 'DELIVERED';
      updateData.deliveredAt = new Date();
    } else {
      updateData.orderStatus = status;
    }

    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        statusType: 'order_status',
        oldStatus: order.orderStatus,
        newStatus: status,
        changedBy: userId,
      },
    });

    return prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { items: true },
    });
  }

  async verifyPayment(orderId: string, transactionId: string, verifiedBy: string, note?: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found', 404);

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'VERIFIED',
        transactionId,
        paymentVerifiedBy: verifiedBy,
        paymentVerifiedAt: new Date(),
        orderStatus: 'PROCESSING',
      },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        statusType: 'payment_status',
        oldStatus: order.paymentStatus,
        newStatus: 'VERIFIED',
        changedBy: verifiedBy,
        reason: note,
      },
    });

    return updated;
  }

  async submitPayment(orderId: string, userId: string, transactionId: string, paymentMethod: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new AppError('Order not found', 404);

    const payment = await prisma.payment.create({
      data: {
        orderId,
        userId,
        amount: order.totalAmount,
        paymentMethod,
        transactionId,
        status: 'PENDING',
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'PENDING_VERIFICATION', transactionId, paymentMethod },
    });

    return payment;
  }

  async getDashboardStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const getStats = async (startDate: Date) => {
      const where = { createdAt: { gte: startDate } };
      const [orders, payments] = await Promise.all([
        prisma.order.findMany({ where, select: { totalAmount: true, paymentStatus: true, orderStatus: true, deliveryStatus: true } }),
        prisma.payment.findMany({ where: { createdAt: { gte: startDate } }, select: { paymentMethod: true, amount: true, status: true } }),
      ]);

      const totalOrders = orders.length;
      const totalRevenue = orders
        .filter((o: any) => o.paymentStatus === 'VERIFIED')
        .reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
      const pendingPayments = orders.filter((o: any) => o.paymentStatus === 'PENDING' || o.paymentStatus === 'PENDING_VERIFICATION').length;
      const deliveredOrders = orders.filter((o: any) => o.deliveryStatus === 'DELIVERED').length;

      const paymentMethods: Record<string, number> = {};
      payments.forEach((p: any) => {
        const method = p.paymentMethod.toLowerCase();
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;
      });

      return { totalOrders, totalRevenue, pendingPayments, deliveredOrders, paymentMethods };
    };

    const [today, weekly, monthly] = await Promise.all([
      getStats(startOfDay),
      getStats(startOfWeek),
      getStats(startOfMonth),
    ]);

    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    return {
      today,
      weekly,
      monthly,
      topProducts: topProducts.map((p: any) => ({
        name: p.productName,
        sales: p._sum.quantity || 0,
      })),
    };
  }
}

export const orderService = new OrderService();
