import prisma, { type PrismaTx } from '../config/database.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';
import { buildPagination, normalizeLimit, normalizePage, offsetFor } from '../utils/pagination.js';
import { normalizeSearchTerm } from '../utils/helpers.js';
import { UNLIMITED_STOCK } from '../utils/constants.js';

/** Columns a client may set on a product. Everything else is ignored. */
const PRODUCT_FIELDS = [
  'name',
  'description',
  'category',
  'gameType',
  'price',
  'originalPrice',
  'currency',
  'quantityAvailable',
  'isAvailable',
  'isFeatured',
  'thumbnailUrl',
  'images',
] as const;

type ProductField = (typeof PRODUCT_FIELDS)[number];

export interface ListProductParams {
  category?: string;
  gameType?: string;
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  isAvailable?: boolean;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
}

/**
 * Product row as returned by `findMany`.
 *
 * Declared locally so the service compiles (and stays readable) whether or not
 * the Prisma client has been generated in the current environment.
 */
interface ProductRow {
  id: string;
  name: string;
  isAvailable?: boolean;
  quantityAvailable?: number | null;
  [key: string]: unknown;
}

interface RatingSummary {
  productId: string;
  averageRating: number;
  reviewCount: number;
}

export class ProductService {
  async list(params: ListProductParams = {}) {
    const page = normalizePage(params.page);
    const limit = normalizeLimit(params.limit);
    const sort = params.sort ?? 'newest';
    const search = normalizeSearchTerm(params.search);

    const where: Record<string, unknown> = {};
    if (params.category) where.category = params.category;
    if (params.gameType) where.gameType = params.gameType;
    if (params.isAvailable !== undefined) where.isAvailable = params.isAvailable;
    if (params.featured !== undefined) where.isFeatured = params.featured;

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      const price: Record<string, number> = {};
      if (params.minPrice !== undefined) price.gte = params.minPrice;
      if (params.maxPrice !== undefined) price.lte = params.maxPrice;
      where.price = price;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { gameType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = buildOrderBy(sort);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: offsetFor(page, limit),
        take: limit,
        include: { specs: true, _count: { select: { reviews: true, orderItems: true } } },
      }),
      prisma.product.count({ where }),
    ]);

    const ratings = await this.ratingSummaries((products as unknown as Array<{ id: string }>).map((product) => product.id));

    return {
      products: (products as unknown as ProductRow[]).map((product) => decorateProduct(product, ratings)),
      pagination: buildPagination(total, page, limit),
    };
  }

  async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        specs: true,
        _count: { select: { reviews: true, orderItems: true } },
        reviews: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) throw new NotFoundError('Product');

    // The rating must cover *every* review. It was previously derived from the
    // 10 most recent ones, so a product with 200 reviews showed the average of
    // its last 10 and reported `totalReviews: 10`.
    const ratings = await this.ratingSummaries([product.id]);

    return decorateProduct(product, ratings, { keepReviews: true });
  }

  async create(data: Record<string, any>, createdBy: string) {
    const { specifications, ...rest } = data;

    // Built as a record rather than an object literal: spreading
    // `pickFields(rest)` into a literal drops its index signature, which makes
    // TypeScript report `name` / `category` / `price` as missing even though the
    // validated input guarantees them.
    const payload: Record<string, unknown> = {
      ...pickFields(rest),
      createdBy,
      quantityAvailable: rest.quantityAvailable ?? UNLIMITED_STOCK,
      images: rest.images ?? [],
    };

    if (Array.isArray(specifications) && specifications.length > 0) {
      payload.specs = {
        create: specifications.map((spec: { name: string; value: string }) => ({
          specName: spec.name,
          specValue: spec.value,
        })),
      };
    }

    const product = await prisma.product.create({
      // See the note on `payload`: the allow-list in `pickFields` plus the Zod
      // schema are the real guarantees. `never` (rather than a generated input
      // type) keeps this compiling where the Prisma client is not generated.
      data: payload as never,
      include: { specs: true },
    });

    return product;
  }

  /**
   * Update a product.
   *
   * Writes are whitelisted and the specification swap happens in the same
   * transaction, so a failure halfway through can no longer leave a product with
   * no specs. `createdBy` is never writable — it was previously assignable from
   * the request body.
   */
  async update(id: string, data: Record<string, any>) {
    const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Product');

    const payload = pickFields(data);

    return prisma.$transaction(async (tx: PrismaTx) => {
      if (Object.keys(payload).length > 0) {
        await tx.product.update({ where: { id }, data: payload });
      }

      if (Array.isArray(data.specifications)) {
        await tx.productSpec.deleteMany({ where: { productId: id } });
        if (data.specifications.length > 0) {
          await tx.productSpec.createMany({
            data: data.specifications.map((spec: { name: string; value: string }) => ({
              productId: id,
              specName: spec.name,
              specValue: spec.value,
            })),
          });
        }
      }

      const updated = await tx.product.findUnique({ where: { id }, include: { specs: true } });
      if (!updated) throw new NotFoundError('Product');
      return updated;
    });
  }

  /**
   * Delete a product.
   *
   * `OrderItem.product` is a required relation, so hard-deleting a product that
   * has ever been ordered raised a foreign-key error and returned an opaque 500.
   * In that case we retire the product instead — it stops being purchasable and
   * disappears from listings, while historical orders keep their line items.
   */
  async delete(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, _count: { select: { orderItems: true } } },
    });
    if (!product) throw new NotFoundError('Product');

    const referenced = (product as any)._count?.orderItems ?? 0;

    if (referenced > 0) {
      await prisma.product.update({
        where: { id },
        data: { isAvailable: false, isFeatured: false },
      });
      return {
        message: 'Product has existing orders and was retired instead of deleted',
        retired: true,
      };
    }

    await prisma.product.delete({ where: { id } });
    return { message: 'Product deleted successfully', retired: false };
  }

  async toggleFeatured(id: string) {
    const product = await prisma.product.findUnique({ where: { id }, select: { id: true, isFeatured: true } });
    if (!product) throw new NotFoundError('Product');

    return prisma.product.update({ where: { id }, data: { isFeatured: !product.isFeatured } });
  }

  async toggleAvailability(id: string) {
    const product = await prisma.product.findUnique({ where: { id }, select: { id: true, isAvailable: true } });
    if (!product) throw new NotFoundError('Product');

    return prisma.product.update({ where: { id }, data: { isAvailable: !product.isAvailable } });
  }

  /** Featured products now carry the same rating fields as `list()`. */
  async getFeatured(limit = 8) {
    const take = Math.min(Math.max(limit, 1), 24);
    const products = await prisma.product.findMany({
      where: { isFeatured: true, isAvailable: true },
      orderBy: { createdAt: 'desc' },
      take,
      include: { _count: { select: { reviews: true, orderItems: true } } },
    });

    const ratings = await this.ratingSummaries((products as unknown as Array<{ id: string }>).map((product) => product.id));
    return (products as unknown as ProductRow[]).map((product) => decorateProduct(product, ratings));
  }

  /**
   * Aggregate ratings for a set of products in one query.
   *
   * `list()` previously selected every `Review` row for every product on the
   * page purely to average them in JavaScript — a full table scan per request
   * that grows with review volume.
   */
  private async ratingSummaries(productIds: string[]): Promise<Map<string, RatingSummary>> {
    const summaries = new Map<string, RatingSummary>();
    if (productIds.length === 0) return summaries;

    const grouped = await prisma.review.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _avg: { rating: true },
      _count: { _all: true },
    });

    for (const row of grouped) {
      summaries.set(row.productId, {
        productId: row.productId,
        averageRating: Math.round((row._avg.rating ?? 0) * 10) / 10,
        reviewCount: row._count._all,
      });
    }

    return summaries;
  }
}

