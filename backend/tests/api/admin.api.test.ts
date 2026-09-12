import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', async () => {
  const { prismaMock } = await import('../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { api, resetDb, model, UUID, asUser, asAdmin, asSuperAdmin, ADMIN, SUPER_ADMIN } = await import(
  './helpers.js'
);
const { prismaError } = await import('../helpers/prisma-mock.js');

/**
 * HTTP-level coverage for `/api/v1/admin`.
 *
 * Two things matter most here: the role gate on every route, and the fact that a
 * request body is never forwarded to Prisma verbatim.
 */

const OTHER_USER_ID = '6f1e2c3d-0000-4000-8000-0000000000ee';
const FEEDBACK_ID = '6f1e2c3d-0000-4000-8000-0000000000f1';

beforeEach(() => {
  resetDb();
});

describe('role gate', () => {
  const readRoutes = [
    '/api/v1/admin/dashboard/stats',
    '/api/v1/admin/analytics',
    '/api/v1/admin/payment-gateways',
    '/api/v1/admin/payments',
    '/api/v1/admin/promotions',
    '/api/v1/admin/feedback',
    '/api/v1/admin/users',
    '/api/v1/admin/settings',
  ];

  it.each(readRoutes)('%s rejects an anonymous caller', async (path) => {
    expect((await api().get(path)).status).toBe(401);
  });

  /**
   * A customer token is a *valid* JWT, so a missing role check would render the
   * entire admin console to any signed-in shopper.
   */
  it.each(readRoutes)('%s rejects a customer holding a valid token', async (path) => {
    const response = await api().get(path).set(asUser());
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ success: false, code: 'FORBIDDEN' });
  });

  it('rejects a customer on every write route', async () => {
    expect((await api().post('/api/v1/admin/payment-gateways').set(asUser()).send({})).status).toBe(403);
    expect((await api().put(`/api/v1/admin/payment-gateways/${UUID.gateway}`).set(asUser()).send({})).status).toBe(403);
    expect((await api().delete(`/api/v1/admin/payment-gateways/${UUID.gateway}`).set(asUser())).status).toBe(403);
    expect((await api().post('/api/v1/admin/promotions').set(asUser()).send({})).status).toBe(403);
    expect((await api().patch(`/api/v1/admin/promotions/${UUID.promo}/toggle`).set(asUser())).status).toBe(403);
    expect((await api().post('/api/v1/admin/feedback').set(asUser()).send({})).status).toBe(403);
    expect((await api().post(`/api/v1/admin/feedback/${FEEDBACK_ID}/reply`).set(asUser()).send({})).status).toBe(403);
    expect((await api().patch(`/api/v1/admin/users/${OTHER_USER_ID}/toggle-status`).set(asUser())).status).toBe(403);
    expect((await api().put('/api/v1/admin/settings/shop.name').set(asUser()).send({})).status).toBe(403);
  });

  it('rejects a hand-forged role claim inside an otherwise valid token shape', async () => {
    // The token is signed with the wrong secret, so it must not verify at all.
    const response = await api()
      .get('/api/v1/admin/users')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiU1VQRVJfQURNSU4ifQ.fake');

    expect(response.status).toBe(401);
  });
});

