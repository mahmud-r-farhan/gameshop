import { beforeEach, describe, expect, it, vi } from 'vitest';
import { model, resetPrismaMock } from '../../helpers/prisma-mock.js';

vi.mock('../../../src/config/database.js', async () => {
  const { prismaMock } = await import('../../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { feedbackService } = await import('../../../src/services/feedbackService.js');

const USER_ID = '6f1e2c3d-0000-4000-8000-0000000000b1';
const ORDER_ID = '6f1e2c3d-0000-4000-8000-0000000000b2';
const FEEDBACK_ID = '6f1e2c3d-0000-4000-8000-0000000000b3';

const payload = {
  subject: 'Disc arrived scratched',
  message: 'The outer sleeve was torn when the courier handed it over.',
  category: 'COMPLAINT',
};

beforeEach(() => {
  resetPrismaMock();
  model('customerFeedback').findFirst.mockResolvedValue(null);
  model('customerFeedback').create.mockResolvedValue({ id: FEEDBACK_ID });
});

describe('create', () => {
  it('opens a ticket in OPEN status with the supplied category', async () => {
    await feedbackService.create(USER_ID, payload);

    expect(model('customerFeedback').create.mock.calls[0][0].data).toMatchObject({
      userId: USER_ID,
      subject: 'Disc arrived scratched',
      category: 'COMPLAINT',
      status: 'OPEN',
    });
  });

  it('defaults the category to OTHER', async () => {
    await feedbackService.create(USER_ID, { subject: payload.subject, message: payload.message });
    expect(model('customerFeedback').create.mock.calls[0][0].data.category).toBe('OTHER');
  });

  it('trims the subject and message before storing them', async () => {
    await feedbackService.create(USER_ID, {
      subject: '  late delivery  ',
      message: '  it has been nine days  ',
    });

    expect(model('customerFeedback').create.mock.calls[0][0].data).toMatchObject({
      subject: 'late delivery',
      message: 'it has been nine days',
    });
  });

  // The duplicate check is case-insensitive, so "Late" and "late" are one ticket.
  it('scopes the duplicate check to the caller and to open tickets', async () => {
    await feedbackService.create(USER_ID, payload);

    expect(model('customerFeedback').findFirst.mock.calls[0][0]).toMatchObject({
      where: {
        userId: USER_ID,
        subject: { equals: 'Disc arrived scratched', mode: 'insensitive' },
        status: 'OPEN',
      },
    });
  });

  it('409s when the caller already has an open ticket with the same subject', async () => {
    model('customerFeedback').findFirst.mockResolvedValue({ id: 'dup' });

    await expect(feedbackService.create(USER_ID, payload)).rejects.toMatchObject({ statusCode: 409 });
    expect(model('customerFeedback').create).not.toHaveBeenCalled();
  });

  it('allows a repeat subject once the previous ticket is resolved', async () => {
    // findFirst only matches OPEN tickets, so a resolved duplicate never blocks.
    model('customerFeedback').findFirst.mockResolvedValue(null);
    await expect(feedbackService.create(USER_ID, payload)).resolves.toBeDefined();
  });

  it('persists the order reference so support knows which order it is about', async () => {
    model('order').findFirst.mockResolvedValue({ id: ORDER_ID });

    await feedbackService.create(USER_ID, { ...payload, orderId: ORDER_ID });

    expect(model('customerFeedback').create.mock.calls[0][0].data.orderId).toBe(ORDER_ID);
    expect(model('customerFeedback').create.mock.calls[0][0].include.order.select).toMatchObject({
      orderNumber: true,
    });
  });

  it('verifies the order belongs to the caller before accepting it', async () => {
    model('order').findFirst.mockResolvedValue({ id: ORDER_ID });

    await feedbackService.create(USER_ID, { ...payload, orderId: ORDER_ID });

    expect(model('order').findFirst.mock.calls[0][0]).toMatchObject({
      where: { id: ORDER_ID, userId: USER_ID },
    });
  });

  it('404s rather than silently dropping a foreign or missing order id', async () => {
    model('order').findFirst.mockResolvedValue(null);

    await expect(feedbackService.create(USER_ID, { ...payload, orderId: ORDER_ID })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(model('customerFeedback').create).not.toHaveBeenCalled();
  });

  it('stores null (not undefined) when no order is referenced', async () => {
    await feedbackService.create(USER_ID, payload);
    expect(model('customerFeedback').create.mock.calls[0][0].data.orderId).toBeNull();
  });
});

describe('listForUser', () => {
  it('only ever returns the caller\'s own tickets', async () => {
    model('customerFeedback').findMany.mockResolvedValue([]);
    model('customerFeedback').count.mockResolvedValue(0);

    await feedbackService.listForUser(USER_ID);

    expect(model('customerFeedback').findMany.mock.calls[0][0].where).toEqual({ userId: USER_ID });
    expect(model('customerFeedback').count.mock.calls[0][0].where).toEqual({ userId: USER_ID });
  });

  it('orders newest first and paginates', async () => {
    model('customerFeedback').findMany.mockResolvedValue([]);
    model('customerFeedback').count.mockResolvedValue(12);

    const result = await feedbackService.listForUser(USER_ID, 2, 5);

    expect(model('customerFeedback').findMany.mock.calls[0][0]).toMatchObject({
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    });
    expect(result.pagination).toMatchObject({ currentPage: 2, totalPages: 3, totalItems: 12 });
  });

  it('clamps NaN and negative pagination input', async () => {
    model('customerFeedback').findMany.mockResolvedValue([]);
    model('customerFeedback').count.mockResolvedValue(0);

    await feedbackService.listForUser(USER_ID, '-3', 'not-a-number');
    expect(model('customerFeedback').findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 10 });
  });
});

describe('getForUser', () => {
  it('refuses to return another customer\'s ticket', async () => {
    model('customerFeedback').findFirst.mockResolvedValue(null);

    await expect(feedbackService.getForUser(USER_ID, FEEDBACK_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(model('customerFeedback').findFirst.mock.calls[0][0].where).toEqual({
      id: FEEDBACK_ID,
      userId: USER_ID,
    });
  });

  it('returns the ticket when it belongs to the caller', async () => {
    model('customerFeedback').findFirst.mockResolvedValue({ id: FEEDBACK_ID, userId: USER_ID });
    await expect(feedbackService.getForUser(USER_ID, FEEDBACK_ID)).resolves.toMatchObject({
      id: FEEDBACK_ID,
    });
  });
});
