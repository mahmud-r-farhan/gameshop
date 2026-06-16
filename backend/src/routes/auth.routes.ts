import { Router } from 'express';
import { authService } from '../services/authService.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validate, emailRule, passwordRule } from '../middleware/validators.js';
import { loginLimiter, authLimiter } from '../middleware/rateLimiter.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.post('/register', authLimiter, validate([emailRule, passwordRule, { field: 'fullName', type: 'string', required: true, min: 2 }]), async (req, res, next) => {
  try {
    const { email, phone, password, fullName } = req.body;
    const result = await authService.register(email, phone, password, fullName);
    res.status(201).json({ success: true, message: 'Registration successful', data: result });
  } catch (err) { next(err); }
});

router.post('/login', loginLimiter, validate([emailRule, passwordRule]), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post('/forgot-password', authLimiter, validate([emailRule]), async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/verify-otp', validate([emailRule, { field: 'otp', type: 'string', required: true }]), async (req, res, next) => {
  try {
    const result = await authService.verifyOTP(req.body.email, req.body.otp);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post('/reset-password', authLimiter, validate([emailRule, passwordRule]), async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.body.email, req.body.password);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.get('/profile', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const user = await authService.getProfile(req.user!.id);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

router.patch('/profile', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { fullName, phone, division, district, address, postalCode } = req.body;
    const user = await authService.updateProfile(req.user!.id, { fullName, phone, division, district, address, postalCode });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

export default router;
