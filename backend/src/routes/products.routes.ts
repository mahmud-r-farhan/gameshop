import { Router } from 'express';
import { productService } from '../services/productService.js';
import { authenticateToken, optionalAuth, adminOnly, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { category, gameType, page, limit, sort, search } = req.query;
    const result = await productService.list({
      category: category as string,
      gameType: gameType as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      sort: sort as string,
      search: search as string,
      isAvailable: true,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/featured', async (req, res, next) => {
  try {
    const products = await productService.getFeatured();
    res.json({ success: true, data: products });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await productService.getById(req.params.id);
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// Admin routes
router.post('/', authenticateToken, adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const product = await productService.create({ ...req.body, createdBy: req.user!.id });
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
});

router.patch('/:id', authenticateToken, adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const product = await productService.update(req.params.id, req.body);
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticateToken, adminOnly, async (req, res, next) => {
  try {
    const result = await productService.delete(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.patch('/:id/toggle-featured', authenticateToken, adminOnly, async (req, res, next) => {
  try {
    const product = await productService.toggleFeatured(req.params.id);
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

export default router;
