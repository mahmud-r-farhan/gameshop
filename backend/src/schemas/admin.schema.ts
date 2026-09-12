import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schema.js';
import {
  DISCOUNT_TYPE_VALUES,
  FEEDBACK_CATEGORY_VALUES,
  FEEDBACK_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
} from '../utils/constants.js';

/**
 * Admin schemas.
 *
 * Admin endpoints previously forwarded `req.body` straight into Prisma. That is
 * a mass-assignment hole: a crafted request could set `createdBy`, `usedCount`,
 * `createdAt` or any other column on the target row. Every write is now
 * whitelisted.
 */

// ── Payment gateways ───────────────────────────────────────────────────────

export const paymentGatewaySchema = z
  .object({
    gatewayName: z.string().trim().min(2).max(80),
    gatewayType: z.enum(['MOBILE_BANKING', 'API', 'CARD', 'OTHER']).optional(),
    accountIdentifier: z.string().trim().max(80).optional(),
    accountHolderName: z.string().trim().max(120).optional(),
    instructions: z.string().trim().max(2000).optional(),
    qrCodeUrl: z.string().trim().url().max(2048).optional(),
    isEnabled: z.boolean().optional(),
    displayOrder: z.coerce.number().int().min(0).max(1000).optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .strict();

export const updatePaymentGatewaySchema = paymentGatewaySchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  });

// ── Promotions ─────────────────────────────────────────────────────────────

const isoDate = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Must be a valid ISO date',
});

export const createPromotionSchema = z
  .object({
    code: z
      .string({ required_error: 'code is required' })
      .trim()
      .min(3, 'Code must be at least 3 characters')
      .max(32, 'Code must be at most 32 characters')
      .toUpperCase()
      .regex(/^[A-Z0-9_-]+$/, 'Code may only contain letters, numbers, hyphens and underscores'),
    description: z.string().trim().max(500).optional(),
    discountType: z.enum(DISCOUNT_TYPE_VALUES, {
      errorMap: () => ({ message: `discountType must be one of: ${DISCOUNT_TYPE_VALUES.join(', ')}` }),
    }),
    discountValue: z.coerce.number().positive('discountValue must be greater than zero'),
    validFrom: isoDate,
    validUntil: isoDate,
    maxUsage: z.coerce.number().int().positive().max(1_000_000).optional(),
    minPurchaseAmount: z.coerce.number().nonnegative().max(99_999_999.99).optional(),
    applicableProductIds: z.array(uuidSchema).max(200).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.discountType !== 'PERCENTAGE' || data.discountValue <= 100, {
    message: 'A percentage discount cannot exceed 100',
    path: ['discountValue'],
  })
  .refine((data) => Date.parse(data.validUntil) > Date.parse(data.validFrom), {
    message: 'validUntil must be after validFrom',
    path: ['validUntil'],
  });

export const listPromotionsQuerySchema = paginationQuerySchema.extend({
  active: z
    .union([z.undefined(), z.string(), z.boolean()])
    .transform((value) => {
      if (value === undefined || value === '') return undefined;
      if (typeof value === 'boolean') return value;
      return ['1', 'true', 'yes'].includes(value.toLowerCase());
    }),
});

// ── Feedback ───────────────────────────────────────────────────────────────

export const replyFeedbackSchema = z
  .object({
    reply: z.string({ required_error: 'reply is required' }).trim().min(1, 'Reply cannot be empty').max(5000),
    status: z.enum(FEEDBACK_STATUS_VALUES).optional(),
  })
  .strict();

export const listFeedbackQuerySchema = paginationQuerySchema.extend({
  status: z
    .union([z.undefined(), z.string()])
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .pipe(z.enum(FEEDBACK_STATUS_VALUES).optional()),
  category: z
    .union([z.undefined(), z.string()])
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .pipe(z.enum(FEEDBACK_CATEGORY_VALUES).optional()),
});

/** Customer-facing feedback submission (the model existed with no way to create one). */
export const createFeedbackSchema = z
  .object({
    subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(160),
    message: z.string().trim().min(10, 'Message must be at least 10 characters').max(5000),
    category: z.enum(FEEDBACK_CATEGORY_VALUES).default('OTHER'),
    orderId: uuidSchema.optional(),
  })
  .strict();

// ── Users ──────────────────────────────────────────────────────────────────

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  isActive: z
    .union([z.undefined(), z.string(), z.boolean()])
    .transform((value) => {
      if (value === undefined || value === '') return undefined;
      if (typeof value === 'boolean') return value;
      return ['1', 'true', 'yes'].includes(value.toLowerCase());
    }),
});

export const updateUserRoleSchema = z
  .object({ role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']) })
  .strict();

// ── Settings ───────────────────────────────────────────────────────────────

export const settingKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[A-Za-z0-9_.:-]+$/, 'Setting key may only contain letters, numbers, dots, colons, hyphens and underscores');

export const updateSettingSchema = z
  .object({
    value: z.unknown(),
    settingType: z.enum(['string', 'number', 'boolean', 'json']).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((data) => data.value !== undefined, { message: 'value is required', path: ['value'] });

// ── Payments list ──────────────────────────────────────────────────────────

export const listPaymentsQuerySchema = paginationQuerySchema.extend({
  // Driven by `PAYMENT_STATUS_VALUES` rather than a hand-copied list: the inline
  // enum omitted `PENDING_VERIFICATION`, so the admin Payments view could not
  // filter to exactly the queue that needs action.
  status: z
    .union([z.undefined(), z.string()])
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .pipe(z.enum(PAYMENT_STATUS_VALUES).optional()),
  method: z
    .union([z.undefined(), z.string()])
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .pipe(z.enum(PAYMENT_METHOD_VALUES).optional()),
});

export const analyticsQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    granularity: z.enum(['day', 'week', 'month']).default('day'),
  })
  .strict()
  .refine((data) => !data.from || !data.to || Date.parse(data.to) >= Date.parse(data.from), {
    message: '`to` must be on or after `from`',
    path: ['to'],
  });

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type PaymentGatewayInput = z.infer<typeof paymentGatewaySchema>;