describe('role changes are super-admin only', () => {
  it('403s for a plain ADMIN', async () => {
    const response = await api()
      .patch(`/api/v1/admin/users/${OTHER_USER_ID}/role`)
      .set(asAdmin())
      .send({ role: 'SUPER_ADMIN' });

    expect(response.status).toBe(403);
    expect(model('user').update).not.toHaveBeenCalled();
  });

  it('succeeds for a SUPER_ADMIN', async () => {
    model('user').update.mockResolvedValue({ id: OTHER_USER_ID, role: 'ADMIN' });

    const response = await api()
      .patch(`/api/v1/admin/users/${OTHER_USER_ID}/role`)
      .set(asSuperAdmin())
      .send({ role: 'ADMIN' });

    expect(response.status).toBe(200);
    expect(model('user').update.mock.calls[0][0]).toMatchObject({
      where: { id: OTHER_USER_ID },
      data: { role: 'ADMIN' },
    });
  });

  it('400s for a role outside the enum', async () => {
    const response = await api()
      .patch(`/api/v1/admin/users/${OTHER_USER_ID}/role`)
      .set(asSuperAdmin())
      .send({ role: 'OWNER' });

    expect(response.status).toBe(400);
  });

  // Privilege escalation: an admin must not be able to rewrite their own role,
  // nor to demote the only super admin.
  it('403s when a super admin targets their own account', async () => {
    const response = await api()
      .patch(`/api/v1/admin/users/${SUPER_ADMIN.id}/role`)
      .set(asSuperAdmin())
      .send({ role: 'USER' });

    expect(response.status).toBe(403);
  });

  it('rejects an extra body field', async () => {
    const response = await api()
      .patch(`/api/v1/admin/users/${OTHER_USER_ID}/role`)
      .set(asSuperAdmin())
      .send({ role: 'ADMIN', isActive: false });

    expect(response.status).toBe(400);
  });
});

describe('user status toggles', () => {
  beforeEach(() => {
    // Echo back the requested id: the guard compares the *stored* row's id with
    // the actor's, so a fixture that always returns the same id cannot exercise
    // the self-targeting case.
    model('user').findUnique.mockImplementation(async (args: { where: { id: string } }) =>
      args.where.id === ADMIN.id
        ? { id: ADMIN.id, isActive: true, role: 'ADMIN' }
        : { id: OTHER_USER_ID, isActive: true, role: 'USER' },
    );
    model('user').update.mockImplementation(async (args: { where: { id: string } }) => ({
      id: args.where.id,
      isActive: false,
    }));
  });

  it('disables a customer account', async () => {
    const response = await api().patch(`/api/v1/admin/users/${OTHER_USER_ID}/toggle-status`).set(asAdmin());

    expect(response.status).toBe(200);
    expect(model('user').update.mock.calls[0][0].data).toEqual({ isActive: false });
  });

  // Locking yourself out mid-session with no way back in was possible before.
  it('403s when an admin targets their own account', async () => {
    const response = await api().patch(`/api/v1/admin/users/${ADMIN.id}/toggle-status`).set(asAdmin());

    expect(response.status).toBe(403);
    expect(model('user').update).not.toHaveBeenCalled();
  });

  it('403s when a plain admin targets another administrator', async () => {
    model('user').findUnique.mockResolvedValue({ id: OTHER_USER_ID, isActive: true, role: 'ADMIN' });

    const response = await api().patch(`/api/v1/admin/users/${OTHER_USER_ID}/toggle-status`).set(asAdmin());

    expect(response.status).toBe(403);
    expect(model('user').update).not.toHaveBeenCalled();
  });

  it('404s for an unknown user instead of leaking a Prisma error', async () => {
    model('user').findUnique.mockResolvedValue(null);

    const response = await api().patch(`/api/v1/admin/users/${OTHER_USER_ID}/toggle-status`).set(asAdmin());
    expect(response.status).toBe(404);
  });

  it('never returns a password hash', async () => {
    await api().patch(`/api/v1/admin/users/${OTHER_USER_ID}/toggle-status`).set(asAdmin());
    expect(model('user').update.mock.calls[0][0].select).not.toHaveProperty('passwordHash');
  });
});

describe('GET /admin/users', () => {
  beforeEach(() => {
    model('user').findMany.mockResolvedValue([]);
    model('user').count.mockResolvedValue(0);
  });

  it('filters by role and active state', async () => {
    await api().get('/api/v1/admin/users?role=ADMIN&isActive=false').set(asAdmin());

    expect(model('user').findMany.mock.calls[0][0].where).toEqual({ role: 'ADMIN', isActive: false });
  });

  it('400s for an unknown role filter', async () => {
    const response = await api().get('/api/v1/admin/users?role=OWNER').set(asAdmin());
    expect(response.status).toBe(400);
  });

  it('searches by name, email or phone', async () => {
    await api().get('/api/v1/admin/users?search=ada').set(asAdmin());
    expect(model('user').findMany.mock.calls[0][0].where.OR).toHaveLength(3);
  });

  it('never selects the password hash for the admin table', async () => {
    await api().get('/api/v1/admin/users').set(asAdmin());
    expect(model('user').findMany.mock.calls[0][0].select).not.toHaveProperty('passwordHash');
  });
});

