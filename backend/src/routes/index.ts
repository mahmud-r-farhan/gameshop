import { Router, type Response } from 'express';
import authRoutes from './auth.routes.js';
import productRoutes from './products.routes.js';
import orderRoutes from './orders.routes.js';
import reviewRoutes from './reviews.routes.js';
import adminRoutes from './admin.routes.js';
import healthRoutes from './health.routes.js';
import feedbackRoutes from './feedback.routes.js';
import paymentRoutes from './payments.routes.js';
import { asyncHandler } from '../middleware/validate.js';
import { metricsContentType, metricsEnabled, renderMetrics } from '../config/metrics.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/health', healthRoutes);

/** Prometheus scrape target. */
router.get(
  '/metrics',
  asyncHandler(async (_req, res: Response) => {
    if (!metricsEnabled()) {
      res.status(404).json({ success: false, error: 'Metrics are disabled' });
      return;
    }
    res.set('Content-Type', metricsContentType());
    res.send(await renderMetrics());
  }),
);

/** Machine-readable API index — handy for client authors and smoke tests. */
router.get('/', (_req, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'GameShop API',
      version: 'v1',
      endpoints: [
        '/api/v1/auth',
        '/api/v1/products',
        '/api/v1/orders',
        '/api/v1/reviews',
        '/api/v1/feedback',
        '/api/v1/payments',
        '/api/v1/admin',
        '/api/v1/health',
        '/api/v1/metrics',
      ],
    },
  });
});

export default router;
