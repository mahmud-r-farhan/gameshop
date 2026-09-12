import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', async () => {
  const { prismaMock } = await import('../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { api, resetDb, model, productRow, UUID, asUser, asAdmin, USER } = await import('./helpers.js');
const { PRODUCT_CATEGORY_VALUES } = await import('../../src/utils/constants.js');

/**
 * HTTP-level coverage for `/api/v1/products`.
 *
 * Focus areas: the public catalogue must be readable without authentication,
 * query-string handling must never reach Prisma as `NaN`, and every mutation
 * must be admin-gated.
 */

beforeEach(() => {
  resetDb();
  model('product').findMany.mockResolvedValue([productRow()]);
  model('product').count.mockResolvedValue(1);
  model('review').groupBy.mockResolvedValue([]);
});

describe('GET /products', () => {
  it('is public', async () => {
    const response = await api().get('/api/v1/products');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true });
    expect(response.body.data.products).toHaveLength(1);
  });

  it('only shows purchasable products by default', async () => {
    await api().get('/api/v1/products');
    expect(model('product').findMany.mock.calls[0][0].where).toMatchObject({ isAvailable: true });
  });

  it('lets an admin audit hidden products', async () => {
    await api().get('/api/v1/products?isAvailable=false').set(asAdmin());
    expect(model('product').findMany.mock.calls[0][0].where).toMatchObject({ isAvailable: false });
  });

  it('returns pagination metadata the storefront can render', async () => {
    model('product').count.mockResolvedValue(45);

    const response = await api().get('/api/v1/products?page=2&limit=10');

    expect(response.body.data.pagination).toMatchObject({
      currentPage: 2,
      totalPages: 5,
      totalItems: 45,
      itemsPerPage: 10,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  /**
   * Regression: `parseInt(req.query.page)` produced `NaN`, which Prisma rejects
   * with a 500. A crawler appending `?page=abc` used to take the API down.
   */
  it.each([
    ['page=abc'],
    ['limit=abc'],
    ['page=-1'],
    ['limit=0'],
    ['page=1e999'],
    ['limit=99999'],
  ])('survives hostile pagination input: %s', async (query) => {
    const response = await api().get(`/api/v1/products?${query}`);

    expect(response.status).toBe(200);
    const args = model('product').findMany.mock.calls[0][0];
    expect(Number.isFinite(args.skip)).toBe(true);
    expect(Number.isFinite(args.take)).toBe(true);
    expect(args.skip).toBeGreaterThanOrEqual(0);
    expect(args.take).toBeGreaterThan(0);
  });

  it('caps the page size so one request cannot dump the catalogue', async () => {
    await api().get('/api/v1/products?limit=5000');
    expect(model('product').findMany.mock.calls[0][0].take).toBeLessThanOrEqual(100);
  });

  it('filters by category, normalising case', async () => {
    await api().get(`/api/v1/products?category=${PRODUCT_CATEGORY_VALUES[0].toLowerCase()}`);
    expect(model('product').findMany.mock.calls[0][0].where.category).toBe(PRODUCT_CATEGORY_VALUES[0]);
  });

  it('treats category=ALL as "no filter", which is what the storefront sends', async () => {
    await api().get('/api/v1/products?category=ALL');
    expect(model('product').findMany.mock.calls[0][0].where).not.toHaveProperty('category');
  });

  it('400s on an unknown category instead of returning an empty list', async () => {
    const response = await api().get('/api/v1/products?category=NOT_A_CATEGORY');
    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('category');
  });

  it('searches name, description and game type case-insensitively', async () => {
    await api().get('/api/v1/products?search=elden');
    expect(model('product').findMany.mock.calls[0][0].where.OR).toEqual([
      { name: { contains: 'elden', mode: 'insensitive' } },
      { description: { contains: 'elden', mode: 'insensitive' } },
      { gameType: { contains: 'elden', mode: 'insensitive' } },
    ]);
  });

  it('applies a price range', async () => {
    await api().get('/api/v1/products?minPrice=100&maxPrice=5000');
    expect(model('product').findMany.mock.calls[0][0].where.price).toEqual({ gte: 100, lte: 5000 });
  });

  it('400s when minPrice exceeds maxPrice', async () => {
    const response = await api().get('/api/v1/products?minPrice=5000&maxPrice=100');
    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('maxPrice');
  });

  it.each([
    ['price_asc', { price: 'asc' }],
    ['price_desc', { price: 'desc' }],
    ['name_asc', { name: 'asc' }],
    ['newest', { createdAt: 'desc' }],
  ])('sorts by %s', async (sort, expected) => {
    await api().get(`/api/v1/products?sort=${sort}`);
    expect(model('product').findMany.mock.calls[0][0].orderBy).toMatchObject(expected);
  });

  // `sort` reaches Prisma's `orderBy`, which is not parameterised. The schema
  // `.catch('newest')` guarantees only allow-listed values ever arrive.
  it('falls back to newest for a sort value that is not on the allow-list', async () => {
    const response = await api().get('/api/v1/products?sort=price;DROP TABLE products');
    expect(response.status).toBe(200);
    expect(model('product').findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
  });

  /**
   * Guard against advertising a sort the service does not implement. An
   * unhandled value falls through to the default branch, which would show up
   * here as two options producing the same ordering.
   */
  it('implements every sort option it advertises', async () => {
    const { PRODUCT_SORT_OPTIONS } = await import('../../src/utils/constants.js');
    const orderings = new Set<string>();

    for (const option of PRODUCT_SORT_OPTIONS) {
      await api().get(`/api/v1/products?sort=${option}`).expect(200);
      const args = model('product').findMany.mock.calls.at(-1)![0];
      orderings.add(JSON.stringify(args.orderBy));
    }

    expect(orderings.size).toBe(PRODUCT_SORT_OPTIONS.length);
  });

  it('annotates every product with a rating summary of a consistent shape', async () => {
    model('review').groupBy.mockResolvedValue([{ productId: UUID.product, _avg: { rating: 4.5 }, _count: { _all: 2 } }]);

    const response = await api().get('/api/v1/products');
    const product = response.body.data.products[0];

    expect(product).toMatchObject({ averageRating: 4.5, reviewCount: 2 });
  });

  it('reports a zero rating rather than null for an unreviewed product', async () => {
    const response = await api().get('/api/v1/products');
    expect(response.body.data.products[0]).toMatchObject({ averageRating: 0, reviewCount: 0 });
  });

  it('exposes in-stock information the storefront needs to disable "Add to cart"', async () => {
    model('product').findMany.mockResolvedValue([productRow({ quantityAvailable: 0 })]);

    const response = await api().get('/api/v1/products');
    expect(response.body.data.products[0]).toMatchObject({ inStock: false });
  });
});

describe('GET /products/featured', () => {
  /**
   * Route order matters: `/featured` must be declared before `/:id`, otherwise
   * the literal string "featured" is parsed as an id and the request 400s.
   */
  it('is matched as a static route, not as an id', async () => {
    model('product').findMany.mockResolvedValue([productRow({ isFeatured: true })]);

    const response = await api().get('/api/v1/products/featured');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(model('product').findMany.mock.calls[0][0].where).toMatchObject({ isFeatured: true });
  });

  it('returns the same shape as the list endpoint so one client type fits both', async () => {
    model('product').findMany.mockResolvedValue([productRow({ isFeatured: true })]);

    const response = await api().get('/api/v1/products/featured');
    expect(response.body.data[0]).toHaveProperty('averageRating');
    expect(response.body.data[0]).toHaveProperty('reviewCount');
  });
});

describe('GET /products/:id', () => {
  it('400s on a malformed id rather than querying with garbage', async () => {
    const response = await api().get('/api/v1/products/not-a-uuid');

    expect(response.status).toBe(400);
    expect(model('product').findUnique).not.toHaveBeenCalled();
  });

  it('404s for an unknown product', async () => {
    model('product').findUnique.mockResolvedValue(null);

    const response = await api().get(`/api/v1/products/${UUID.product}`);
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });

  it('includes the ten most recent reviews but rates over *all* of them', async () => {
    model('product').findUnique.mockResolvedValue(productRow({ specs: [], reviews: [], _count: { reviews: 200 } }));
    model('review').groupBy.mockResolvedValue([{ productId: UUID.product, _avg: { rating: 3.2 }, _count: { _all: 200 } }]);

    const response = await api().get(`/api/v1/products/${UUID.product}`);

    expect(response.body.data).toMatchObject({ averageRating: 3.2, reviewCount: 200 });
  });
});

describe('POST /products', () => {
  const payload = {
    name: 'Elden Ring',
    category: PRODUCT_CATEGORY_VALUES[0],
    price: 4500,
  };

  it('401s for an anonymous caller', async () => {
    const response = await api().post('/api/v1/products').send(payload);
    expect(response.status).toBe(401);
  });

  it('403s for a regular customer', async () => {
    const response = await api().post('/api/v1/products').set(asUser()).send(payload);
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
    expect(model('product').create).not.toHaveBeenCalled();
  });

  it('creates the product for an admin', async () => {
    model('product').create.mockResolvedValue(productRow());

    const response = await api().post('/api/v1/products').set(asAdmin()).send(payload);

    expect(response.status).toBe(201);
    expect(model('product').create).toHaveBeenCalledTimes(1);
  });

  it('stamps createdBy from the authenticated admin, never from the body', async () => {
    model('product').create.mockResolvedValue(productRow());

    await api().post('/api/v1/products').set(asAdmin()).send(payload);

    expect(model('product').create.mock.calls[0][0].data.createdBy).toBe(UUID.admin);
  });

  it('400s on a negative price', async () => {
    const response = await api().post('/api/v1/products').set(asAdmin()).send({ ...payload, price: -100 });
    expect(response.status).toBe(400);
  });

  it('400s on a price with more than two decimal places', async () => {
    const response = await api().post('/api/v1/products').set(asAdmin()).send({ ...payload, price: 10.005 });
    expect(response.status).toBe(400);
  });

  it('400s on an unknown category', async () => {
    const response = await api().post('/api/v1/products').set(asAdmin()).send({ ...payload, category: 'MYTH' });
    expect(response.status).toBe(400);
  });

  it('accepts the empty-string originalPrice the admin form submits', async () => {
    model('product').create.mockResolvedValue(productRow());

    const response = await api()
      .post('/api/v1/products')
      .set(asAdmin())
      .send({ ...payload, originalPrice: '', gameType: '', thumbnailUrl: '' });

    expect(response.status).toBe(201);
    const data = model('product').create.mock.calls[0][0].data;
    expect(data.originalPrice).toBeNull();
    expect(data).not.toHaveProperty('gameType');
  });

  it('defaults stock to the unlimited sentinel', async () => {
    model('product').create.mockResolvedValue(productRow());

    await api().post('/api/v1/products').set(asAdmin()).send(payload);
    expect(model('product').create.mock.calls[0][0].data.quantityAvailable).toBe(-1);
  });

  it('creates nested specifications in the same call', async () => {
    model('product').create.mockResolvedValue(productRow());

    await api()
      .post('/api/v1/products')
      .set(asAdmin())
      .send({ ...payload, specifications: [{ name: 'Region', value: 'Global' }] });

    expect(model('product').create.mock.calls[0][0].data.specs.create).toEqual([
      { specName: 'Region', specValue: 'Global' },
    ]);
  });

  it('rejects a specification missing its value', async () => {
    const response = await api()
      .post('/api/v1/products')
      .set(asAdmin())
      .send({ ...payload, specifications: [{ name: 'Region' }] });

    expect(response.status).toBe(400);
  });

  // Regression: `createdBy`, `id` and `createdAt` were writable from the body.
  it.each([['id'], ['createdAt'], ['createdBy'], ['role']])(
    'rejects an unrecognised field (%s) rather than silently writing it',
    async (field) => {
      const response = await api()
        .post('/api/v1/products')
        .set(asAdmin())
        .send({ ...payload, [field]: 'attacker-controlled' });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].field).toBe(field);
      expect(model('product').create).not.toHaveBeenCalled();
    },
  );
});

describe('PATCH /products/:id', () => {
  beforeEach(() => {
    model('product').findUnique.mockResolvedValue(productRow({ specs: [] }));
    model('product').update.mockResolvedValue(productRow());
  });

  it('requires an admin', async () => {
    expect((await api().patch(`/api/v1/products/${UUID.product}`).send({ name: 'x' })).status).toBe(401);
    expect(
      (await api().patch(`/api/v1/products/${UUID.product}`).set(asUser(USER)).send({ name: 'x' })).status,
    ).toBe(403);
  });

  it('updates an allowed field', async () => {
    const response = await api().patch(`/api/v1/products/${UUID.product}`).set(asAdmin()).send({ price: 3999 });

    expect(response.status).toBe(200);
    expect(model('product').update.mock.calls[0][0].data.price).toBe(3999);
  });

  it('400s on an empty patch', async () => {
    const response = await api().patch(`/api/v1/products/${UUID.product}`).set(asAdmin()).send({});
    expect(response.status).toBe(400);
  });

  it('400s when a customer-supplied id is present', async () => {
    const response = await api()
      .patch(`/api/v1/products/${UUID.product}`)
      .set(asAdmin())
      .send({ id: 'another-product' });

    expect(response.status).toBe(400);
    expect(model('product').update).not.toHaveBeenCalled();
  });

  it('404s for an unknown product', async () => {
    model('product').findUnique.mockResolvedValue(null);

    const response = await api().patch(`/api/v1/products/${UUID.product}`).set(asAdmin()).send({ price: 10 });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /products/:id', () => {
  it('requires an admin', async () => {
    expect((await api().delete(`/api/v1/products/${UUID.product}`)).status).toBe(401);
    expect((await api().delete(`/api/v1/products/${UUID.product}`).set(asUser())).status).toBe(403);
  });

  /**
   * A product that has ever appeared in an order must be retired, not deleted:
   * the `OrderItem` rows are the shop's financial record.
   */
  it('retires a product that has order history', async () => {
    model('product').findUnique.mockResolvedValue({ id: UUID.product, _count: { orderItems: 3 } });
    model('product').update.mockResolvedValue(productRow());

    const response = await api().delete(`/api/v1/products/${UUID.product}`).set(asAdmin());

    expect(response.status).toBe(200);
    expect(model('product').delete).not.toHaveBeenCalled();
    expect(model('product').update.mock.calls[0][0].data).toMatchObject({ isAvailable: false });
  });

  it('hard-deletes a product with no order history', async () => {
    model('product').findUnique.mockResolvedValue({ id: UUID.product, _count: { orderItems: 0 } });
    model('product').delete.mockResolvedValue({ id: UUID.product });

    const response = await api().delete(`/api/v1/products/${UUID.product}`).set(asAdmin());

    expect(response.status).toBe(200);
    expect(model('product').delete).toHaveBeenCalled();
  });
});

describe('product toggles', () => {
  beforeEach(() => {
    model('product').findUnique.mockResolvedValue(productRow());
    model('product').update.mockResolvedValue(productRow());
  });

  it('toggles featured state for an admin', async () => {
    const response = await api().patch(`/api/v1/products/${UUID.product}/toggle-featured`).set(asAdmin());
    expect(response.status).toBe(200);
    expect(model('product').update.mock.calls[0][0].data).toMatchObject({ isFeatured: true });
  });

  it('toggles availability for an admin', async () => {
    const response = await api().patch(`/api/v1/products/${UUID.product}/toggle-availability`).set(asAdmin());
    expect(response.status).toBe(200);
    expect(model('product').update.mock.calls[0][0].data).toMatchObject({ isAvailable: false });
  });

  it('403s both toggles for a customer', async () => {
    expect(
      (await api().patch(`/api/v1/products/${UUID.product}/toggle-featured`).set(asUser())).status,
    ).toBe(403);
    expect(
      (await api().patch(`/api/v1/products/${UUID.product}/toggle-availability`).set(asUser())).status,
    ).toBe(403);
  });
});