function buildOrderBy(sort: string): Record<string, string> {
  switch (sort) {
    case 'price_asc':
      return { price: 'asc' };
    case 'price_desc':
      return { price: 'desc' };
    case 'name_asc':
      return { name: 'asc' };
    case 'name_desc':
      return { name: 'desc' };
    case 'oldest':
      return { createdAt: 'asc' };
    case 'newest':
    default:
      return { createdAt: 'desc' };
  }
}

function pickFields(data: Record<string, any>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of PRODUCT_FIELDS) {
    const value = data[field as ProductField];
    if (value !== undefined) payload[field] = value;
  }
  return payload;
}

/** Attach `averageRating` / `reviewCount` and drop the internal `_count` blob. */
function decorateProduct<T extends Record<string, any>>(
  product: T,
  ratings: Map<string, RatingSummary>,
  options: { keepReviews?: boolean } = {},
) {
  const summary = ratings.get(product.id);
  const { _count, ...rest } = product;

  const decorated: Record<string, unknown> = {
    ...rest,
    averageRating: summary?.averageRating ?? 0,
    reviewCount: summary?.reviewCount ?? 0,
    totalReviews: summary?.reviewCount ?? 0,
    inStock: isProductInStock(product),
  };

  if (!options.keepReviews) delete decorated.reviews;

  return decorated;
}

export function isProductInStock(product: { quantityAvailable?: number | null; isAvailable?: boolean }): boolean {
  if (product.isAvailable === false) return false;
  const quantity = product.quantityAvailable ?? UNLIMITED_STOCK;
  return quantity === UNLIMITED_STOCK || quantity > 0;
}

export const productService = new ProductService();
export { AppError };
