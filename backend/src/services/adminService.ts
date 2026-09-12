import prisma from '../config/database.js';
import { AppError, ForbiddenError, NotFoundError } from '../middleware/errorHandler.js';
import { buildPagination, normalizeLimit, normalizePage, offsetFor } from '../utils/pagination.js';
import { normalizeSearchTerm } from '../utils/helpers.js';
import { toDecimalString, toCents } from '../utils/money.js';
import { USER_ROLES } from '../utils/constants.js';

/**
 * Admin operations.
 *
 * Every write is whitelisted. The previous implementation forwarded `req.body`
 * straight into Prisma, so a crafted request could set arbitrary columns —
 * `usedCount` on a promotion, `createdBy`, even `id`.
 */

const GATEWAY_FIELDS = [
  'gatewayName',
  'gatewayType',
  'accountIdentifier',
  'accountHolderName',
  'instructions',
  'qrCodeUrl',
  'isEnabled',
  'displayOrder',
  'settings',
] as const;

export class AdminService {
  // ── Payment gateways ───────────────────────────────────────────────────

  async getPaymentGateways(includeDisabled = true) {
    return prisma.paymentGateway.findMany({
      where: includeDisabled ? undefined : { isEnabled: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Public checkout needs the enabled gateways without admin credentials. */
  async getEnabledPaymentGateways() {
    return prisma.paymentGateway.findMany({
      where: { isEnabled: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        gatewayName: true,
        gatewayType: true,
        accountIdentifier: true,
        accountHolderName: true,
        instructions: true,
        qrCodeUrl: true,
        displayOrder: true,
      },
    });
  }

  async createPaymentGateway(data: Record<string, unknown>) {
    const payload = pick(data, GATEWAY_FIELDS);
    if (!payload.gatewayName) throw new AppError('gatewayName is required', 400);

    try {
      return await prisma.paymentGateway.create({ data: payload });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError('A gateway with this name already exists', 409);
      throw error;
    }
  }

  async updatePaymentGateway(id: string, data: Record<string, unknown>) {
    await this.assertGatewayExists(id);
    const payload = pick(data, GATEWAY_FIELDS);

    try {
      return await prisma.paymentGateway.update({ where: { id }, data: payload });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError('A gateway with this name already exists', 409);
      if (isRecordNotFound(error)) throw new NotFoundError('Payment gateway');
      throw error;
    }
  }

  async deletePaymentGateway(id: string) {
    await this.assertGatewayExists(id);
    await prisma.paymentGateway.delete({ where: { id } });
    return { message: 'Payment gateway deleted' };
  }

  private async assertGatewayExists(id: string) {
    const gateway = await prisma.paymentGateway.findUnique({ where: { id }, select: { id: true } });
    if (!gateway) throw new NotFoundError('Payment gateway');
  }

  // ── Promotions ─────────────────────────────────────────────────────────

  async createPromotion(data: Record<string, any>) {
    const code = String(data.code).trim().toUpperCase();

    const applicableProductIds: string[] | undefined = Array.isArray(data.applicableProductIds)
      ? data.applicableProductIds
      : undefined;

    // Validate the referenced products up front — an opaque Prisma connect error
    // is far harder to debug than "product X does not exist".
    if (applicableProductIds && applicableProductIds.length > 0) {
      const found = await prisma.product.count({ where: { id: { in: applicableProductIds } } });
      if (found !== applicableProductIds.length) {
        throw new AppError('One or more applicable products do not exist', 400);
      }
    }

    try {
      return await prisma.promotion.create({
        data: {
          code,
          description: data.description ?? null,
          discountType: data.discountType,
          discountValue: toDecimalString(toCents(data.discountValue)),
          validFrom: new Date(data.validFrom),
          validUntil: new Date(data.validUntil),
          maxUsage: data.maxUsage ?? null,
          minPurchaseAmount:
            data.minPurchaseAmount === undefined || data.minPurchaseAmount === null
              ? null
              : toDecimalString(toCents(data.minPurchaseAmount)),
          isActive: data.isActive ?? true,
          createdBy: data.createdBy ?? null,
          applicableProducts: applicableProductIds
            ? { connect: applicableProductIds.map((id) => ({ id })) }
            : undefined,
        },
        include: { _count: { select: { orders: true } } },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError('Promotion code already exists', 409);
      throw error;
    }
  }

  async getPromotions(pageInput?: unknown, limitInput?: unknown, activeOnly?: boolean) {
    const page = normalizePage(pageInput);
    const limit = normalizeLimit(limitInput);
    const where = activeOnly === undefined ? undefined : { isActive: activeOnly };

    const [promotions, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        skip: offsetFor(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { orders: true } },
          applicableProducts: { select: { id: true, name: true } },
        },
      }),
      prisma.promotion.count({ where }),
    ]);

    return { promotions, pagination: buildPagination(total, page, limit) };
  }

  async togglePromotion(id: string) {
    const promo = await prisma.promotion.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!promo) throw new NotFoundError('Promotion');
    return prisma.promotion.update({ where: { id }, data: { isActive: !promo.isActive } });
  }

  // ── Customer feedback ──────────────────────────────────────────────────

  async getFeedback(pageInput?: unknown, limitInput?: unknown, status?: string, category?: string) {
    const page = normalizePage(pageInput);
    const limit = normalizeLimit(limitInput);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const [feedbacks, total] = await Promise.all([
      prisma.customerFeedback.findMany({
        where,
        skip: offsetFor(page, limit),
        take: limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          order: { select: { id: true, orderNumber: true, totalAmount: true, orderStatus: true } },
          repliedByUser: { select: { id: true, fullName: true } },
        },
      }),
      prisma.customerFeedback.count({ where }),
    ]);

    return { feedbacks, pagination: buildPagination(total, page, limit) };
  }

