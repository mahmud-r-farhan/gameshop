import { beforeEach, describe, expect, it, vi } from 'vitest';
import { model, prismaError, prismaMock, resetPrismaMock } from '../../helpers/prisma-mock.js';

vi.mock('../../../src/config/database.js', async () => {
  const { prismaMock } = await import('../../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { reviewService } = await import('../../../src/services/reviewService.js');

const USER_ID = '6f1e2c3d-0000-4000-8000-0000000000a1';
const PRODUCT_ID = '6f1e2c3d-0000-4000-8000-0000000000a2';
const ORDER_ID = '6f1e2c3d-0000-4000-8000-0000000000a3';
const REVIEW_ID = '6f1e2c3d-0000-4000-8000-0000000000a4';

beforeEach(() => {
  resetPrismaMock();
});

describe('create', () => {
  beforeEach(() => {
    model('order').findFirst.mockResolvedValue({ id: ORDER_ID });
    model('review').findUnique.mockResolvedValue(null);
    model('review').create.mockResolvedValue({ id: REVIEW_ID });
  });

  it('requires a delivered order that actually contains the product', async () => {
    await reviewService.create(USER_ID, PRODUCT_ID, ORDER_ID, 5, 'Great');

    expect(model('order').findFirst.mock.calls[0][0].where).toEqual({
      id: ORDER_ID,
      userId: USER_ID,
      orderStatus: 'DELIVERED',
      items: { some: { productId: PRODUCT_ID } },
    });
  });

  it('keeps the purchase check and the write inside one transaction', async () => {
    await reviewService.create(USER_ID, PRODUCT_ID, ORDER_ID, 5);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(typeof prismaMock.$transaction.mock.calls[0][0]).toBe('function');
  });

  it('stamps the review as a verified purchase', async () => {
    await reviewService.create(USER_ID, PRODUCT_ID, ORDER_ID, 4, 'Solid');

    expect(model('review').create.mock.calls[0][0].data).toMatchObject({
      userId: USER_ID,
      productId: PRODUCT_ID,
      orderId: ORDER_ID,
      rating: 4,
      comment: 'Solid',
      isVerifiedPurchase: true,
    });
  });

  it('normalises a whitespace-only comment to null', async () => {
    await reviewService.create(USER_ID, PRODUCT_ID, ORDER_ID, 4, '   \n\t ');
    expect(model('review').create.mock.calls[0][0].data.comment).toBeNull();
  });

  it('trims a real comment', async () => {
    await reviewService.create(USER_ID, PRODUCT_ID, ORDER_ID, 4, '  well packaged  ');
    expect(model('review').create.mock.calls[0][0].data.comment).toBe('well packaged');
  });

  it('rejects a review for an order the caller does not own', async () => {
    model('order').findFirst.mockResolvedValue(null);

    await expect(reviewService.create(USER_ID, PRODUCT_ID, ORDER_ID, 5)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(model('review').create).not.toHaveBeenCalled();
  });

  it('explains the purchase requirement to the customer', async () => {
    model('order').findFirst.mockResolvedValue(null);

    await expect(reviewService.create(USER_ID, PRODUCT_ID, ORDER_ID, 5)).rejects.toThrow(
      /purchased and that have been delivered/,
    );
  });

  it('rejects a duplicate review for the same product + order', async () => {
    model('review').findUnique.mockResolvedValue({ id: 'existing' });

    await expect(reviewService.create(USER_ID, PRODUCT_ID, ORDER_ID, 5)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(model('review').create).not.toHaveBeenCalled();
  });

  // The pre-check can still lose a race between two concurrent submissions; the
  // compound unique index is the backstop and must be translated, not leaked.
  it('translates a unique violation from the race into a 409', async () => {
    model('review').create.mockRejectedValue(
      prismaError('P2002', { target: ['user_id', 'product_id', 'order_id'] }),
    );

    await expect(reviewService.create(USER_ID, PRODUCT_ID, ORDER_ID, 5)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('404s when the product or order disappeared mid-request', async () => {
    model('review').create.mockRejectedValue(prismaError('P2025'));
    await expect(reviewService.create(USER_ID, PRODUCT_ID, ORDER_ID, 5)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('includes an author projection without the email address', async () => {
    await reviewService.create(USER_ID, PRODUCT_ID, ORDER_ID, 5);
    const include = model('review').create.mock.calls[0][0].include;
    expect(include.user.select).toMatchObject({ fullName: true, avatarUrl: true });
    expect(include.user.select).not.toHaveProperty('email');
  });
});

describe('getProductReviews', () => {
  beforeEach(() => {
    model('review').findMany.mockResolvedValue([{ id: REVIEW_ID }]);
    model('review').count.mockResolvedValue(23);
    model('review').aggregate.mockResolvedValue({ _avg: { rating: 4.44 }, _count: { rating: 23 } });
    model('review').groupBy.mockResolvedValue([]);
  });

  it('computes the average from an aggregate, never from a page of rows', async () => {
    const result = await reviewService.getProductReviews(PRODUCT_ID);

    expect(model('review').aggregate).toHaveBeenCalledWith({
      where: { productId: PRODUCT_ID },
      _avg: { rating: true },
      _count: { rating: true },
    });
    expect(result.averageRating).toBe(4.4);
    expect(result.totalReviews).toBe(23);
  });

  it('reports the average over *all* reviews even when a rating filter narrows the page', async () => {
    const result = await reviewService.getProductReviews(PRODUCT_ID, 1, 10, { rating: 5 });

    expect(model('review').findMany.mock.calls[0][0].where).toEqual({
      productId: PRODUCT_ID,
      rating: 5,
    });
    expect(model('review').aggregate.mock.calls[0][0].where).toEqual({ productId: PRODUCT_ID });
    expect(result.totalReviews).toBe(23);
  });

  it('paginates with a sane default page size', async () => {
    await reviewService.getProductReviews(PRODUCT_ID);
    expect(model('review').findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 10 });
  });

  it('clamps hostile pagination values instead of sending them to Prisma', async () => {
    await reviewService.getProductReviews(PRODUCT_ID, 'abc', '-5');
    expect(model('review').findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 10 });

    await reviewService.getProductReviews(PRODUCT_ID, 2, 5000);
    expect(model('review').findMany.mock.calls[1][0]).toMatchObject({ skip: 100, take: 100 });
  });

  it('returns pagination metadata', async () => {
    const result = await reviewService.getProductReviews(PRODUCT_ID, 2, 10);
    expect(result.pagination).toEqual({
      currentPage: 2,
      totalPages: 3,
      totalItems: 23,
      itemsPerPage: 10,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('treats a product with no reviews as 0 rather than NaN', async () => {
    model('review').aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });
    const result = await reviewService.getProductReviews(PRODUCT_ID);
    expect(result.averageRating).toBe(0);
    expect(result.totalReviews).toBe(0);
  });

  it('includes a rating distribution alongside the page', async () => {
    model('review').groupBy.mockResolvedValue([{ rating: 5, _count: { _all: 2 } }]);
    const result = await reviewService.getProductReviews(PRODUCT_ID);
    expect(result.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 2 });
  });

  it.each([
    ['newest', { createdAt: 'desc' }],
    ['oldest', { createdAt: 'asc' }],
    ['highest', { rating: 'desc', createdAt: 'desc' }],
    ['lowest', { rating: 'asc', createdAt: 'desc' }],
    ['helpful', { helpfulCount: 'desc', createdAt: 'desc' }],
  ])('sorts by %s', async (sort, expected) => {
    await reviewService.getProductReviews(PRODUCT_ID, 1, 10, { sort });
    expect(model('review').findMany.mock.calls[0][0].orderBy).toEqual(expected);
  });

  // The sort key reaches Prisma's `orderBy`, which does not parameterise field
  // names — an allow-list switch is the only safe shape.
  it('falls back to newest for an unknown sort key', async () => {
    await reviewService.getProductReviews(PRODUCT_ID, 1, 10, {
      sort: 'createdAt; DROP TABLE reviews',
    });
    expect(model('review').findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
  });
});

describe('getRatingDistribution', () => {
  it('always returns keys 1..5 so charts do not special-case gaps', async () => {
    model('review').groupBy.mockResolvedValue([{ rating: 5, _count: { _all: 3 } }]);
    await expect(reviewService.getRatingDistribution(PRODUCT_ID)).resolves.toEqual({
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 3,
    });
  });

  it('accepts the scalar `_count` shape as well', async () => {
    model('review').groupBy.mockResolvedValue([{ rating: 2, _count: 7 }]);
    await expect(reviewService.getRatingDistribution(PRODUCT_ID)).resolves.toMatchObject({ 2: 7 });
  });

  it('ignores out-of-range ratings (legacy data)', async () => {
    model('review').groupBy.mockResolvedValue([
      { rating: 0, _count: { _all: 4 } },
      { rating: 9, _count: { _all: 2 } },
      { rating: 4, _count: { _all: 1 } },
    ]);
    const result = await reviewService.getRatingDistribution(PRODUCT_ID);
    expect(result).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 });
  });

  it('scopes the aggregation to the requested product', async () => {
    model('review').groupBy.mockResolvedValue([]);
    await reviewService.getRatingDistribution(PRODUCT_ID);
    expect(model('review').groupBy.mock.calls[0][0]).toEqual({
      by: ['rating'],
      where: { productId: PRODUCT_ID },
      _count: { _all: true },
    });
  });

  it('treats a missing count as zero', async () => {
    model('review').groupBy.mockResolvedValue([{ rating: 3 }]);
    await expect(reviewService.getRatingDistribution(PRODUCT_ID)).resolves.toMatchObject({ 3: 0 });
  });
});

describe('markHelpful', () => {
  it('increments atomically rather than read-then-write', async () => {
    model('review').update.mockResolvedValue({ id: REVIEW_ID, helpfulCount: 6 });

    await reviewService.markHelpful(REVIEW_ID);

    expect(model('review').update).toHaveBeenCalledWith({
      where: { id: REVIEW_ID },
      data: { helpfulCount: { increment: 1 } },
      select: { id: true, helpfulCount: true },
    });
  });

  // Regression: the promise was returned from a `try` without `await`, so a
  // missing review escaped the catch and reached the client as a 500.
  it('404s for an unknown review', async () => {
    model('review').update.mockRejectedValue(prismaError('P2025'));
    await expect(reviewService.markHelpful('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('delete (moderation)', () => {
  it('removes the review', async () => {
    model('review').delete.mockResolvedValue({ id: REVIEW_ID });
    await expect(reviewService.delete(REVIEW_ID)).resolves.toEqual({ message: 'Review removed' });
    expect(model('review').delete).toHaveBeenCalledWith({ where: { id: REVIEW_ID } });
  });

  it('404s for an unknown review', async () => {
    model('review').delete.mockRejectedValue(prismaError('P2025'));
    await expect(reviewService.delete('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rethrows unexpected failures', async () => {
    model('review').delete.mockRejectedValue(new Error('connection lost'));
    await expect(reviewService.delete(REVIEW_ID)).rejects.toThrow('connection lost');
  });
});
