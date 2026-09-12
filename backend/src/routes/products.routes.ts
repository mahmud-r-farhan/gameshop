import { Router, type Response } from 'express';
import { productService } from '../services/productService.js';
import { adminOnly, authenticateToken, optionalAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler, validate } from '../middleware/validate.js';
import { adminWriteLimiter } from '../middleware/rateLimiter.js';
import { idParamsSchema } from '../schemas/common.schema.js';
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from '../schemas/product.schema.js';

const router = Router();

/**
 * Route order matters: static segments must be registered before `/:id`,
 * otherwise `/products/featured` is captured as an id.
 */
router.get(
  '/featured',
  asyncHandler(async (_req, res: Response) => {
    const products = await productService.getFeatured();
    res.json({ success: true, data: products });
  }),
);

router.get(
  '/',
  validate({ query: listProductsQuerySchema }),
  asyncHandler(async (req, res: Response) => {
    const query = req.query as unknown as {
      page?: number;
      limit?: number;
      category?: string;
      gameType?: string;
      sort?: string;
      search?: string;
      isAvailable?: boolean;
      minPrice?: number;
      maxPrice?: number;
      featured?: boolean;
    };

    const result = await productService.list({
      page: query.page,
      limit: query.limit,
      category: query.category,
      gameType: query.gameType,
      sort: query.sort,
      search: query.search,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      featured: query.featured,
      // The public catalogue only ever shows purchasable products; admins pass
      // `isAvailable=false` explicitly to audit hidden ones.
      isAvailable: query.isAvailable ?? true,
    });
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req, res: Response) => {
    const product = await productService.getById(req.params.id);
    res.json({ success: true, data: product });
  }),
);

// ── Admin ───────────────────────────────────────────────────────────────────

router.post(
  '/',
  authenticateToken,
  adminOnly,
  adminWriteLimiter,
  validate({ body: createProductSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const product = await productService.create(req.body, req.user!.id);
    res.status(201).json({ success: true, data: product });
  }),
);

router.patch(
  '/:id',
  authenticateToken,
  adminOnly,
  adminWriteLimiter,
  validate({ params: idParamsSchema, body: updateProductSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const product = await productService.update(req.params.id, req.body);
    res.json({ success: true, data: product });
  }),
);

router.delete(
  '/:id',
  authenticateToken,
  adminOnly,
  adminWriteLimiter,
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await productService.delete(req.params.id);
    res.json({ success: true, ...result });
  }),
);

router.patch(
  '/:id/toggle-featured',
  authenticateToken,
  adminOnly,
  adminWriteLimiter,
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const product = await productService.toggleFeatured(req.params.id);
    res.json({ success: true, data: product });
  }),
);

router.patch(
  '/:id/toggle-availability',
  authenticateToken,
  adminOnly,
  adminWriteLimiter,
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const product = await productService.toggleAvailability(req.params.id);
    res.json({ success: true, data: product });
  }),
);

export default router;
