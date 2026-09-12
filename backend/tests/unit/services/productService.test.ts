import { beforeEach, describe, expect, it, vi } from 'vitest';
import { model, prismaError, resetPrismaMock } from '../../helpers/prisma-mock.js';

vi.mock('../../../src/config/database.js', async () => {
  const { prismaMock } = await import('../../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { productService, isProductInStock } = await import('../../../src/services/productService.js');

const PRODUCT_ID = '6f1e2c3d-0000-4000-8000-000000000001';
const OTHER_ID = '6f1e2c3d-0000-4000-8000-000000000002';
const ADMIN_ID = '6f1e2c3d-0000-4000-8000-0000000000aa';

const product = {
  id: PRODUCT_ID,
  name: 'PUBG 60 UC',
  category: 'CURRENCY',
  price: '120.00',
  isAvailable: true,
  isFeatured: false,
  quantityAvailable: -1,
  specs: [],
  _count: { reviews: 4, orderItems: 2 },
};

beforeEach(() => {
  resetPrismaMock();
});

describe('list', () => {
  beforeEach(() => {
    model('product').findMany.mockResolvedValue([product, { ...product, id: OTHER_ID }]);
    model('product').count.mockResolvedValue(42);
    model('review').groupBy.mockResolvedValue([
      { productId: PRODUCT_ID, _avg: { rating: 4.37 }, _count: { _all: 4 } },
      { productId: OTHER_ID, _avg: { rating: null }, _count: { _all: 0 } },
    ]);
  });

  it('returns products with ratings attached', async () => {
    const result = await productService.list({});
    expect(result.products[0]).toMatchObject({ averageRating: 4.4, reviewCount: 4 });
    expect(result.products[1]).toMatchObject({ averageRating: 0, reviewCount: 0 });
  });

  // Regression: every Review row for every product on the page was loaded just
  // to average them in JavaScript — a full scan per request.
  it('computes ratings with a single groupBy instead of loading review rows', async () => {
    await productService.list({});

    expect(model('review').groupBy).toHaveBeenCalledTimes(1);
    expect(model('review').findMany).not.toHaveBeenCalled();
    const include = model('product').findMany.mock.calls[0][0].include;
    expect(include).not.toHaveProperty('reviews');
  });

  it('does not leak the internal _count blob to clients', async () => {
    const result = await productService.list({});
    expect(result.products[0]).not.toHaveProperty('_count');
  });

  it('reports an in-stock flag derived from quantityAvailable', async () => {
    const result = await productService.list({});
    expect(result.products[0].inStock).toBe(true);
  });

  it('normalises invalid pagination instead of sending NaN to Prisma', async () => {
    await productService.list({ page: Number.NaN, limit: Number.NaN });
    const args = model('product').findMany.mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
  });

  it('caps the page size', async () => {
    await productService.list({ limit: 100_000 });
    expect(model('product').findMany.mock.calls[0][0].take).toBeLessThanOrEqual(100);
  });

  it('maps sort keys to ORDER BY clauses', async () => {
    const cases: Array<[string, Record<string, string>]> = [
      ['price_asc', { price: 'asc' }],
      ['price_desc', { price: 'desc' }],
      ['name_asc', { name: 'asc' }],
      ['oldest', { createdAt: 'asc' }],
      ['newest', { createdAt: 'desc' }],
      ['nonsense', { createdAt: 'desc' }],
    ];

    for (const [sort, expected] of cases) {
      await productService.list({ sort });
    }

    const orderBys = model('product').findMany.mock.calls.map((call) => call[0].orderBy);
    expect(orderBys).toEqual(cases.map(([, expected]) => expected));
  });

  it('builds a case-insensitive search across name, description and game type', async () => {
    await productService.list({ search: '  pubg  ' });
    expect(model('product').findMany.mock.calls[0][0].where.OR).toEqual([
      { name: { contains: 'pubg', mode: 'insensitive' } },
      { description: { contains: 'pubg', mode: 'insensitive' } },
      { gameType: { contains: 'pubg', mode: 'insensitive' } },
    ]);
  });

  it('ignores a whitespace-only search term', async () => {
    await productService.list({ search: '   ' });
    expect(model('product').findMany.mock.calls[0][0].where).not.toHaveProperty('OR');
  });

  it('applies a price range filter', async () => {
    await productService.list({ minPrice: 100, maxPrice: 500 });
    expect(model('product').findMany.mock.calls[0][0].where.price).toEqual({ gte: 100, lte: 500 });
  });

  it('skips the rating query entirely when the page is empty', async () => {
    model('product').findMany.mockResolvedValue([]);
    await productService.list({});
    expect(model('review').groupBy).not.toHaveBeenCalled();
  });
});

describe('getById', () => {
  // Regression: the average was computed over only the 10 most recent reviews
  // (`take: 10`), so a product with 200 reviews reported the wrong rating and
  // `totalReviews: 10`.
  it('computes the rating across every review, not just the preview page', async () => {
    model('product').findUnique.mockResolvedValue({
      ...product,
      reviews: Array.from({ length: 10 }, () => ({ rating: 5 })),
      _count: { reviews: 200, orderItems: 50 },
    });
    model('review').groupBy.mockResolvedValue([
      { productId: PRODUCT_ID, _avg: { rating: 3.2 }, _count: { _all: 200 } },
    ]);

    const result = await productService.getById(PRODUCT_ID);

    expect(result.averageRating).toBe(3.2);
    expect(result.totalReviews).toBe(200);
    expect(result.reviewCount).toBe(200);
  });

  it('still returns the review preview for the product page', async () => {
    model('product').findUnique.mockResolvedValue({ ...product, reviews: [{ id: 'r1', rating: 5 }] });
    model('review').groupBy.mockResolvedValue([]);

    const result = await productService.getById(PRODUCT_ID);
    expect(result.reviews).toHaveLength(1);
  });

  it('includes specifications', async () => {
    model('product').findUnique.mockResolvedValue({ ...product, reviews: [] });
    model('review').groupBy.mockResolvedValue([]);

    await productService.getById(PRODUCT_ID);
    expect(model('product').findUnique.mock.calls[0][0].include.specs).toBe(true);
  });

  it('404s for an unknown product', async () => {
    model('product').findUnique.mockResolvedValue(null);
    await expect(productService.getById('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('getFeatured', () => {
  // Regression: featured products were returned without `averageRating` /
  // `reviewCount`, so the homepage rendered them differently from the catalogue.
  it('returns the same shape as list()', async () => {
    model('product').findMany.mockResolvedValue([product]);
    model('review').groupBy.mockResolvedValue([
      { productId: PRODUCT_ID, _avg: { rating: 4.8 }, _count: { _all: 12 } },
    ]);

    const featured = await productService.getFeatured();
    expect(featured[0]).toMatchObject({ averageRating: 4.8, reviewCount: 12, inStock: true });
  });

  it('only requests featured, available products', async () => {
    model('product').findMany.mockResolvedValue([]);
    await productService.getFeatured();
    expect(model('product').findMany.mock.calls[0][0].where).toEqual({
      isFeatured: true,
      isAvailable: true,
    });
  });

  it('clamps an abusive take', async () => {
    model('product').findMany.mockResolvedValue([]);
    await productService.getFeatured(10_000);
    expect(model('product').findMany.mock.calls[0][0].take).toBeLessThanOrEqual(24);
  });
});

describe('create', () => {
  it('stamps createdBy from the authenticated admin, never from the body', async () => {
    model('product').create.mockResolvedValue({ id: PRODUCT_ID });

    await productService.create(
      { name: 'X', category: 'GAME', price: 10, createdBy: 'attacker' },
      ADMIN_ID,
    );

    const data = model('product').create.mock.calls[0][0].data;
    expect(data.createdBy).toBe(ADMIN_ID);
  });

  it('defaults stock to unlimited and images to an empty array', async () => {
    model('product').create.mockResolvedValue({ id: PRODUCT_ID });
    await productService.create({ name: 'X', category: 'GAME', price: 10 }, ADMIN_ID);

    const data = model('product').create.mock.calls[0][0].data;
    expect(data.quantityAvailable).toBe(-1);
    expect(data.images).toEqual([]);
  });

  it('creates nested specifications', async () => {
    model('product').create.mockResolvedValue({ id: PRODUCT_ID });
    await productService.create(
      {
        name: 'X',
        category: 'GAME',
        price: 10,
        specifications: [{ name: 'Region', value: 'Global' }],
      },
      ADMIN_ID,
    );

    expect(model('product').create.mock.calls[0][0].data.specs.create).toEqual([
      { specName: 'Region', specValue: 'Global' },
    ]);
  });

  it('omits the specs relation when none are supplied', async () => {
    model('product').create.mockResolvedValue({ id: PRODUCT_ID });
    await productService.create({ name: 'X', category: 'GAME', price: 10 }, ADMIN_ID);
    expect(model('product').create.mock.calls[0][0].data.specs).toBeUndefined();
  });
});

describe('update', () => {
  beforeEach(() => {
    model('product').findUnique.mockResolvedValue({ id: PRODUCT_ID });
  });

  // Regression: `req.body` was forwarded verbatim, allowing `createdBy`, `id`
  // and `createdAt` to be overwritten.
  it.each([['createdBy'], ['id'], ['createdAt'], ['updatedAt'], ['reviews']])(
    'never writes the "%s" column',
    async (field) => {
      model('product').update.mockResolvedValue({ id: PRODUCT_ID });
      await productService.update(PRODUCT_ID, { name: 'Renamed', [field]: 'attacker' });

      const data = model('product').update.mock.calls[0][0].data as Record<string, unknown>;
      expect(data).not.toHaveProperty(field);
      expect(data.name).toBe('Renamed');
    },
  );

  it('writes every whitelisted field', async () => {
    model('product').update.mockResolvedValue({ id: PRODUCT_ID });
    await productService.update(PRODUCT_ID, {
      name: 'Renamed',
      price: 99,
      isAvailable: false,
      isFeatured: true,
      quantityAvailable: 10,
      gameType: 'PUBG',
    });

    expect(model('product').update.mock.calls[0][0].data).toMatchObject({
      name: 'Renamed',
      price: 99,
      isAvailable: false,
      quantityAvailable: 10,
    });
  });

  // Regression: the spec swap ran outside the product update, so a failure left
  // the product with no specifications at all.
  it('replaces specifications inside the same transaction', async () => {
    model('product').findUnique.mockResolvedValue({ id: PRODUCT_ID, specs: [] });

    await productService.update(PRODUCT_ID, {
      specifications: [{ name: 'Region', value: 'Global' }],
    });

    const { prismaMock } = await import('../../helpers/prisma-mock.js');
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(model('productSpec').deleteMany).toHaveBeenCalledWith({ where: { productId: PRODUCT_ID } });
    expect(model('productSpec').createMany).toHaveBeenCalledWith({
      data: [{ productId: PRODUCT_ID, specName: 'Region', specValue: 'Global' }],
    });
  });

  it('can clear all specifications', async () => {
    model('product').findUnique.mockResolvedValue({ id: PRODUCT_ID, specs: [] });
    await productService.update(PRODUCT_ID, { specifications: [] });

    expect(model('productSpec').deleteMany).toHaveBeenCalled();
    expect(model('productSpec').createMany).not.toHaveBeenCalled();
  });

  it('skips the product write when only specifications changed', async () => {
    model('product').findUnique.mockResolvedValue({ id: PRODUCT_ID, specs: [] });
    await productService.update(PRODUCT_ID, { specifications: [] });

    expect(model('product').update).not.toHaveBeenCalled();
  });

  it('404s for an unknown product', async () => {
    model('product').findUnique.mockResolvedValue(null);
    await expect(productService.update('nope', { name: 'x' })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('delete', () => {
  // Regression: `OrderItem.product` is a required relation, so deleting a
  // product that had ever been ordered raised a foreign-key error and returned
  // an opaque 500.
  it('retires a product that has order history instead of deleting it', async () => {
    model('product').findUnique.mockResolvedValue({ id: PRODUCT_ID, _count: { orderItems: 3 } });
    model('product').update.mockResolvedValue({ id: PRODUCT_ID });

    const result = await productService.delete(PRODUCT_ID);

    expect(result).toMatchObject({ retired: true });
    expect(model('product').delete).not.toHaveBeenCalled();
    expect(model('product').update).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID },
      data: { isAvailable: false, isFeatured: false },
    });
  });

  it('hard-deletes a product that has never been ordered', async () => {
    model('product').findUnique.mockResolvedValue({ id: PRODUCT_ID, _count: { orderItems: 0 } });

    const result = await productService.delete(PRODUCT_ID);

    expect(result).toMatchObject({ retired: false });
    expect(model('product').delete).toHaveBeenCalledWith({ where: { id: PRODUCT_ID } });
  });

  it('404s for an unknown product', async () => {
    model('product').findUnique.mockResolvedValue(null);
    await expect(productService.delete('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('surfaces a real database failure rather than swallowing it', async () => {
    model('product').findUnique.mockResolvedValue({ id: PRODUCT_ID, _count: { orderItems: 0 } });
    model('product').delete.mockRejectedValue(new Error('connection lost'));
    await expect(productService.delete(PRODUCT_ID)).rejects.toThrow('connection lost');
  });
});

describe('toggles', () => {
  it('flips isFeatured', async () => {
    model('product').findUnique.mockResolvedValue({ id: PRODUCT_ID, isFeatured: false });
    model('product').update.mockResolvedValue({ id: PRODUCT_ID, isFeatured: true });

    await productService.toggleFeatured(PRODUCT_ID);
    expect(model('product').update).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID },
      data: { isFeatured: true },
    });
  });

  it('flips isAvailable', async () => {
    model('product').findUnique.mockResolvedValue({ id: PRODUCT_ID, isAvailable: true });
    model('product').update.mockResolvedValue({ id: PRODUCT_ID, isAvailable: false });

    await productService.toggleAvailability(PRODUCT_ID);
    expect(model('product').update).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID },
      data: { isAvailable: false },
    });
  });

  it('404s when the product does not exist', async () => {
    model('product').findUnique.mockResolvedValue(null);
    await expect(productService.toggleFeatured('nope')).rejects.toMatchObject({ statusCode: 404 });
    await expect(productService.toggleAvailability('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('isProductInStock', () => {
  it('treats -1 as unlimited', () => {
    expect(isProductInStock({ quantityAvailable: -1, isAvailable: true })).toBe(true);
  });

  it('respects the available flag', () => {
    expect(isProductInStock({ quantityAvailable: -1, isAvailable: false })).toBe(false);
  });

  it('is false at zero and true above it', () => {
    expect(isProductInStock({ quantityAvailable: 0, isAvailable: true })).toBe(false);
    expect(isProductInStock({ quantityAvailable: 1, isAvailable: true })).toBe(true);
  });

  it('defaults a missing quantity to unlimited', () => {
    expect(isProductInStock({ isAvailable: true })).toBe(true);
  });
});

describe('database error propagation', () => {
  it('lets a Prisma known-request error reach the error handler unmangled', async () => {
    model('product').findUnique.mockResolvedValue({ id: PRODUCT_ID, _count: { orderItems: 0 } });
    model('product').delete.mockRejectedValue(prismaError('P2003'));

    // The service must not swallow it: `errorHandler` turns P2003 into an
    // actionable 409 rather than a 500.
    await expect(productService.delete(PRODUCT_ID)).rejects.toMatchObject({ code: 'P2003' });
  });

  it('propagates failures from the list query', async () => {
    model('product').findMany.mockRejectedValue(new Error('pool exhausted'));
    await expect(productService.list({})).rejects.toThrow('pool exhausted');
  });
});
