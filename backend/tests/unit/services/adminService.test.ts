import { beforeEach, describe, expect, it, vi } from 'vitest';
import { model, prismaError, resetPrismaMock } from '../../helpers/prisma-mock.js';

vi.mock('../../../src/config/database.js', async () => {
  const { prismaMock } = await import('../../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { adminService } = await import('../../../src/services/adminService.js');

const ADMIN = { id: 'admin-1', role: 'ADMIN' };
const SUPER_ADMIN = { id: 'root-1', role: 'SUPER_ADMIN' };
const GATEWAY_ID = '6f1e2c3d-0000-4000-8000-000000000001';
const USER_ID = '6f1e2c3d-0000-4000-8000-000000000002';
const PROMO_ID = '6f1e2c3d-0000-4000-8000-000000000003';

beforeEach(() => {
  resetPrismaMock();
});

describe('payment gateways', () => {
  it('lists gateways in display order', async () => {
    model('paymentGateway').findMany.mockResolvedValue([]);
    await adminService.getPaymentGateways();
    expect(model('paymentGateway').findMany.mock.calls[0][0].orderBy).toEqual([
      { displayOrder: 'asc' },
      { createdAt: 'asc' },
    ]);
  });

  it('exposes a credential-free projection for the public checkout endpoint', async () => {
    model('paymentGateway').findMany.mockResolvedValue([]);
    await adminService.getEnabledPaymentGateways();

    const args = model('paymentGateway').findMany.mock.calls[0][0];
    expect(args.where).toEqual({ isEnabled: true });
    expect(args.select).not.toHaveProperty('settings');
    expect(args.select).toMatchObject({ gatewayName: true, accountIdentifier: true });
  });

  // Regression: `req.body` was forwarded straight into Prisma.
  it('ignores unwhitelisted columns on create', async () => {
    model('paymentGateway').create.mockResolvedValue({ id: GATEWAY_ID });

    await adminService.createPaymentGateway({
      gatewayName: 'bKash',
      id: 'preset',
      createdAt: '1970-01-01',
      isEnabled: false,
    });

    const data = model('paymentGateway').create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('createdAt');
    expect(data).toMatchObject({ gatewayName: 'bKash', isEnabled: false });
  });

  it('requires a gateway name', async () => {
    await expect(adminService.createPaymentGateway({})).rejects.toMatchObject({ statusCode: 400 });
    expect(model('paymentGateway').create).not.toHaveBeenCalled();
  });

  it('translates a duplicate name into a 409', async () => {
    model('paymentGateway').create.mockRejectedValue(prismaError('P2002', { target: ['gateway_name'] }));
    await expect(adminService.createPaymentGateway({ gatewayName: 'bKash' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('404s when updating or deleting an unknown gateway', async () => {
    model('paymentGateway').findUnique.mockResolvedValue(null);
    await expect(adminService.updatePaymentGateway('nope', { gatewayName: 'x' })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(adminService.deletePaymentGateway('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates only whitelisted fields', async () => {
    model('paymentGateway').findUnique.mockResolvedValue({ id: GATEWAY_ID });
    model('paymentGateway').update.mockResolvedValue({ id: GATEWAY_ID });

    await adminService.updatePaymentGateway(GATEWAY_ID, {
      instructions: 'Send money first',
      createdBy: 'attacker',
    });

    const data = model('paymentGateway').update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toEqual({ instructions: 'Send money first' });
  });
});

describe('promotions', () => {
  const validPromo = {
    code: 'welcome10',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: '2026-06-01T00:00:00.000Z',
    createdBy: ADMIN.id,
  };

  it('upper-cases the code and stores money as a 2dp string', async () => {
    model('promotion').create.mockResolvedValue({ id: PROMO_ID });

    await adminService.createPromotion(validPromo);

    const data = model('promotion').create.mock.calls[0][0].data;
    expect(data.code).toBe('WELCOME10');
    expect(data.discountValue).toBe('10.00');
    expect(data.validFrom).toBeInstanceOf(Date);
  });

  it('defaults to active and leaves optional fields null rather than undefined', async () => {
    model('promotion').create.mockResolvedValue({ id: PROMO_ID });
    await adminService.createPromotion(validPromo);

    const data = model('promotion').create.mock.calls[0][0].data;
    expect(data.isActive).toBe(true);
    expect(data.maxUsage).toBeNull();
    expect(data.minPurchaseAmount).toBeNull();
  });

  it('formats the minimum purchase amount as money', async () => {
    model('promotion').create.mockResolvedValue({ id: PROMO_ID });
    await adminService.createPromotion({ ...validPromo, minPurchaseAmount: 200 });
    expect(model('promotion').create.mock.calls[0][0].data.minPurchaseAmount).toBe('200.00');
  });

  it('rejects a duplicate code with a 409', async () => {
    model('promotion').create.mockRejectedValue(prismaError('P2002', { target: ['code'] }));
    await expect(adminService.createPromotion(validPromo)).rejects.toMatchObject({ statusCode: 409 });
  });

  // A connect to a non-existent product used to surface as an opaque Prisma error.
  it('validates applicable product ids before connecting them', async () => {
    model('product').count.mockResolvedValue(1);

    await expect(
      adminService.createPromotion({
        ...validPromo,
        applicableProductIds: ['id-1', 'id-2'],
      }),
    ).rejects.toThrow(/do not exist/);

    expect(model('promotion').create).not.toHaveBeenCalled();
  });

  it('connects applicable products when they all exist', async () => {
    model('product').count.mockResolvedValue(2);
    model('promotion').create.mockResolvedValue({ id: PROMO_ID });

    await adminService.createPromotion({
      ...validPromo,
      applicableProductIds: ['id-1', 'id-2'],
    });

    expect(model('promotion').create.mock.calls[0][0].data.applicableProducts).toEqual({
      connect: [{ id: 'id-1' }, { id: 'id-2' }],
    });
  });

  it('toggles isActive', async () => {
    model('promotion').findUnique.mockResolvedValue({ id: PROMO_ID, isActive: true });
    model('promotion').update.mockResolvedValue({ id: PROMO_ID, isActive: false });

    await adminService.togglePromotion(PROMO_ID);
    expect(model('promotion').update).toHaveBeenCalledWith({
      where: { id: PROMO_ID },
      data: { isActive: false },
    });
  });

  it('404s when toggling an unknown promotion', async () => {
    model('promotion').findUnique.mockResolvedValue(null);
    await expect(adminService.togglePromotion('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('paginates and can filter to active promotions', async () => {
    model('promotion').findMany.mockResolvedValue([]);
    model('promotion').count.mockResolvedValue(0);

    await adminService.getPromotions(2, 10, true);

    expect(model('promotion').findMany.mock.calls[0][0]).toMatchObject({
      where: { isActive: true },
      skip: 10,
      take: 10,
    });
  });
});

describe('feedback', () => {
  it('records the reply, the replier and resolves the ticket', async () => {
    model('customerFeedback').update.mockResolvedValue({ id: 'fb-1' });

    await adminService.replyToFeedback('fb-1', 'Fixed in the latest release', ADMIN.id);

    const data = model('customerFeedback').update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      adminReply: 'Fixed in the latest release',
      repliedBy: ADMIN.id,
      status: 'RESOLVED',
    });
    expect(data.repliedAt).toBeInstanceOf(Date);
  });

  it('honours an explicit status', async () => {
    model('customerFeedback').update.mockResolvedValue({ id: 'fb-1' });
    await adminService.replyToFeedback('fb-1', 'Looking into it', ADMIN.id, 'IN_PROGRESS');
    expect(model('customerFeedback').update.mock.calls[0][0].data.status).toBe('IN_PROGRESS');
  });

  // Regression: replying to a deleted ticket raised P2025 and returned a 500.
  it('404s for an unknown ticket', async () => {
    model('customerFeedback').update.mockRejectedValue(prismaError('P2025'));
    await expect(adminService.replyToFeedback('nope', 'hi', ADMIN.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('filters the admin queue by status and category', async () => {
    model('customerFeedback').findMany.mockResolvedValue([]);
    model('customerFeedback').count.mockResolvedValue(0);

    await adminService.getFeedback(1, 20, 'OPEN', 'BUG');
    expect(model('customerFeedback').findMany.mock.calls[0][0].where).toEqual({
      status: 'OPEN',
      category: 'BUG',
    });
  });

  it('surfaces unresolved tickets first', async () => {
    model('customerFeedback').findMany.mockResolvedValue([]);
    model('customerFeedback').count.mockResolvedValue(0);

    await adminService.getFeedback();
    expect(model('customerFeedback').findMany.mock.calls[0][0].orderBy).toEqual([
      { status: 'asc' },
      { createdAt: 'desc' },
    ]);
  });
});

describe('settings', () => {
  it('upserts a setting and records who changed it', async () => {
    model('adminSettings').upsert.mockResolvedValue({ settingKey: 'shop.name' });

    await adminService.updateSetting('shop.name', 'GameShop BD', ADMIN.id, {
      settingType: 'string',
      description: 'Storefront name',
    });

    const args = model('adminSettings').upsert.mock.calls[0][0];
    expect(args.where).toEqual({ settingKey: 'shop.name' });
    expect(args.create).toMatchObject({
      settingKey: 'shop.name',
      settingValue: 'GameShop BD',
      updatedBy: ADMIN.id,
      settingType: 'string',
    });
    expect(args.update).not.toHaveProperty('settingKey');
  });

  it('stores null rather than undefined for a cleared value', async () => {
    model('adminSettings').upsert.mockResolvedValue({ settingKey: 'x' });
    await adminService.updateSetting('x', undefined, ADMIN.id);
    expect(model('adminSettings').upsert.mock.calls[0][0].update.settingValue).toBeNull();
  });
});

describe('user management', () => {
  it('never selects the password hash', async () => {
    model('user').findMany.mockResolvedValue([]);
    model('user').count.mockResolvedValue(0);

    await adminService.getUsers();

    const select = model('user').findMany.mock.calls[0][0].select as Record<string, unknown>;
    expect(select).not.toHaveProperty('passwordHash');
    expect(select).toMatchObject({ email: true, role: true, isActive: true });
  });

  it('searches across name, email and phone', async () => {
    model('user').findMany.mockResolvedValue([]);
    model('user').count.mockResolvedValue(0);

    await adminService.getUsers(1, 20, ' ada ');
    expect(model('user').findMany.mock.calls[0][0].where.OR).toEqual([
      { fullName: { contains: 'ada', mode: 'insensitive' } },
      { email: { contains: 'ada', mode: 'insensitive' } },
      { phone: { contains: 'ada', mode: 'insensitive' } },
    ]);
  });

  it('ignores a whitespace-only search term', async () => {
    model('user').findMany.mockResolvedValue([]);
    model('user').count.mockResolvedValue(0);

    await adminService.getUsers(1, 20, '   ');
    expect(model('user').findMany.mock.calls[0][0].where).toEqual({});
  });

  it('toggles another user\'s status', async () => {
    model('user').findUnique.mockResolvedValue({ id: USER_ID, isActive: true, role: 'USER' });
    model('user').update.mockResolvedValue({ id: USER_ID, isActive: false });

    await adminService.toggleUserStatus(USER_ID, ADMIN);
    expect(model('user').update.mock.calls[0][0].data).toEqual({ isActive: false });
  });

  // Regression: an admin could disable their own account mid-session with no way
  // back in.
  it('refuses to let an admin disable themselves', async () => {
    model('user').findUnique.mockResolvedValue({ id: ADMIN.id, isActive: true, role: 'ADMIN' });
    await expect(adminService.toggleUserStatus(ADMIN.id, ADMIN)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(model('user').update).not.toHaveBeenCalled();
  });

  it('refuses to let a plain ADMIN touch another administrator', async () => {
    model('user').findUnique.mockResolvedValue({ id: 'other-admin', isActive: true, role: 'ADMIN' });
    await expect(adminService.toggleUserStatus('other-admin', ADMIN)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('lets a SUPER_ADMIN manage another administrator', async () => {
    model('user').findUnique.mockResolvedValue({ id: 'other-admin', isActive: true, role: 'ADMIN' });
    model('user').update.mockResolvedValue({ id: 'other-admin', isActive: false });

    await expect(adminService.toggleUserStatus('other-admin', SUPER_ADMIN)).resolves.toBeDefined();
  });

  it('404s for an unknown user', async () => {
    model('user').findUnique.mockResolvedValue(null);
    await expect(adminService.toggleUserStatus('nope', ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns a credential-free projection after toggling', async () => {
    model('user').findUnique.mockResolvedValue({ id: USER_ID, isActive: true, role: 'USER' });
    model('user').update.mockResolvedValue({ id: USER_ID });

    await adminService.toggleUserStatus(USER_ID, ADMIN);
    const select = model('user').update.mock.calls[0][0].select as Record<string, unknown>;
    expect(select).not.toHaveProperty('passwordHash');
  });
});

describe('role changes', () => {
  beforeEach(() => {
    model('user').update.mockResolvedValue({ id: USER_ID, role: 'ADMIN' });
  });

  it('is restricted to super admins', async () => {
    await expect(adminService.updateUserRole(USER_ID, 'ADMIN', ADMIN)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(model('user').update).not.toHaveBeenCalled();
  });

  it('cannot be used for self-demotion or self-escalation', async () => {
    await expect(
      adminService.updateUserRole(SUPER_ADMIN.id, 'USER', SUPER_ADMIN),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('applies the change when a super admin targets someone else', async () => {
    await adminService.updateUserRole(USER_ID, 'ADMIN', SUPER_ADMIN);
    expect(model('user').update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { role: 'ADMIN' },
      select: expect.objectContaining({ role: true }),
    });
  });

  it('404s for an unknown user', async () => {
    model('user').update.mockRejectedValue(prismaError('P2025'));
    await expect(adminService.updateUserRole(USER_ID, 'ADMIN', SUPER_ADMIN)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('payments ledger', () => {
  it('filters by status and method', async () => {
    model('payment').findMany.mockResolvedValue([]);
    model('payment').count.mockResolvedValue(0);

    await adminService.getPayments(1, 20, { status: 'PENDING', method: 'BKASH' });

    expect(model('payment').findMany.mock.calls[0][0].where).toEqual({
      status: 'PENDING',
      paymentMethod: 'BKASH',
    });
  });

  it('normalises invalid pagination', async () => {
    model('payment').findMany.mockResolvedValue([]);
    model('payment').count.mockResolvedValue(0);

    await adminService.getPayments('abc', 'xyz');
    expect(model('payment').findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 20 });
  });

  it('includes just enough order and customer context for the admin table', async () => {
    model('payment').findMany.mockResolvedValue([]);
    model('payment').count.mockResolvedValue(0);

    await adminService.getPayments();
    const include = model('payment').findMany.mock.calls[0][0].include;
    expect(include.order.select).toMatchObject({ orderNumber: true });
    expect(include.user.select).not.toHaveProperty('passwordHash');
  });
});
