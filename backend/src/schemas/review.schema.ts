import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schema.js';

export const createReviewSchema = z
  .object({
    productId: uuidSchema,
    orderId: uuidSchema,
    rating: z.coerce
      .number({ invalid_type_error: 'rating must be a number' })
      .int('rating must be a whole number')
      .min(1, 'rating must be between 1 and 5')
      .max(5, 'rating must be between 1 and 5'),
    comment: z.string().trim().max(2000, 'Comment is too long').optional(),
  })
  .strict();

export const listReviewsQuerySchema = paginationQuerySchema.extend({
  sort: z
    .union([z.undefined(), z.string()])
    .transform((value) => (value ? value.toLowerCase() : undefined))
    .pipe(z.enum(['newest', 'oldest', 'highest', 'lowest', 'helpful']).catch('newest')),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});


export type CreateReviewInput = z.infer<typeof createReviewSchema>;
