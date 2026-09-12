import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', async () => {
  const { prismaMock } = await import('../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { api, resetDb, model, UUID, asUser, asAdmin } = await import('./helpers.js');
const { prismaMock, prismaError } = await import('../helpers/prisma-mock.js');

/** HTTP-level coverage for `/api/v1/reviews`. */

const DELIVERED_ORDER = { id: UUID.order };

beforeEach(() => {
  resetDb();
  model('order').findFirst.mockResolvedValue(DELIVERED_ORDER);
  model('review').findUnique.mockResolvedValue(null);
  model('review').create.mockResolvedValue({ id: UUID.review, rating: 5 });
});

describe('POST /reviews', () => {
  const payload = { productId: UUID.product, orderId: UUID.order, rating: 5, comment: 'Arrived fast' };

  it('requires authentication', async () => {
    expect((await api().post('/api/v1/reviews').send(payload)).status).toBe(401);
  });

  it('creates a verified-purchase review', async () => {
    const response = await api().post('/api/v1/reviews').set(asUser()).send(payload);

    expect(response.status).toBe(201);
    expect(model('review').create.mock.calls[0][0].data).toMatchObject({
      userId: UUID.user,
      productId: UUID.product,
      orderId: UUID.order,
      rating: 5,
      isVerifiedPurchase: true,
    });
  });

  it.each([[0], [6], [-1], [3.5], ['great']])(
    'rejects a rating outside 1..5 (%s)',
    async (rating) => {
      const response = await api().post('/api/v1/reviews').set(asUser()).send({ ...payload, rating });

      expect(response.status).toBe(400);
      expect(model('review').create).not.toHaveBeenCalled();
    },
  );

  it('accepts a numeric rating delivered as a string (form post)', async () => {
    await api().post('/api/v1/reviews').set(asUser()).send({ ...payload, rating: '4' });
    expect(model('review').create.mock.calls[0][0].data.rating).toBe(4);
  });

  it('requires both a product and an order', async () => {
    expect(
      (await api().post('/api/v1/reviews').set(asUser()).send({ rating: 5, orderId: UUID.order })).status,
    ).toBe(400);
    expect(
      (await api().post('/api/v1/reviews').set(asUser()).send({ rating: 5, productId: UUID.product })).status,
    ).toBe(400);
  });

  it('400s for a malformed product id', async () => {
    const response = await api()
      .post('/api/v1/reviews')
      .set(asUser())
      .send({ ...payload, productId: 'not-a-uuid' });

    expect(response.status).toBe(400);
  });

  it('403s when the caller never bought the product', async () => {
    model('order').findFirst.mockResolvedValue(null);

    const response = await api().post('/api/v1/reviews').set(asUser()).send(payload);

    expect(response.status).toBe(403);
    expect(model('review').create).not.toHaveBeenCalled();
  });

  it('scopes the purchase check to the caller, the order and the product', async () => {
    await api().post('/api/v1/reviews').set(asUser()).send(payload);

    expect(model('order').findFirst.mock.calls[0][0].where).toEqual({
      id: UUID.order,
      userId: UUID.user,
      orderStatus: 'DELIVERED',
      items: { some: { productId: UUID.product } },
    });
  });

  it('409s on a second review for the same product and order', async () => {
    model('review').findUnique.mockResolvedValue({ id: 'existing' });

    const response = await api().post('/api/v1/reviews').set(asUser()).send(payload);

    expect(response.status).toBe(409);
    expect(model('review').create).not.toHaveBeenCalled();
  });

  it('409s when two concurrent submissions race past the pre-check', async () => {
    model('review').create.mockRejectedValue(
      prismaError('P2002', { target: ['user_id', 'product_id', 'order_id'] }),
    );

    const response = await api().post('/api/v1/reviews').set(asUser()).send(payload);
    expect(response.status).toBe(409);
  });

  it('runs the purchase check and the write inside one transaction', async () => {
    await api().post('/api/v1/reviews').set(asUser()).send(payload);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects an over-long comment', async () => {
    const response = await api()
      .post('/api/v1/reviews')
      .set(asUser())
      .send({ ...payload, comment: 'x'.repeat(5000) });

    expect(response.status).toBe(400);
  });
});

describe('GET /reviews/product/:productId', () => {
  beforeEach(() => {
    model('review').findMany.mockResolvedValue([]);
    model('review').count.mockResolvedValue(0);
    model('review').aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });
    model('review').groupBy.mockResolvedValue([]);
  });

  it('is public — a shopper must be able to read reviews before signing in', async () => {
    const response = await api().get(`/api/v1/reviews/product/${UUID.product}`);
    expect(response.status).toBe(200);
  });

  it('returns the rating summary and the distribution together', async () => {
    model('review').aggregate.mockResolvedValue({ _avg: { rating: 4.44 }, _count: { rating: 9 } });
    model('review').groupBy.mockResolvedValue([{ rating: 5, _count: { _all: 9 } }]);

    const response = await api().get(`/api/v1/reviews/product/${UUID.product}`);

    expect(response.body.data).toMatchObject({
      averageRating: 4.4,
      totalReviews: 9,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 9 },
    });
  });

  it('400s for a malformed product id', async () => {
    const response = await api().get('/api/v1/reviews/product/nope');
    expect(response.status).toBe(400);
    expect(model('review').findMany).not.toHaveBeenCalled();
  });

  it('survives hostile pagination and sorting', async () => {
    const response = await api().get(
      `/api/v1/reviews/product/${UUID.product}?page=-1&limit=abc&sort=rating;DROP`,
    );

    expect(response.status).toBe(200);
    const args = model('review').findMany.mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('filters by star rating while still averaging over every review', async () => {
    await api().get(`/api/v1/reviews/product/${UUID.product}?rating=5`);

    expect(model('review').findMany.mock.calls[0][0].where).toEqual({
      productId: UUID.product,
      rating: 5,
    });
    expect(model('review').aggregate.mock.calls[0][0].where).toEqual({ productId: UUID.product });
  });

  it('400s for a rating filter outside 1..5', async () => {
    const response = await api().get(`/api/v1/reviews/product/${UUID.product}?rating=9`);
    expect(response.status).toBe(400);
  });
});

