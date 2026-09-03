import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

export class ProductService {
  async list(params: {
    category?: string;
    gameType?: string;
    page?: number;
    limit?: number;
    sort?: string;
    search?: string;
    isAvailable?: boolean;
  }) {
    const { category, gameType, page = 1, limit = 20, sort = 'newest', search, isAvailable } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (category) where.category = category;
    if (gameType) where.gameType = gameType;
    if (isAvailable !== undefined) where.isAvailable = isAvailable;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    switch (sort) {
      case 'price_asc': orderBy.price = 'asc'; break;
      case 'price_desc': orderBy.price = 'desc'; break;
      case 'newest': default: orderBy.createdAt = 'desc'; break;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: { select: { reviews: true } },
          reviews: { select: { rating: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const productsWithRating = products.map((p: any) => {
      const avgRating = p.reviews.length > 0
        ? p.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / p.reviews.length
        : 0;
      const { reviews, ...rest } = p as any;
      return {
        ...rest,
        averageRating: Math.round(avgRating * 10) / 10,
        reviewCount: p._count.reviews,
      };
    });

    return {
      products: productsWithRating,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    };
  }

  async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        specs: true,
        reviews: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) throw new AppError('Product not found', 404);

    const avgRating = product.reviews.length > 0
      ? product.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / product.reviews.length
      : 0;

    return {
      ...product,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: product.reviews.length,
    };
  }

  async create(data: {
    name: string;
    description?: string;
    category: string;
    gameType?: string;
    price: number;
    originalPrice?: number;
    thumbnailUrl?: string;
    images?: any;
    specifications?: { name: string; value: string }[];
    isFeatured?: boolean;
    createdBy: string;
  }) {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        gameType: data.gameType,
        price: data.price,
        originalPrice: data.originalPrice,
        thumbnailUrl: data.thumbnailUrl,
        images: data.images || [],
        isFeatured: data.isFeatured || false,
        createdBy: data.createdBy,
        specs: data.specifications ? {
          create: data.specifications.map(s => ({
            specName: s.name,
            specValue: s.value,
          })),
        } : undefined,
      },
      include: { specs: true },
    });

    return product;
  }

  async update(id: string, data: any) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError('Product not found', 404);

    const updateData: any = { ...data };
    delete updateData.specifications;

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { specs: true },
    });

    // Update specifications if provided
    if (data.specifications) {
      await prisma.productSpec.deleteMany({ where: { productId: id } });
      await prisma.productSpec.createMany({
        data: data.specifications.map((s: any) => ({
          productId: id,
          specName: s.name,
          specValue: s.value,
        })),
      });
    }

    return prisma.product.findUnique({
      where: { id },
      include: { specs: true },
    });
  }

  async delete(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError('Product not found', 404);

    await prisma.product.delete({ where: { id } });
    return { message: 'Product deleted successfully' };
  }

  async toggleFeatured(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError('Product not found', 404);

    return prisma.product.update({
      where: { id },
      data: { isFeatured: !product.isFeatured },
    });
  }

  async getFeatured() {
    return prisma.product.findMany({
      where: { isFeatured: true, isAvailable: true },
      take: 8,
      include: {
        _count: { select: { reviews: true } },
        reviews: { select: { rating: true } },
      },
    });
  }
}

export const productService = new ProductService();