describe('payment gateways', () => {
  const payload = {
    gatewayName: 'bKash',
    gatewayType: 'MOBILE_BANKING',
    accountIdentifier: '01700000000',
    instructions: 'Send money and submit the transaction id',
  };

  beforeEach(() => {
    model('paymentGateway').findMany.mockResolvedValue([]);
    model('paymentGateway').create.mockResolvedValue({ id: UUID.gateway, ...payload });
    model('paymentGateway').findUnique.mockResolvedValue({ id: UUID.gateway });
    model('paymentGateway').update.mockResolvedValue({ id: UUID.gateway });
    model('paymentGateway').delete.mockResolvedValue({ id: UUID.gateway });
  });

  it('creates a gateway', async () => {
    const response = await api().post('/api/v1/admin/payment-gateways').set(asAdmin()).send(payload);

    expect(response.status).toBe(201);
    expect(model('paymentGateway').create.mock.calls[0][0].data).toMatchObject({ gatewayName: 'bKash' });
  });

  // Regression: `req.body` went straight into Prisma.
  it.each([['id'], ['createdAt'], ['createdBy'], ['displayOrderHack']])(
    'rejects an unrecognised field (%s) instead of writing it',
    async (field) => {
      const response = await api()
        .post('/api/v1/admin/payment-gateways')
        .set(asAdmin())
        .send({ ...payload, [field]: 'attacker' });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].field).toBe(field);
      expect(model('paymentGateway').create).not.toHaveBeenCalled();
    },
  );

  it('requires a gateway name', async () => {
    const response = await api().post('/api/v1/admin/payment-gateways').set(asAdmin()).send({});
    expect(response.status).toBe(400);
  });

  it('409s on a duplicate gateway name', async () => {
    model('paymentGateway').create.mockRejectedValue(prismaError('P2002', { target: ['gateway_name'] }));

    const response = await api().post('/api/v1/admin/payment-gateways').set(asAdmin()).send(payload);
    expect(response.status).toBe(409);
  });

  it('updates only the supplied fields', async () => {
    const response = await api()
      .put(`/api/v1/admin/payment-gateways/${UUID.gateway}`)
      .set(asAdmin())
      .send({ instructions: 'Updated instructions' });

    expect(response.status).toBe(200);
    expect(model('paymentGateway').update.mock.calls[0][0].data).toEqual({
      instructions: 'Updated instructions',
    });
  });

  it('400s on an empty update', async () => {
    const response = await api()
      .put(`/api/v1/admin/payment-gateways/${UUID.gateway}`)
      .set(asAdmin())
      .send({});

    expect(response.status).toBe(400);
  });

  /**
   * Regression: deleting an unknown id raised P2025 and returned a 500, which
   * the admin console rendered as "server error" for what is really a stale view.
   */
  it('404s when deleting an unknown gateway', async () => {
    model('paymentGateway').findUnique.mockResolvedValue(null);

    const response = await api().delete(`/api/v1/admin/payment-gateways/${UUID.gateway}`).set(asAdmin());
    expect(response.status).toBe(404);
    expect(model('paymentGateway').delete).not.toHaveBeenCalled();
  });

  it('deletes a known gateway', async () => {
    const response = await api().delete(`/api/v1/admin/payment-gateways/${UUID.gateway}`).set(asAdmin());
    expect(response.status).toBe(200);
    expect(model('paymentGateway').delete).toHaveBeenCalled();
  });
});

