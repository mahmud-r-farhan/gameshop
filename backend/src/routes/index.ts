import { Router } from 'express';
import authRoutes from './auth.routes.js';
import productRoutes from './products.routes.js';
import orderRoutes from './orders.routes.js';
import reviewRoutes from './reviews.routes.js';
import adminRoutes from './admin.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/admin', adminRoutes);
router.use('/health', healthRoutes);

export default router;
