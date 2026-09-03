import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

export class ReviewService {
  async create(userId: string, productId: string, orderId: string, rating: number, comment?: string) {
    // Verify the user actually purchased this product
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        orderStatus: 'DELIVERED',
        items: { some: { productId } },
      },
    });

    if (!order) {
      throw new AppError('You can only review products you have purchased and received', 400);
    }

    // Check for existing review
    const existing = await prisma.review.findUnique({
      where: { userId_productId_orderId: { userId, productId, orderId } },
    });

    if (existing) {
      throw new AppError('You have already reviewed this product from this order', 409);
    }

    return prisma.review.create({
      data: { userId, productId, orderId, rating, comment, isVerifiedPurchase: true },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  async getProductReviews(productId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      }),
      prisma.review.count({ where: { productId } }),
    ]);

    const aggregation = await prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      reviews,
      averageRating: Math.round((aggregation._avg.rating || 0) * 10) / 10,
      totalReviews: aggregation._count.rating,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    };
  }

  async getRatingDistribution(productId: string) {
    const distribution = await prisma.review.groupBy({
      by: ['rating'],
      where: { productId },
      _count: true,
    });

    const result: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach((d: any) => {
      result[d.rating] = d._count;
    });

    return result;
  }
}

export const reviewService = new ReviewService();