describe('promotions', () => {
  const payload = {
    code: 'welcome10',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: '2026-12-31T00:00:00.000Z',
  };

  beforeEach(() => {
    model('promotion').findMany.mockResolvedValue([]);
    model('promotion').count.mockResolvedValue(0);
    model('promotion').create.mockResolvedValue({ id: UUID.promo, code: 'WELCOME10' });
    model('promotion').findUnique.mockResolvedValue({ id: UUID.promo, isActive: true });
    model('promotion').update.mockResolvedValue({ id: UUID.promo, isActive: false });
  });

  it('creates a promotion, upper-casing the code', async () => {
    const response = await api().post('/api/v1/admin/promotions').set(asAdmin()).send(payload);

    expect(response.status).toBe(201);
    expect(model('promotion').create.mock.calls[0][0].data.code).toBe('WELCOME10');
  });

  it('stamps createdBy from the token', async () => {
    await api().post('/api/v1/admin/promotions').set(asAdmin()).send(payload);
    expect(model('promotion').create.mock.calls[0][0].data.createdBy).toBe(ADMIN.id);
  });

  it('rejects a percentage above 100', async () => {
    const response = await api()
      .post('/api/v1/admin/promotions')
      .set(asAdmin())
      .send({ ...payload, discountValue: 500 });

    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('discountValue');
  });

  it('rejects a validUntil before validFrom', async () => {
    const response = await api()
      .post('/api/v1/admin/promotions')
      .set(asAdmin())
      .send({ ...payload, validUntil: '2025-01-01T00:00:00.000Z' });

    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('validUntil');
  });

  it('rejects a code with characters that would break a URL', async () => {
    const response = await api()
      .post('/api/v1/admin/promotions')
      .set(asAdmin())
      .send({ ...payload, code: 'SAVE 50%!' });

    expect(response.status).toBe(400);
  });

  it('409s on a duplicate code', async () => {
    model('promotion').create.mockRejectedValue(prismaError('P2002', { target: ['code'] }));

    const response = await api().post('/api/v1/admin/promotions').set(asAdmin()).send(payload);
    expect(response.status).toBe(409);
  });

  // Regression: the duplicate check compared raw input against upper-cased rows,
  // so "welcome10" and "WELCOME10" were treated as different codes.
  it('stores the discount as a 2dp decimal string', async () => {
    await api().post('/api/v1/admin/promotions').set(asAdmin()).send(payload);
    expect(model('promotion').create.mock.calls[0][0].data.discountValue).toBe('10.00');
  });

  it('toggles a promotion', async () => {
    const response = await api().patch(`/api/v1/admin/promotions/${UUID.promo}/toggle`).set(asAdmin());

    expect(response.status).toBe(200);
    expect(model('promotion').update).toHaveBeenCalledWith({
      where: { id: UUID.promo },
      data: { isActive: false },
    });
  });

  it('404s when toggling an unknown promotion', async () => {
    model('promotion').findUnique.mockResolvedValue(null);

    const response = await api().patch(`/api/v1/admin/promotions/${UUID.promo}/toggle`).set(asAdmin());
    expect(response.status).toBe(404);
  });

  it('validates applicable product ids up front', async () => {
    model('product').count.mockResolvedValue(1);

    const response = await api()
      .post('/api/v1/admin/promotions')
      .set(asAdmin())
      .send({ ...payload, applicableProductIds: [UUID.product, UUID.order] });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/do not exist/);
  });

  it('filters the list to active promotions', async () => {
    await api().get('/api/v1/admin/promotions?active=true').set(asAdmin());
    expect(model('promotion').findMany.mock.calls[0][0].where).toEqual({ isActive: true });
  });
});

