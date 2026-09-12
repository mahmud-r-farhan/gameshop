import prisma, { type PrismaTx } from '../config/database.js';
import { AppError, ConflictError, NotFoundError } from '../middleware/errorHandler.js';
import { buildPagination, normalizeLimit, normalizePage, offsetFor } from '../utils/pagination.js';
import { ORDER_STATUS } from '../utils/constants.js';

export class ReviewService {
  /**
   * Create a review for a delivered order.
   *
   * Purchase verification and the duplicate check happen inside the transaction
   * so two rapid submissions cannot both slip past the `findUnique` guard (the
   * compound unique index is the final backstop).
   */
  async create(userId: string, productId: string, orderId: string, rating: number, comment?: string) {
    try {
      return await prisma.$transaction(async (tx: PrismaTx) => {
        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            userId,
            orderStatus: ORDER_STATUS.DELIVERED,
            items: { some: { productId } },
          },
          select: { id: true },
        });

        if (!order) {
          throw new AppError(
            'You can only review products you have purchased and that have been delivered',
            403,
          );
        }

        const existing = await tx.review.findUnique({
          where: { userId_productId_orderId: { userId, productId, orderId } },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictError('You have already reviewed this product from this order');
        }

        return tx.review.create({
          data: {
            userId,
            productId,
            orderId,
            rating,
            comment: comment?.trim() ? comment.trim() : null,
            isVerifiedPurchase: true,
          },
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('You have already reviewed this product from this order');
      }
      if (isRecordNotFound(error)) {
        throw new NotFoundError('Product or order');
      }
      throw error;
    }
  }

  async getProductReviews(
    productId: string,
    pageInput?: unknown,
    limitInput?: unknown,
    options: { sort?: string; rating?: number } = {},
  ) {
    const page = normalizePage(pageInput);
    const limit = normalizeLimit(limitInput, 10);

    const where: Record<string, unknown> = { productId };
    if (options.rating) where.rating = options.rating;

    const orderBy = buildReviewOrderBy(options.sort ?? 'newest');

    const [reviews, total, aggregation] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy,
        skip: offsetFor(page, limit),
        take: limit,
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      reviews,
      averageRating: Math.round((aggregation._avg.rating ?? 0) * 10) / 10,
      totalReviews: aggregation._count.rating,
      distribution: await this.getRatingDistribution(productId),
      pagination: buildPagination(total, page, limit),
    };
  }

  /** Always returns keys 1..5 so charts do not have to special-case gaps. */
  async getRatingDistribution(productId: string): Promise<Record<number, number>> {
    const distribution = await prisma.review.groupBy({
      by: ['rating'],
      where: { productId },
      _count: { _all: true },
    });

    const result: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of distribution as any[]) {
      if (row.rating >= 1 && row.rating <= 5) {
        result[row.rating] = row._count?._all ?? row._count ?? 0;
      }
    }
    return result;
  }

  /** Increment the "was this helpful?" counter. */
  async markHelpful(reviewId: string) {
    try {
      // `await` matters here: without it the rejected promise escapes this
      // try/catch entirely and a missing review surfaces as a 500 instead of a
      // 404.
      return await prisma.review.update({
        where: { id: reviewId },
        data: { helpfulCount: { increment: 1 } },
        select: { id: true, helpfulCount: true },
      });
    } catch (error) {
      if (isRecordNotFound(error)) throw new NotFoundError('Review');
      throw error;
    }
  }

  /** Admin moderation: remove an abusive review. */
  async delete(reviewId: string) {
    try {
      await prisma.review.delete({ where: { id: reviewId } });
      return { message: 'Review removed' };
    } catch (error) {
      if (isRecordNotFound(error)) throw new NotFoundError('Review');
      throw error;
    }
  }
}

function buildReviewOrderBy(sort: string): Record<string, string> {
  switch (sort) {
    case 'oldest':
      return { createdAt: 'asc' };
    case 'highest':
      return { rating: 'desc', createdAt: 'desc' };
    case 'lowest':
      return { rating: 'asc', createdAt: 'desc' };
    case 'helpful':
      return { helpfulCount: 'desc', createdAt: 'desc' };
    case 'newest':
    default:
      return { createdAt: 'desc' };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

function isRecordNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2025';
}

export const reviewService = new ReviewService();
