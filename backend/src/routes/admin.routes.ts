import { Router, type Response } from 'express';
import { adminService } from '../services/adminService.js';
import { orderService } from '../services/orderService.js';
import { feedbackService } from '../services/feedbackService.js';
import { adminOnly, authenticateToken, superAdminOnly, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler, validate } from '../middleware/validate.js';
import { adminWriteLimiter } from '../middleware/rateLimiter.js';
import {
  analyticsQuerySchema,
  createFeedbackSchema,
  createPromotionSchema,
  listFeedbackQuerySchema,
  listPaymentsQuerySchema,
  listPromotionsQuerySchema,
  listUsersQuerySchema,
  paymentGatewaySchema,
  replyFeedbackSchema,
  settingKeySchema,
  updatePaymentGatewaySchema,
  updateSettingSchema,
  updateUserRoleSchema,
} from '../schemas/admin.schema.js';
import { idParamsSchema } from '../schemas/common.schema.js';
import { z } from 'zod';

const router = Router();

/** Every admin route requires a valid token *and* an administrator role. */
router.use(authenticateToken, adminOnly);

// ── Dashboard ──────────────────────────────────────────────────────────────

router.get(
  '/dashboard/stats',
  asyncHandler(async (_req, res: Response) => {
    const stats = await orderService.getDashboardStats();
    res.json({ success: true, data: stats });
  }),
);

router.get(
  '/analytics',
  validate({
    query: analyticsQuerySchema,
  }),
  asyncHandler(async (req, res: Response) => {
    const query = req.query as unknown as { from?: string; to?: string; granularity?: string };
    const analytics = await orderService.getAnalytics({
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      granularity: query.granularity ?? 'day',
    });
    res.json({ success: true, data: analytics });
  }),
);

// ── Payment gateways ───────────────────────────────────────────────────────

router.get(
  '/payment-gateways',
  asyncHandler(async (_req, res: Response) => {
    const gateways = await adminService.getPaymentGateways();
    res.json({ success: true, data: gateways });
  }),
);

router.post(
  '/payment-gateways',
  adminWriteLimiter,
  validate({ body: paymentGatewaySchema }),
  asyncHandler(async (req, res: Response) => {
    const gateway = await adminService.createPaymentGateway(req.body);
    res.status(201).json({ success: true, data: gateway });
  }),
);

router.put(
  '/payment-gateways/:id',
  adminWriteLimiter,
  validate({ params: idParamsSchema, body: updatePaymentGatewaySchema }),
  asyncHandler(async (req, res: Response) => {
    const gateway = await adminService.updatePaymentGateway(req.params.id, req.body);
    res.json({ success: true, data: gateway });
  }),
);

router.delete(
  '/payment-gateways/:id',
  adminWriteLimiter,
  validate({ params: idParamsSchema }),
  asyncHandler(async (req, res: Response) => {
    const result = await adminService.deletePaymentGateway(req.params.id);
    res.json({ success: true, ...result });
  }),
);

// ── Payments ledger ────────────────────────────────────────────────────────

router.get(
  '/payments',
  validate({ query: listPaymentsQuerySchema }),
  asyncHandler(async (req, res: Response) => {
    const query = req.query as Record<string, unknown>;
    const result = await adminService.getPayments(query.page, query.limit, {
      status: query.status as string | undefined,
      method: query.method as string | undefined,
    });
    res.json({ success: true, data: result });
  }),
);

// ── Promotions ─────────────────────────────────────────────────────────────

router.get(
  '/promotions',
  validate({ query: listPromotionsQuerySchema }),
  asyncHandler(async (req, res: Response) => {
    const query = req.query as Record<string, unknown>;
    const result = await adminService.getPromotions(query.page, query.limit, query.active as boolean | undefined);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/promotions',
  adminWriteLimiter,
  validate({ body: createPromotionSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const promotion = await adminService.createPromotion({ ...req.body, createdBy: req.user!.id });
    res.status(201).json({ success: true, data: promotion });
  }),
);

router.patch(
  '/promotions/:id/toggle',
  adminWriteLimiter,
  validate({ params: idParamsSchema }),
  asyncHandler(async (req, res: Response) => {
    const promotion = await adminService.togglePromotion(req.params.id);
    res.json({ success: true, data: promotion });
  }),
);

// ── Customer feedback ──────────────────────────────────────────────────────

router.get(
  '/feedback',
  validate({ query: listFeedbackQuerySchema }),
  asyncHandler(async (req, res: Response) => {
    const query = req.query as Record<string, unknown>;
    const result = await adminService.getFeedback(
      query.page,
      query.limit,
      query.status as string | undefined,
      query.category as string | undefined,
    );
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/feedback',
  adminWriteLimiter,
  validate({ body: createFeedbackSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Admins can file a ticket on a customer's behalf (e.g. from a phone call).
    const feedback = await feedbackService.create(req.user!.id, req.body);
    res.status(201).json({ success: true, data: feedback });
  }),
);

router.post(
  '/feedback/:id/reply',
  adminWriteLimiter,
  validate({ params: idParamsSchema, body: replyFeedbackSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const feedback = await adminService.replyToFeedback(
      req.params.id,
      req.body.reply,
      req.user!.id,
      req.body.status,
    );
    res.json({ success: true, data: feedback });
  }),
);

// ── Users ──────────────────────────────────────────────────────────────────

router.get(
  '/users',
  validate({ query: listUsersQuerySchema }),
  asyncHandler(async (req, res: Response) => {
    const query = req.query as Record<string, unknown>;
    const result = await adminService.getUsers(query.page, query.limit, query.search as string | undefined, {
      role: query.role as string | undefined,
      isActive: query.isActive as boolean | undefined,
    });
    res.json({ success: true, data: result });
  }),
);

router.patch(
  '/users/:id/toggle-status',
  adminWriteLimiter,
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await adminService.toggleUserStatus(req.params.id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    res.json({ success: true, data: user });
  }),
);

router.patch(
  '/users/:id/role',
  superAdminOnly,
  adminWriteLimiter,
  validate({ params: idParamsSchema, body: updateUserRoleSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await adminService.updateUserRole(req.params.id, req.body.role, {
      id: req.user!.id,
      role: req.user!.role,
    });
    res.json({ success: true, data: user });
  }),
);

// ── Settings ───────────────────────────────────────────────────────────────

router.get(
  '/settings',
  asyncHandler(async (_req, res: Response) => {
    const settings = await adminService.getSettings();
    res.json({ success: true, data: settings });
  }),
);

router.put(
  '/settings/:key',
  adminWriteLimiter,
  validate({
    params: z.object({ key: settingKeySchema }),
    body: updateSettingSchema,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const setting = await adminService.updateSetting(req.params.key, req.body.value, req.user!.id, {
      settingType: req.body.settingType,
      description: req.body.description,
    });
    res.json({ success: true, data: setting });
  }),
);

export default router;
