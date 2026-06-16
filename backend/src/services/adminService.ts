import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

export class AdminService {
  // Payment Gateway Management
  async getPaymentGateways() {
    return prisma.paymentGateway.findMany({ orderBy: { displayOrder: 'asc' } });
  }

  async createPaymentGateway(data: {
    gatewayName: string;
    gatewayType?: string;
    accountIdentifier?: string;
    accountHolderName?: string;
    instructions?: string;
    qrCodeUrl?: string;
    displayOrder?: number;
  }) {
    return prisma.paymentGateway.create({ data });
  }

  async updatePaymentGateway(id: string, data: any) {
    const gateway = await prisma.paymentGateway.findUnique({ where: { id } });
    if (!gateway) throw new AppError('Payment gateway not found', 404);
    return prisma.paymentGateway.update({ where: { id }, data });
  }

  async deletePaymentGateway(id: string) {
    await prisma.paymentGateway.delete({ where: { id } });
    return { message: 'Payment gateway deleted' };
  }

  // Promotion Management
  async createPromotion(data: {
    code: string;
    description?: string;
    discountType: string;
    discountValue: number;
    validFrom: string;
    validUntil: string;
    maxUsage?: number;
    minPurchaseAmount?: number;
    applicableProductIds?: string[];
    createdBy: string;
  }) {
    const existing = await prisma.promotion.findUnique({ where: { code: data.code } });
    if (existing) throw new AppError('Promotion code already exists', 409);

    return prisma.promotion.create({
      data: {
        code: data.code.toUpperCase(),
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
        maxUsage: data.maxUsage,
        minPurchaseAmount: data.minPurchaseAmount,
        createdBy: data.createdBy,
        applicableProducts: data.applicableProductIds ? {
          connect: data.applicableProductIds.map(id => ({ id })),
        } : undefined,
      },
    });
  }

  async getPromotions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [promotions, total] = await Promise.all([
      prisma.promotion.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { orders: true } } },
      }),
      prisma.promotion.count(),
    ]);
    return { promotions, pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total, itemsPerPage: limit } };
  }

  async togglePromotion(id: string) {
    const promo = await prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new AppError('Promotion not found', 404);
    return prisma.promotion.update({ where: { id }, data: { isActive: !promo.isActive } });
  }

  // Customer Feedback
  async getFeedback(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [feedbacks, total] = await Promise.all([
      prisma.customerFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.customerFeedback.count({ where }),
    ]);

    return { feedbacks, pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total, itemsPerPage: limit } };
  }

  async replyToFeedback(feedbackId: string, reply: string, repliedBy: string) {
    return prisma.customerFeedback.update({
      where: { id: feedbackId },
      data: { adminReply: reply, repliedBy, repliedAt: new Date(), status: 'RESOLVED' },
    });
  }

  // Settings
  async getSettings() {
    return prisma.adminSettings.findMany();
  }

  async updateSetting(key: string, value: any, updatedBy: string) {
    return prisma.adminSettings.upsert({
      where: { settingKey: key },
      update: { settingValue: value, updatedBy, updatedAt: new Date() },
      create: { settingKey: key, settingValue: value, updatedBy },
    });
  }

  // User Management
  async getUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, fullName: true, email: true, phone: true, role: true, isActive: true, createdAt: true, lastLogin: true, _count: { select: { orders: true } } },
      }),
      prisma.user.count({ where }),
    ]);
    return { users, pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total, itemsPerPage: limit } };
  }

  async toggleUserStatus(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    return prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
  }
}

export const adminService = new AdminService();