describe('feedback moderation', () => {
  beforeEach(() => {
    model('customerFeedback').findMany.mockResolvedValue([]);
    model('customerFeedback').count.mockResolvedValue(0);
    model('customerFeedback').update.mockResolvedValue({ id: FEEDBACK_ID });
  });

  it('replies and resolves a ticket', async () => {
    const response = await api()
      .post(`/api/v1/admin/feedback/${FEEDBACK_ID}/reply`)
      .set(asAdmin())
      .send({ reply: 'Fixed in the latest release' });

    expect(response.status).toBe(200);
    expect(model('customerFeedback').update.mock.calls[0][0].data).toMatchObject({
      adminReply: 'Fixed in the latest release',
      repliedBy: ADMIN.id,
      status: 'RESOLVED',
    });
  });

  it('honours an explicit status so a ticket can stay open', async () => {
    await api()
      .post(`/api/v1/admin/feedback/${FEEDBACK_ID}/reply`)
      .set(asAdmin())
      .send({ reply: 'Investigating', status: 'IN_PROGRESS' });

    expect(model('customerFeedback').update.mock.calls[0][0].data.status).toBe('IN_PROGRESS');
  });

  it('400s for an empty reply', async () => {
    const response = await api()
      .post(`/api/v1/admin/feedback/${FEEDBACK_ID}/reply`)
      .set(asAdmin())
      .send({ reply: '   ' });

    expect(response.status).toBe(400);
  });

  it('400s for a status outside the workflow', async () => {
    const response = await api()
      .post(`/api/v1/admin/feedback/${FEEDBACK_ID}/reply`)
      .set(asAdmin())
      .send({ reply: 'hi', status: 'CLOSED_FOREVER' });

    expect(response.status).toBe(400);
  });

  // Regression: replying to a deleted ticket raised P2025 and returned a 500.
  it('404s when the ticket no longer exists', async () => {
    model('customerFeedback').update.mockRejectedValue(prismaError('P2025'));

    const response = await api()
      .post(`/api/v1/admin/feedback/${FEEDBACK_ID}/reply`)
      .set(asAdmin())
      .send({ reply: 'hi' });

    expect(response.status).toBe(404);
  });

  it('filters the queue by status and category', async () => {
    await api().get('/api/v1/admin/feedback?status=open&category=bug').set(asAdmin());

    expect(model('customerFeedback').findMany.mock.calls[0][0].where).toEqual({
      status: 'OPEN',
      category: 'BUG',
    });
  });

  it('400s for an unknown category filter', async () => {
    const response = await api().get('/api/v1/admin/feedback?category=SPAM').set(asAdmin());
    expect(response.status).toBe(400);
  });

  it('includes the order a complaint refers to', async () => {
    await api().get('/api/v1/admin/feedback').set(asAdmin());
    expect(model('customerFeedback').findMany.mock.calls[0][0].include.order.select).toMatchObject({
      orderNumber: true,
    });
  });
});

describe('settings', () => {
  beforeEach(() => {
    model('adminSettings').findMany.mockResolvedValue([]);
    model('adminSettings').upsert.mockResolvedValue({ settingKey: 'shop.name' });
  });

  it('upserts a setting and records who changed it', async () => {
    const response = await api()
      .put('/api/v1/admin/settings/shop.name')
      .set(asAdmin())
      .send({ value: 'GameShop BD', settingType: 'string' });

    expect(response.status).toBe(200);
    expect(model('adminSettings').upsert.mock.calls[0][0]).toMatchObject({
      where: { settingKey: 'shop.name' },
      update: { settingValue: 'GameShop BD', updatedBy: ADMIN.id, settingType: 'string' },
    });
  });

  it('400s when no value is supplied', async () => {
    const response = await api().put('/api/v1/admin/settings/shop.name').set(asAdmin()).send({});
    expect(response.status).toBe(400);
  });

  // The key becomes part of the URL and of a `where` clause; the allow-list keeps
  // it out of trouble.
  it('400s for a key containing path traversal', async () => {
    const response = await api()
      .put('/api/v1/admin/settings/..%2F..%2Fsecret')
      .set(asAdmin())
      .send({ value: 'x' });

    expect(response.status).toBe(400);
  });

  it('400s for an unknown settingType', async () => {
    const response = await api()
      .put('/api/v1/admin/settings/shop.name')
      .set(asAdmin())
      .send({ value: 'x', settingType: 'blob' });

    expect(response.status).toBe(400);
  });
});

