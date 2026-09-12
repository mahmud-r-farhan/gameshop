import { Router, type Response } from 'express';
import { orderService } from '../services/orderService.js';
import { adminOnly, authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler, validate } from '../middleware/validate.js';
import { adminWriteLimiter } from '../middleware/rateLimiter.js';
import { idParamsSchema, listOrdersQuerySchema, paginationQuerySchema } from '../schemas/index.js';
import {
  createOrderSchema,
  submitPaymentSchema,
  updateOrderStatusSchema,
  verifyPaymentSchema,
} from '../schemas/order.schema.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticateToken);

/**
 * `/admin/all` is registered **before** `/:id`.
 *
 * Express matches in declaration order, so a two-segment admin path would never
 * collide with the single-segment `/:id` route — but keeping static segments
 * first makes the ordering invariant explicit instead of incidental, and survives
 * someone later adding `/:id/:section`.
 */
router.get(
  '/admin/all',
  adminOnly,
  validate({ query: listOrdersQuerySchema }),
  asyncHandler(async (req, res: Response) => {
    const query = req.query as Record<string, unknown>;
    const result = await orderService.getAllOrders({
      status: query.status as string | undefined,
      paymentStatus: query.paymentStatus as string | undefined,
      page: query.page,
      limit: query.limit,
      search: query.search as string | undefined,
    });
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/',
  validate({ query: paginationQuerySchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = req.query as Record<string, unknown>;
    const result = await orderService.getUserOrders(req.user!.id, query.page, query.limit);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/',
  validate({ body: createOrderSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.createOrder(req.user!.id, {
      items: req.body.items,
      promoCode: req.body.promoCode,
      deliveryAddress: req.body.deliveryAddress,
      deliveryInstructions: req.body.deliveryInstructions,
    });
    res.status(201).json({ success: true, data: order });
  }),
);

router.get(
  '/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Admins may read any order; customers only their own. Passing the viewer
    // (rather than just the id) is what makes the admin order-detail view work.
    const order = await orderService.getOrderById(req.params.id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    res.json({ success: true, data: order });
  }),
);

router.post(
  '/:id/submit-payment',
  validate({ params: idParamsSchema, body: submitPaymentSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { transactionId, paymentMethod, paymentProofUrl, amount } = req.body;
    const payment = await orderService.submitPayment(
      req.params.id,
      req.user!.id,
      transactionId,
      paymentMethod,
      { paymentProofUrl, amount },
    );
    res.status(201).json({ success: true, data: payment });
  }),
);

router.post(
  '/:id/cancel',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.getOrderById(req.params.id, {
      id: req.user!.id,
      role: req.user!.role,
    });

    // A customer may only cancel their own, unpaid order.
    const isOwner = order.userId === req.user!.id;
    if (!isOwner) throw new AppError('You can only cancel your own orders', 403);
    if (order.paymentStatus === 'VERIFIED') {
      throw new AppError('A paid order can only be cancelled by support', 409);
    }

    const updated = await orderService.updateOrderStatus(
      req.params.id,
      'CANCELLED',
      req.user!.id,
      'Cancelled by customer',
    );
    res.json({ success: true, data: updated });
  }),
);

// ── Admin ───────────────────────────────────────────────────────────────────

router.patch(
  '/:id/status',
  adminOnly,
  adminWriteLimiter,
  validate({ params: idParamsSchema, body: updateOrderStatusSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.updateOrderStatus(
      req.params.id,
      req.body.status,
      req.user!.id,
      req.body.reason,
    );
    res.json({ success: true, data: order });
  }),
);

router.patch(
  '/:id/verify-payment',
  adminOnly,
  adminWriteLimiter,
  validate({ params: idParamsSchema, body: verifyPaymentSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.verifyPayment(
      req.params.id,
      req.body.transactionId ?? '',
      req.user!.id,
      req.body.note,
    );
    res.json({ success: true, data: order });
  }),
);

router.patch(
  '/:id/reject-payment',
  adminOnly,
  adminWriteLimiter,
  validate({ params: idParamsSchema, body: verifyPaymentSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.rejectPayment(req.params.id, req.user!.id, req.body.note);
    res.json({ success: true, data: order });
  }),
);

export default router;
