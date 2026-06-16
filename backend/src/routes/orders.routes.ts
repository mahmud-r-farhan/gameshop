import { Router } from 'express';
import { orderService } from '../services/orderService.js';
import { authenticateToken, adminOnly, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Create order
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { items, promoCode, deliveryAddress, deliveryInstructions } = req.body;
    const order = await orderService.createOrder(req.user!.id, items, promoCode, deliveryAddress, deliveryInstructions);
    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
});

// Get user orders
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await orderService.getUserOrders(
      req.user!.id,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 10
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Get single order
router.get('/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user!.id);
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// Submit payment for order
router.post('/:id/submit-payment', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { transactionId, paymentMethod } = req.body;
    const payment = await orderService.submitPayment(req.params.id, req.user!.id, transactionId, paymentMethod);
    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
});

// Admin: Get all orders
router.get('/admin/all', authenticateToken, adminOnly, async (req, res, next) => {
  try {
    const { status, paymentStatus, page, limit, search } = req.query;
    const result = await orderService.getAllOrders({
      status: status as string,
      paymentStatus: paymentStatus as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      search: search as string,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Admin: Update order status
router.patch('/:id/status', authenticateToken, adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const { status } = req.body;
    const order = await orderService.updateOrderStatus(req.params.id, status, req.user!.id);
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// Admin: Verify payment
router.patch('/:id/verify-payment', authenticateToken, adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const { transactionId, note } = req.body;
    const order = await orderService.verifyPayment(req.params.id, transactionId, req.user!.id, note);
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

export default router;
