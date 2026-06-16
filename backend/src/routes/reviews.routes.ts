import { Router } from 'express';
import { reviewService } from '../services/reviewService.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Create review
router.post('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { productId, orderId, rating, comment } = req.body;
    const review = await reviewService.create(req.user!.id, productId, orderId, rating, comment);
    res.status(201).json({ success: true, data: review });
  } catch (err) { next(err); }
});

// Get product reviews
router.get('/product/:productId', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await reviewService.getProductReviews(
      req.params.productId,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 10
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Get rating distribution
router.get('/product/:productId/distribution', async (req, res, next) => {
  try {
    const distribution = await reviewService.getRatingDistribution(req.params.productId);
    res.json({ success: true, data: distribution });
  } catch (err) { next(err); }
});

export default router;
