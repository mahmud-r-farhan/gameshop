import { z } from 'zod';

/**
 * Authentication schemas.
 *
 * Password policy is deliberately modest (8+ chars with at least one letter and
 * one digit) — long enough to stop the trivial `123456` registrations the old
 * 6-character floor allowed, without forcing users into unsafe reuse patterns.
 */

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one digit');

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Must be a valid email address')
  .max(254, 'Email is too long');

/** Bangladeshi mobile numbers, the market this shop targets. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?8801[3-9]\d{8}$|^01[3-9]\d{8}$/, 'Must be a valid phone number (e.g. 01712345678)');

export const fullNameSchema = z
  .string({ required_error: 'Full name is required' })
  .trim()
  .min(2, 'Full name must be at least 2 characters')
  .max(120, 'Full name must be at most 120 characters');

/** HTML forms submit empty inputs as `''`; treat those as "not provided". */
const optionalString = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema);

export const optionalPhoneSchema = optionalString(phoneSchema.optional());
export const optionalText = (max: number) =>
  optionalString(z.string().trim().max(max).optional());

/**
 * `.strict()` on every auth schema.
 *
 * Zod's default object mode silently *strips* unknown keys, which is fine for
 * reads but wrong for writes: a client sending `{ "role": "ADMIN" }` to
 * `/auth/register` got a 201 and no signal that the field was ignored. The
 * service layer whitelists too, so this was never exploitable — but strict mode
 * makes the contract explicit and turns a silent drop into an actionable 400.
 */
export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    fullName: fullNameSchema,
    phone: optionalPhoneSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required')
      .max(128),
  })
  .strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const verifyOtpSchema = z
  .object({
    email: emailSchema,
    otp: z
      .string({ required_error: 'OTP is required' })
      .trim()
      .regex(/^\d{6}$/, 'OTP must be a 6 digit code'),
  })
  .strict();

/**
 * Resetting a password now requires the signed token returned by
 * `/auth/verify-otp`.
 *
 * Before this change the endpoint accepted `{ email, password }` alone, which
 * meant *anyone* could overwrite *any* account's password — full account
 * takeover with no authentication at all.
 */
export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    token: z
      .string({ required_error: 'Reset token is required' })
      .min(20, 'Reset token is required'),
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string({ required_error: 'refreshToken is required' }).min(20),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    phone: optionalPhoneSchema.nullable(),
    avatarUrl: optionalString(z.string().trim().url('Must be a valid URL').max(2048).optional()),
    division: optionalText(80),
    district: optionalText(80),
    address: optionalText(500),
    postalCode: optionalText(20),
    preferredPaymentMethod: optionalString(z.enum(['BKASH', 'NAGAD', 'ROCKET']).optional()),
    notificationPreferences: z.record(z.boolean()).optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordSchema,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
