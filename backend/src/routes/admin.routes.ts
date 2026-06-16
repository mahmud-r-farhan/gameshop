import { Router } from 'express';
import { adminService } from '../services/adminService.js';
import { orderService } from '../services/orderService.js';
import { authenticateToken, adminOnly, AuthRequest } from '../middleware/auth.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticateToken, adminOnly);

// Dashboard stats
router.get('/dashboard/stats', async (req, res, next) => {
  try {
    const stats = await orderService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

// Payment Gateways
router.get('/payment-gateways', async (req, res, next) => {
  try {
    const gateways = await adminService.getPaymentGateways();
    res.json({ success: true, data: gateways });
  } catch (err) { next(err); }
});

router.post('/payment-gateways', async (req, res, next) => {
  try {
    const gateway = await adminService.createPaymentGateway(req.body);
    res.status(201).json({ success: true, data: gateway });
  } catch (err) { next(err); }
});

router.put('/payment-gateways/:id', async (req, res, next) => {
  try {
    const gateway = await adminService.updatePaymentGateway(req.params.id, req.body);
    res.json({ success: true, data: gateway });
  } catch (err) { next(err); }
});

router.delete('/payment-gateways/:id', async (req, res, next) => {
  try {
    const result = await adminService.deletePaymentGateway(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// Promotions
router.get('/promotions', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await adminService.getPromotions(
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post('/promotions', async (req: AuthRequest, res, next) => {
  try {
    const promotion = await adminService.createPromotion({ ...req.body, createdBy: req.user!.id });
    res.status(201).json({ success: true, data: promotion });
  } catch (err) { next(err); }
});

router.patch('/promotions/:id/toggle', async (req, res, next) => {
  try {
    const promotion = await adminService.togglePromotion(req.params.id);
    res.json({ success: true, data: promotion });
  } catch (err) { next(err); }
});

// Customer Feedback
router.get('/feedback', async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const result = await adminService.getFeedback(
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20,
      status as string
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post('/feedback/:id/reply', async (req: AuthRequest, res, next) => {
  try {
    const feedback = await adminService.replyToFeedback(req.params.id, req.body.reply, req.user!.id);
    res.json({ success: true, data: feedback });
  } catch (err) { next(err); }
});

// Users Management
router.get('/users', async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const result = await adminService.getUsers(
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20,
      search as string
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.patch('/users/:id/toggle-status', async (req, res, next) => {
  try {
    const user = await adminService.toggleUserStatus(req.params.id);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// Settings
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await adminService.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

router.put('/settings/:key', async (req: AuthRequest, res, next) => {
  try {
    const setting = await adminService.updateSetting(req.params.key, req.body.value, req.user!.id);
    res.json({ success: true, data: setting });
  } catch (err) { next(err); }
});

export default router;