  async replyToFeedback(feedbackId: string, reply: string, repliedBy: string, status = 'RESOLVED') {
    try {
      return await prisma.customerFeedback.update({
        where: { id: feedbackId },
        data: { adminReply: reply, repliedBy, repliedAt: new Date(), status },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      });
    } catch (error) {
      if (isRecordNotFound(error)) throw new NotFoundError('Feedback');
      throw error;
    }
  }

  // ── Settings ───────────────────────────────────────────────────────────

  async getSettings() {
    return prisma.adminSettings.findMany({ orderBy: { settingKey: 'asc' } });
  }

  async updateSetting(
    key: string,
    value: unknown,
    updatedBy: string,
    extras: { settingType?: string; description?: string } = {},
  ) {
    const data: Record<string, unknown> = {
      settingValue: (value ?? null) as any,
      updatedBy,
    };
    if (extras.settingType) data.settingType = extras.settingType;
    if (extras.description) data.description = extras.description;

    return prisma.adminSettings.upsert({
      where: { settingKey: key },
      update: data,
      create: { settingKey: key, ...data },
    });
  }

  // ── User management ────────────────────────────────────────────────────

  async getUsers(
    pageInput?: unknown,
    limitInput?: unknown,
    search?: string,
    filters: { role?: string; isActive?: boolean } = {},
  ) {
    const page = normalizePage(pageInput);
    const limit = normalizeLimit(limitInput);
    const term = normalizeSearchTerm(search);

    const where: Record<string, unknown> = {};
    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (term) {
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: offsetFor(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          lastLogin: true,
          _count: { select: { orders: true, reviews: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, pagination: buildPagination(total, page, limit) };
  }

  /**
   * Enable/disable an account.
   *
   * Guards added: an admin cannot disable themselves (which previously locked
   * them out mid-session with no way back in), and only a super admin may touch
   * another privileged account.
   */
  async toggleUserStatus(targetUserId: string, actor: { id: string; role: string }) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isActive: true, role: true },
    });
    if (!user) throw new NotFoundError('User');

    if (user.id === actor.id) {
      throw new ForbiddenError('You cannot change the status of your own account');
    }

    const targetIsPrivileged = user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.SUPER_ADMIN;
    if (targetIsPrivileged && actor.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only a super admin can change the status of an administrator');
    }
    if (user.role === USER_ROLES.SUPER_ADMIN && actor.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only a super admin can change another super admin');
    }

    return prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: !user.isActive },
      select: { id: true, fullName: true, email: true, role: true, isActive: true },
    });
  }

  /** Change a user's role. Super-admin only — this is a privilege escalation vector. */
  async updateUserRole(targetUserId: string, role: string, actor: { id: string; role: string }) {
    if (actor.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only a super admin can change roles');
    }
    if (targetUserId === actor.id) {
      throw new ForbiddenError('You cannot change your own role');
    }

    try {
      return await prisma.user.update({
        where: { id: targetUserId },
        data: { role: role as any },
        select: { id: true, fullName: true, email: true, role: true },
      });
    } catch (error) {
      if (isRecordNotFound(error)) throw new NotFoundError('User');
      throw error;
    }
  }

  // ── Payments ledger ────────────────────────────────────────────────────

  async getPayments(
    pageInput?: unknown,
    limitInput?: unknown,
    filters: { status?: string; method?: string } = {},
  ) {
    const page = normalizePage(pageInput);
    const limit = normalizeLimit(limitInput);

    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.method) where.paymentMethod = filters.method;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip: offsetFor(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { id: true, orderNumber: true, totalAmount: true } },
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, pagination: buildPagination(total, page, limit) };
  }
}

function pick<T extends Record<string, unknown>>(
  source: T,
  fields: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const value = (source as Record<string, unknown>)[field];
    if (value !== undefined) result[field] = value;
  }
  return result;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

function isRecordNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2025';
}

export const adminService = new AdminService();
