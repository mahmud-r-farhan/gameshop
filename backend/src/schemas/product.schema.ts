import { z } from 'zod';
import { paginationQuerySchema } from './common.schema.js';
import {
  GAME_TYPE_VALUES,
  PRODUCT_CATEGORY_VALUES,
  PRODUCT_SORT_OPTIONS,
} from '../utils/constants.js';

/**
 * Product schemas.
 *
 * `category` and `gameType` were previously free-form strings accepted from the
 * client, so a typo silently created a product that no filter could ever find.
 * Both are now constrained to the documented enums.
 */

export { GAME_TYPE_VALUES };

export const productCategorySchema = z.enum(PRODUCT_CATEGORY_VALUES, {
  errorMap: () => ({ message: `Category must be one of: ${PRODUCT_CATEGORY_VALUES.join(', ')}` }),
});

export const gameTypeSchema = z.enum(GAME_TYPE_VALUES, {
  errorMap: () => ({ message: `Game type must be one of: ${GAME_TYPE_VALUES.join(', ')}` }),
});

/** Price in the shop's currency. Bounded to fit `NUMERIC(10,2)`. */
export const priceSchema = z.coerce
  .number({ invalid_type_error: 'Price must be a number' })
  .positive('Price must be greater than zero')
  .max(99_999_999.99, 'Price is too large')
  .multipleOf(0.01, 'Price may have at most 2 decimal places');

/**
 * An optional price. The admin form submits `0` and `''` for "no compare-at
 * price", so both are normalised to `null` rather than failing validation.
 */
export const optionalPriceSchema = z.preprocess(
  (value) => (value === '' || value === 0 || value === '0' ? null : value),
  priceSchema.nullish(),
);

export const productSpecSchema = z.object({
  name: z.string().trim().min(1, 'Specification name is required').max(120),
  value: z.string().trim().min(1, 'Specification value is required').max(500),
});

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().url('Must be a valid URL').max(2048).optional(),
);

const optionalGameType = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  gameTypeSchema.optional(),
);

/**
 * `quantityAvailable` uses `-1` as the sentinel for "unlimited", matching the
 * existing schema default. Anything below -1 is rejected.
 */
export const quantityAvailableSchema = z.coerce
  .number()
  .int('Quantity must be a whole number')
  .min(-1, 'Use -1 for unlimited stock')
  .max(1_000_000, 'Quantity is too large');

export const createProductSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(200, 'Name is too long'),
  description: z.string().trim().max(5000).optional(),
  category: productCategorySchema,
  gameType: optionalGameType,
  price: priceSchema,
  originalPrice: optionalPriceSchema,
  currency: z.string().trim().length(3, 'Currency must be a 3 letter code').toUpperCase().default('BDT'),
  quantityAvailable: quantityAvailableSchema.default(-1),
  thumbnailUrl: optionalUrl,
  images: z.array(optionalUrl).max(20).optional(),
  specifications: z.array(productSpecSchema).max(50).optional(),
  isFeatured: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
})
  // `.strict()` turns an unrecognised key into a 400 rather than silently
  // dropping it, so a mass-assignment attempt is visible in the API response.
  .strict();

export const updateProductSchema = createProductSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  });

export const listProductsQuerySchema = paginationQuerySchema.extend({
  category: z
    .union([z.undefined(), z.string()])
    .transform((value) => (value && value.toUpperCase() !== 'ALL' ? value.toUpperCase() : undefined))
    .pipe(productCategorySchema.optional()),
  gameType: z
    .union([z.undefined(), z.string()])
    .transform((value) => (value && value.toUpperCase() !== 'ALL' ? value.toUpperCase() : undefined))
    .pipe(z.enum(GAME_TYPE_VALUES).optional()),
  sort: z
    .union([z.undefined(), z.string()])
    .transform((value) => (value ? value.toLowerCase() : undefined))
    .pipe(z.enum(PRODUCT_SORT_OPTIONS).catch('newest')),
  search: z.string().trim().max(120).optional(),
  isAvailable: z
    .union([z.undefined(), z.string(), z.boolean()])
    .transform((value) => {
      if (value === undefined || value === '') return undefined;
      if (typeof value === 'boolean') return value;
      return ['1', 'true', 'yes'].includes(value.toLowerCase());
    }),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  featured: z
    .union([z.undefined(), z.string(), z.boolean()])
    .transform((value) => {
      if (value === undefined || value === '') return undefined;
      if (typeof value === 'boolean') return value;
      return ['1', 'true', 'yes'].includes(value.toLowerCase());
    }),
}).refine((data) => data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice, {
  message: 'minPrice cannot be greater than maxPrice',
  path: ['maxPrice'],
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
