import { z } from 'zod';
import { MAX_LIMIT } from '../utils/pagination.js';

/** Shared primitives reused across every route schema. */

/** UUID as produced by Prisma's `@default(uuid())`. */
export const uuidSchema = z
  .string({ required_error: 'id is required' })
  .trim()
  .uuid('Must be a valid identifier');

export const idParamsSchema = z.object({ id: uuidSchema });

export const productIdParamsSchema = z.object({ productId: uuidSchema });

/**
 * Pagination query params.
 *
 * Values arrive as strings from the query string, so they are coerced. Invalid
 * or out-of-range input falls back to the default instead of producing a `NaN`
 * that Prisma would reject.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).catch(20),
});

/** Strip every key whose value is `undefined` so Prisma does not see them. */
export function compact<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** Optional free-text search term, trimmed and length bounded. */
export const searchSchema = z
  .union([z.string(), z.undefined()])
  .transform((value) => (typeof value === 'string' ? value.trim() : undefined))
  .pipe(z.string().max(120, 'Search term is too long').optional());