describe('payments ledger', () => {
  beforeEach(() => {
    model('payment').findMany.mockResolvedValue([]);
    model('payment').count.mockResolvedValue(0);
  });

  it('filters by status and method', async () => {
    await api().get('/api/v1/admin/payments?status=pending&method=bkash').set(asAdmin());

    expect(model('payment').findMany.mock.calls[0][0].where).toEqual({
      status: 'PENDING',
      paymentMethod: 'BKASH',
    });
  });

  /**
   * The inline enum used to omit PENDING_VERIFICATION, so the one queue that
   * actually needs an admin's attention could not be filtered.
   */
  it('can filter to the payments awaiting verification', async () => {
    await api().get('/api/v1/admin/payments?status=pending_verification').set(asAdmin());

    expect(model('payment').findMany.mock.calls[0][0].where).toEqual({ status: 'PENDING_VERIFICATION' });
  });

  it('400s for an unknown payment status', async () => {
    const response = await api().get('/api/v1/admin/payments?status=PAID').set(asAdmin());
    expect(response.status).toBe(400);
  });

  it('never returns customer passwords alongside the ledger', async () => {
    await api().get('/api/v1/admin/payments').set(asAdmin());
    expect(model('payment').findMany.mock.calls[0][0].include.user.select).not.toHaveProperty(
      'passwordHash',
    );
  });
});

describe('dashboard and analytics', () => {
  beforeEach(() => {
    model('order').aggregate.mockImplementation(async (args: { _count?: unknown }) =>
      args?._count ? { _count: { _all: 12 } } : { _sum: { totalAmount: '150000.00' } },
    );
    model('order').count.mockResolvedValue(3);
    model('order').groupBy.mockResolvedValue([{ orderStatus: 'PENDING', _count: { _all: 4 } }]);
    model('order').findMany.mockResolvedValue([]);
    model('payment').groupBy.mockResolvedValue([]);
    model('orderItem').groupBy.mockResolvedValue([]);
    model('product').count.mockResolvedValue(2);
  });

  /**
   * Regression: the dashboard loaded every order and payment row since the start
   * of each period into Node — three times over, since the periods overlap.
   */
  it('computes the dashboard from aggregates, not from loaded rows', async () => {
    const response = await api().get('/api/v1/admin/dashboard/stats').set(asAdmin());

    expect(response.status).toBe(200);
    expect(model('order').aggregate).toHaveBeenCalled();
    expect(model('payment').findMany).not.toHaveBeenCalled();
    expect(response.body.data.today).toMatchObject({ totalOrders: 12, totalRevenue: 150000 });
  });

  it('returns revenue as a JSON number the chart can plot', async () => {
    const response = await api().get('/api/v1/admin/dashboard/stats').set(asAdmin());
    expect(typeof response.body.data.today.totalRevenue).toBe('number');
  });

  it('returns an analytics series for an explicit range', async () => {
    model('order').findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-03-01T10:00:00Z'),
        totalAmount: '100.00',
        paymentStatus: 'VERIFIED',
        orderStatus: 'DELIVERED',
      },
    ]);

    const response = await api()
      .get('/api/v1/admin/analytics?from=2026-03-01&to=2026-03-31&granularity=day')
      .set(asAdmin());

    expect(response.status).toBe(200);
    expect(response.body.data.series[0]).toMatchObject({ orders: 1, revenue: 100 });
  });

  it('400s when the analytics range is inverted', async () => {
    const response = await api()
      .get('/api/v1/admin/analytics?from=2026-03-31&to=2026-03-01')
      .set(asAdmin());

    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('to');
  });

  it('400s for an unparseable analytics date', async () => {
    const response = await api().get('/api/v1/admin/analytics?from=not-a-date').set(asAdmin());
    expect(response.status).toBe(400);
  });

  it('400s for an unknown granularity', async () => {
    const response = await api().get('/api/v1/admin/analytics?granularity=hour').set(asAdmin());
    expect(response.status).toBe(400);
  });
});
