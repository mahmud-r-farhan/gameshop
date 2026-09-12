import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schema.js';
import {
  MAX_ITEMS_PER_ORDER,
  MAX_QUANTITY_PER_ITEM,
  ORDER_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
} from '../utils/constants.js';

/**
 * Order schemas.
 *
 * `POST /orders` previously accepted an entirely unvalidated body: `items` could be
 * missing (crashing the service), `quantity` could be negative (producing a
 * negative order total the shop would then "pay" the customer), and
 * `deliveryAddress` could be a 10 MB string.
 */

export const orderItemSchema = z
  .object({
    productId: uuidSchema,
    quantity: z.coerce
      .number({ invalid_type_error: 'quantity must be a number' })
      .int('quantity must be a whole number')
      .positive('quantity must be greater than zero')
      .max(MAX_QUANTITY_PER_ITEM, `quantity cannot exceed ${MAX_QUANTITY_PER_ITEM}`),
  })
  .strict();

export const createOrderSchema = z
  .object({
    items: z
      .array(orderItemSchema)
      .min(1, 'An order must contain at least one item')
      .max(MAX_ITEMS_PER_ORDER, `An order cannot contain more than ${MAX_ITEMS_PER_ORDER} items`),
    promoCode: z
      .string()
      .trim()
      .min(3, 'Promo code is too short')
      .max(40, 'Promo code is too long')
      .toUpperCase()
      .optional(),
    deliveryAddress: z
      .string()
      .trim()
      .min(10, 'Delivery address must be at least 10 characters')
      .max(500, 'Delivery address is too long'),
    deliveryInstructions: z.string().trim().max(500).optional(),
    customerNote: z.string().trim().max(500).optional(),
  })
  .strict()
  // Two lines for the same product must be merged by the client, otherwise the
  // stock check can be bypassed by splitting one large quantity across lines.
  .refine(
    (data) => new Set(data.items.map((item) => item.productId)).size === data.items.length,
    { message: 'Duplicate products in the order — please merge quantities', path: ['items'] },
  );

export const submitPaymentSchema = z
  .object({
    transactionId: z
      .string({ required_error: 'Transaction ID is required' })
      .trim()
      .min(4, 'Transaction ID is too short')
      .max(64, 'Transaction ID is too long')
      .regex(/^[A-Za-z0-9-]+$/, 'Transaction ID may only contain letters, numbers and hyphens'),
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES, {
      errorMap: () => ({ message: `Payment method must be one of: ${PAYMENT_METHOD_VALUES.join(', ')}` }),
    }),
    paymentProofUrl: z.string().trim().url('Must be a valid URL').max(2048).optional(),
    amount: z.coerce.number().positive().max(99_999_999.99).optional(),
  })
  .strict();

export const verifyPaymentSchema = z
  .object({
    transactionId: z.string().trim().min(4).max(64).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateOrderStatusSchema = z
  .object({
    status: z.enum(ORDER_STATUS_VALUES, {
      errorMap: () => ({ message: `Status must be one of: ${ORDER_STATUS_VALUES.join(', ')}` }),
    }),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const listOrdersQuerySchema = paginationQuerySchema.extend({
  status: z
    .union([z.undefined(), z.string()])
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .pipe(z.enum(ORDER_STATUS_VALUES).optional()),
  paymentStatus: z
    .union([z.undefined(), z.string()])
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .pipe(z.enum(PAYMENT_STATUS_VALUES).optional()),
  search: z.string().trim().max(120).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
