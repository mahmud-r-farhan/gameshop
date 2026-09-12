import { Router, type Response } from 'express';
import { adminService } from '../services/adminService.js';
import { asyncHandler } from '../middleware/validate.js';

/**
 * Public payment information.
 *
 * Checkout needs the list of enabled mobile-banking gateways (account numbers,
 * instructions, QR codes) but that data was only reachable through an
 * admin-authenticated endpoint, so the storefront could never render it.
 */
const router = Router();

router.get(
  '/gateways',
  asyncHandler(async (_req, res: Response) => {
    const gateways = await adminService.getEnabledPaymentGateways();
    res.json({ success: true, data: gateways });
  }),
);

export default router;
