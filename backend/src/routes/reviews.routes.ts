import { Router, type Response } from 'express';
import { reviewService } from '../services/reviewService.js';
import { adminOnly, authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler, validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { idParamsSchema, productIdParamsSchema } from '../schemas/common.schema.js';
import { createReviewSchema, listReviewsQuerySchema } from '../schemas/review.schema.js';

const router = Router();

router.post(
  '/',
  authenticateToken,
  validate({ body: createReviewSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { productId, orderId, rating, comment } = req.body;
    const review = await reviewService.create(req.user!.id, productId, orderId, rating, comment);
    res.status(201).json({ success: true, data: review });
  }),
);

router.get(
  '/product/:productId',
  validate({ params: productIdParamsSchema, query: listReviewsQuerySchema }),
  asyncHandler(async (req, res: Response) => {
    const query = req.query as Record<string, unknown>;
    const result = await reviewService.getProductReviews(
      req.params.productId,
      query.page,
      query.limit,
      { sort: query.sort as string | undefined, rating: query.rating as number | undefined },
    );
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/product/:productId/distribution',
  validate({ params: productIdParamsSchema }),
  asyncHandler(async (req, res: Response) => {
    const distribution = await reviewService.getRatingDistribution(req.params.productId);
    res.json({ success: true, data: distribution });
  }),
);

// Writing to a counter is a mutation: requiring a token (plus the auth rate
// limiter) stops anonymous scripts from inflating `helpfulCount`. No client sent
// this request unauthenticated, so the change is backwards compatible.
router.post(
  '/:id/helpful',
  authenticateToken,
  authLimiter,
  validate({ params: idParamsSchema }),
  asyncHandler(async (req, res: Response) => {
    const result = await reviewService.markHelpful(req.params.id);
    res.json({ success: true, data: result });
  }),
);

router.delete(
  '/:id',
  authenticateToken,
  adminOnly,
  validate({ params: idParamsSchema }),
  asyncHandler(async (req, res: Response) => {
    const result = await reviewService.delete(req.params.id);
    res.json({ success: true, ...result });
  }),
);

export default router;