describe('GET /reviews/product/:productId/distribution', () => {
  it('is public and always returns five buckets', async () => {
    model('review').groupBy.mockResolvedValue([{ rating: 4, _count: { _all: 2 } }]);

    const response = await api().get(`/api/v1/reviews/product/${UUID.product}/distribution`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ 1: 0, 2: 0, 3: 0, 4: 2, 5: 0 });
  });
});

describe('POST /reviews/:id/helpful', () => {
  beforeEach(() => {
    model('review').update.mockResolvedValue({ id: UUID.review, helpfulCount: 1 });
  });

  /**
   * Regression: this was an unauthenticated write to a counter, so any script
   * could inflate `helpfulCount` without limit.
   */
  it('requires authentication', async () => {
    const response = await api().post(`/api/v1/reviews/${UUID.review}/helpful`);
    expect(response.status).toBe(401);
    expect(model('review').update).not.toHaveBeenCalled();
  });

  it('increments for an authenticated caller', async () => {
    const response = await api().post(`/api/v1/reviews/${UUID.review}/helpful`).set(asUser());

    expect(response.status).toBe(200);
    expect(model('review').update.mock.calls[0][0].data).toEqual({ helpfulCount: { increment: 1 } });
  });

  it('404s for an unknown review rather than 500ing', async () => {
    model('review').update.mockRejectedValue(prismaError('P2025'));

    const response = await api().post(`/api/v1/reviews/${UUID.review}/helpful`).set(asUser());
    expect(response.status).toBe(404);
  });
});

describe('DELETE /reviews/:id', () => {
  it('is admin-only', async () => {
    expect((await api().delete(`/api/v1/reviews/${UUID.review}`)).status).toBe(401);
    expect((await api().delete(`/api/v1/reviews/${UUID.review}`).set(asUser())).status).toBe(403);
  });

  it('removes an abusive review for an admin', async () => {
    model('review').delete.mockResolvedValue({ id: UUID.review });

    const response = await api().delete(`/api/v1/reviews/${UUID.review}`).set(asAdmin());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, message: 'Review removed' });
  });

  it('404s for an unknown review', async () => {
    model('review').delete.mockRejectedValue(prismaError('P2025'));

    const response = await api().delete(`/api/v1/reviews/${UUID.review}`).set(asAdmin());
    expect(response.status).toBe(404);
  });
});
