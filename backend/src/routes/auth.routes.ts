import { Router, type Response } from 'express';
import { authService } from '../services/authService.js';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler, validate } from '../middleware/validate.js';
import {
  authLimiter,
  loginLimiter,
  otpLimiter,
  otpVerifyLimiter,
} from '../middleware/rateLimiter.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from '../schemas/auth.schema.js';

const router = Router();

router.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res: Response) => {
    const { email, phone, password, fullName } = req.body;
    const result = await authService.register(email, phone, password, fullName);
    res.status(201).json({ success: true, message: 'Registration successful', data: result });
  }),
);

router.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json({ success: true, data: result });
  }),
);

/**
 * Exchange a refresh token for a new token pair.
 *
 * `login`/`register` have always returned a `refreshToken` and the backend has
 * always had a `JWT_REFRESH_SECRET`, but there was no endpoint to use it — so
 * every session died after 24h with no way to renew it.
 */
router.post(
  '/refresh',
  validate({ body: refreshTokenSchema }),
  asyncHandler(async (req, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken);
    res.json({ success: true, data: result });
  }),
);

/**
 * Logout is stateless (JWT), but the endpoint exists so clients have a single
 * place to hook server-side revocation later, and so analytics can record it.
 */
router.post('/logout', (_req, res: Response) => {
  res.json({ success: true, message: 'Logged out' });
});

router.post(
  '/forgot-password',
  otpLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    res.json({ success: true, ...result });
  }),
);

router.post(
  '/verify-otp',
  otpVerifyLimiter,
  validate({ body: verifyOtpSchema }),
  asyncHandler(async (req, res: Response) => {
    const result = await authService.verifyOTP(req.body.email, req.body.otp);
    res.json({ success: true, data: result });
  }),
);

/**
 * Requires the `token` returned by `/verify-otp`.
 *
 * Previously this accepted only `{ email, password }`, which let any anonymous
 * caller overwrite any account's password — an unauthenticated account takeover.
 */
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res: Response) => {
    const { email, password, token } = req.body;
    const result = await authService.resetPassword(email, password, token);
    res.json({ success: true, ...result });
  }),
);

router.get(
  '/profile',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await authService.getProfile(req.user!.id);
    res.json({ success: true, data: user });
  }),
);

router.patch(
  '/profile',
  authenticateToken,
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await authService.updateProfile(req.user!.id, req.body);
    res.json({ success: true, data: user });
  }),
);

router.post(
  '/change-password',
  authenticateToken,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user!.id, currentPassword, newPassword);
    res.json({ success: true, ...result });
  }),
);

export default router;
