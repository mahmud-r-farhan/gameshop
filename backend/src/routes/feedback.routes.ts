import { Router, type Response } from 'express';
import { feedbackService } from '../services/feedbackService.js';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler, validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { idParamsSchema, paginationQuerySchema } from '../schemas/common.schema.js';
import { createFeedbackSchema } from '../schemas/admin.schema.js';

const router = Router();

router.use(authenticateToken);

router.post(
  '/',
  authLimiter,
  validate({ body: createFeedbackSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const feedback = await feedbackService.create(req.user!.id, req.body);
    res.status(201).json({ success: true, data: feedback });
  }),
);

router.get(
  '/',
  validate({ query: paginationQuerySchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = req.query as Record<string, unknown>;
    const result = await feedbackService.listForUser(req.user!.id, query.page, query.limit);
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const feedback = await feedbackService.getForUser(req.user!.id, req.params.id);
    res.json({ success: true, data: feedback });
  }),
);

export default router;
