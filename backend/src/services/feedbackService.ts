import prisma from '../config/database.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';
import { buildPagination, normalizeLimit, normalizePage, offsetFor } from '../utils/pagination.js';
import { FEEDBACK_STATUS } from '../utils/constants.js';

/**
 * Customer feedback.
 *
 * The `CustomerFeedback` model and the whole admin review/reply surface already
 * existed, but there was no customer-facing endpoint to create a record — so the
 * feature was unreachable. This closes the loop.
 */
export class FeedbackService {
  async create(
    userId: string,
    data: { subject: string; message: string; category?: string; orderId?: string },
  ) {
    // The order is verified to belong to the caller *and* persisted — the column
    // used to be missing, so support staff never knew which order a complaint
    // referred to.
    let orderId: string | null = null;
    if (data.orderId) {
      const order = await prisma.order.findFirst({
        where: { id: data.orderId, userId },
        select: { id: true },
      });
      if (!order) throw new NotFoundError('Order');
      orderId = order.id as string;
    }

    // Simple abuse brake: one open ticket per subject per user.
    const duplicate = await prisma.customerFeedback.findFirst({
      where: {
        userId,
        subject: { equals: data.subject.trim(), mode: 'insensitive' },
        status: FEEDBACK_STATUS.OPEN,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError('You already have an open ticket with this subject', 409);
    }

    return prisma.customerFeedback.create({
      data: {
        userId,
        subject: data.subject.trim(),
        message: data.message.trim(),
        category: data.category ?? 'OTHER',
        status: FEEDBACK_STATUS.OPEN,
        orderId,
      },
      include: { order: { select: { id: true, orderNumber: true, totalAmount: true } } },
    });
  }

  async listForUser(userId: string, pageInput?: unknown, limitInput?: unknown) {
    const page = normalizePage(pageInput);
    const limit = normalizeLimit(limitInput, 10);
    const where = { userId };

    const [feedbacks, total] = await Promise.all([
      prisma.customerFeedback.findMany({
        where,
        skip: offsetFor(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customerFeedback.count({ where }),
    ]);

    return { feedbacks, pagination: buildPagination(total, page, limit) };
  }

  async getForUser(userId: string, feedbackId: string) {
    const feedback = await prisma.customerFeedback.findFirst({ where: { id: feedbackId, userId } });
    if (!feedback) throw new NotFoundError('Feedback');
    return feedback;
  }
}

export const feedbackService = new FeedbackService();
