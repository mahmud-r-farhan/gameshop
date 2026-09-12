import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', async () => {
  const { prismaMock } = await import('../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { api, resetDb, model, UUID, asUser, asAdmin } = await import('./helpers.js');

/**
 * HTTP-level coverage for `/api/v1/feedback`.
 *
 * The `CustomerFeedback` model and the whole admin moderation surface already
 * existed, but there was no customer-facing endpoint to create a record — so the
 * feature was unreachable. These tests pin the loop shut.
 */

const FEEDBACK_ID = '6f1e2c3d-0000-4000-8000-0000000000f1';

const payload = {
  subject: 'Disc arrived scratched',
  message: 'The outer sleeve was torn when the courier handed it over.',
  category: 'COMPLAINT',
};

beforeEach(() => {
  resetDb();
  model('customerFeedback').findFirst.mockResolvedValue(null);
  model('customerFeedback').create.mockResolvedValue({ id: FEEDBACK_ID, status: 'OPEN' });
});

describe('POST /feedback', () => {
  it('requires authentication', async () => {
    expect((await api().post('/api/v1/feedback').send(payload)).status).toBe(401);
  });

  it('opens a ticket for a signed-in customer', async () => {
    const response = await api().post('/api/v1/feedback').set(asUser()).send(payload);

    expect(response.status).toBe(201);
    expect(model('customerFeedback').create.mock.calls[0][0].data).toMatchObject({
      userId: UUID.user,
      subject: 'Disc arrived scratched',
      category: 'COMPLAINT',
      status: 'OPEN',
    });
  });

  it('lets an admin file a ticket on a customer\'s behalf', async () => {
    const response = await api().post('/api/v1/feedback').set(asAdmin()).send(payload);

    expect(response.status).toBe(201);
    expect(model('customerFeedback').create.mock.calls[0][0].data.userId).toBe(UUID.admin);
  });

  it('400s for a subject too short to be useful', async () => {
    const response = await api().post('/api/v1/feedback').set(asUser()).send({ ...payload, subject: 'hi' });
    expect(response.status).toBe(400);
  });

  it('400s for a message too short to act on', async () => {
    const response = await api().post('/api/v1/feedback').set(asUser()).send({ ...payload, message: 'broken' });
    expect(response.status).toBe(400);
  });

  it('400s for an unknown category', async () => {
    const response = await api().post('/api/v1/feedback').set(asUser()).send({ ...payload, category: 'SPAM' });
    expect(response.status).toBe(400);
  });

  it('defaults the category to OTHER', async () => {
    const { category: _omit, ...rest } = payload;
    await api().post('/api/v1/feedback').set(asUser()).send(rest);
    expect(model('customerFeedback').create.mock.calls[0][0].data.category).toBe('OTHER');
  });

  it('rejects an unrecognised field', async () => {
    const response = await api()
      .post('/api/v1/feedback')
      .set(asUser())
      .send({ ...payload, status: 'RESOLVED' });

    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('status');
  });

  it('409s when the caller already has an open ticket with the same subject', async () => {
    model('customerFeedback').findFirst.mockResolvedValue({ id: 'duplicate' });

    const response = await api().post('/api/v1/feedback').set(asUser()).send(payload);

    expect(response.status).toBe(409);
    expect(model('customerFeedback').create).not.toHaveBeenCalled();
  });

  /**
   * Regression: `orderId` was validated for ownership and then thrown away —
   * `customer_feedback` had no column for it, so support never knew which order
   * a complaint referred to.
   */
  it('persists the order reference and returns it to the client', async () => {
    model('order').findFirst.mockResolvedValue({ id: UUID.order });
    model('customerFeedback').create.mockResolvedValue({
      id: FEEDBACK_ID,
      orderId: UUID.order,
      order: { id: UUID.order, orderNumber: 'ORD-1' },
    });

    const response = await api()
      .post('/api/v1/feedback')
      .set(asUser())
      .send({ ...payload, orderId: UUID.order });

    expect(response.status).toBe(201);
    expect(model('customerFeedback').create.mock.calls[0][0].data.orderId).toBe(UUID.order);
    expect(response.body.data.order).toMatchObject({ orderNumber: 'ORD-1' });
  });

  it('verifies the referenced order belongs to the caller', async () => {
    model('order').findFirst.mockResolvedValue({ id: UUID.order });

    await api().post('/api/v1/feedback').set(asUser()).send({ ...payload, orderId: UUID.order });

    expect(model('order').findFirst.mock.calls[0][0].where).toEqual({ id: UUID.order, userId: UUID.user });
  });

  it('404s for somebody else\'s order id instead of attaching it silently', async () => {
    model('order').findFirst.mockResolvedValue(null);

    const response = await api()
      .post('/api/v1/feedback')
      .set(asUser())
      .send({ ...payload, orderId: UUID.order });

    expect(response.status).toBe(404);
    expect(model('customerFeedback').create).not.toHaveBeenCalled();
  });

  it('400s for a malformed order id', async () => {
    const response = await api()
      .post('/api/v1/feedback')
      .set(asUser())
      .send({ ...payload, orderId: 'not-a-uuid' });

    expect(response.status).toBe(400);
  });
});

describe('GET /feedback', () => {
  beforeEach(() => {
    model('customerFeedback').findMany.mockResolvedValue([]);
    model('customerFeedback').count.mockResolvedValue(0);
  });

  it('requires authentication', async () => {
    expect((await api().get('/api/v1/feedback')).status).toBe(401);
  });

  it('returns only the caller\'s tickets', async () => {
    await api().get('/api/v1/feedback').set(asUser());

    expect(model('customerFeedback').findMany.mock.calls[0][0].where).toEqual({ userId: UUID.user });
    expect(model('customerFeedback').count.mock.calls[0][0].where).toEqual({ userId: UUID.user });
  });

  it('paginates newest first', async () => {
    model('customerFeedback').count.mockResolvedValue(12);

    const response = await api().get('/api/v1/feedback?page=2&limit=5').set(asUser());

    expect(model('customerFeedback').findMany.mock.calls[0][0]).toMatchObject({
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    });
    expect(response.body.data.pagination).toMatchObject({ currentPage: 2, totalPages: 3 });
  });
});

describe('GET /feedback/:id', () => {
  it('requires authentication', async () => {
    expect((await api().get(`/api/v1/feedback/${FEEDBACK_ID}`)).status).toBe(401);
  });

  it('400s for a malformed id', async () => {
    const response = await api().get('/api/v1/feedback/nope').set(asUser());
    expect(response.status).toBe(400);
  });

  it('returns the ticket when it belongs to the caller', async () => {
    model('customerFeedback').findFirst.mockResolvedValue({ id: FEEDBACK_ID, userId: UUID.user });

    const response = await api().get(`/api/v1/feedback/${FEEDBACK_ID}`).set(asUser());

    expect(response.status).toBe(200);
    expect(model('customerFeedback').findFirst.mock.calls[0][0].where).toEqual({
      id: FEEDBACK_ID,
      userId: UUID.user,
    });
  });

  // Ownership is enforced in the WHERE clause, so another customer's ticket is
  // indistinguishable from one that never existed.
  it('404s for another customer\'s ticket', async () => {
    model('customerFeedback').findFirst.mockResolvedValue(null);

    const response = await api().get(`/api/v1/feedback/${FEEDBACK_ID}`).set(asUser());
    expect(response.status).toBe(404);
  });
});
