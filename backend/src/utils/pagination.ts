/**
 * Pagination helpers.
 *
 * Query strings are attacker-controlled: `?page=abc` previously produced
 * `parseInt` -> `NaN` which Prisma forwarded as `skip: NaN`, blowing up with an
 * unhandled 500. Every value is now clamped to a sane range.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Parse an unknown query value into a positive integer, or `fallback`. */
export function toPositiveInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export function normalizePage(value: unknown): number {
  return toPositiveInt(value, DEFAULT_PAGE);
}

export function normalizeLimit(value: unknown, fallback = DEFAULT_LIMIT): number {
  return Math.min(toPositiveInt(value, fallback), MAX_LIMIT);
}

/** `skip` offset for a Prisma query. */
export function offsetFor(page: number, limit: number): number {
  return (Math.max(page, 1) - 1) * Math.max(limit, 1);
}

export function buildPagination(totalItems: number, page: number, limit: number): Pagination {
  const safeLimit = Math.max(limit, 1);
  const safePage = Math.max(page, 1);
  const totalPages = Math.max(1, Math.ceil(Math.max(totalItems, 0) / safeLimit));

  return {
    currentPage: safePage,
    totalPages,
    totalItems: Math.max(totalItems, 0),
    itemsPerPage: safeLimit,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };
}
