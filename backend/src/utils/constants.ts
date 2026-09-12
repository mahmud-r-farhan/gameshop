/**
 * Canonical domain enumerations.
 *
 * These mirror the values persisted by Prisma. Keeping them in one place means
 * the Zod schemas, the services and the API docs cannot drift apart.
 */

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS) as [string, ...string[]];

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS) as [string, ...string[]];

export const DELIVERY_STATUS = {
  WAITING: 'WAITING',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
} as const;

export const DELIVERY_STATUS_VALUES = Object.values(DELIVERY_STATUS) as [string, ...string[]];

export const PRODUCT_CATEGORIES = {
  GAME: 'GAME',
  CURRENCY: 'CURRENCY',
} as const;

export const PRODUCT_CATEGORY_VALUES = Object.values(PRODUCT_CATEGORIES) as [string, ...string[]];

export const GAME_TYPES = {
  PUBG: 'PUBG',
  FREE_FIRE: 'FREE_FIRE',
  GTA: 'GTA',
  MLBB: 'MLBB',
  VALORANT: 'VALORANT',
  CALL_OF_DUTY: 'CALL_OF_DUTY',
  CLASH_OF_CLANS: 'CLASH_OF_CLANS',
  OTHERS: 'OTHERS',
} as const;

export const GAME_TYPE_VALUES = Object.values(GAME_TYPES) as [string, ...string[]];

export const PAYMENT_METHODS = {
  BKASH: 'BKASH',
  NAGAD: 'NAGAD',
  ROCKET: 'ROCKET',
} as const;

export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHODS) as [string, ...string[]];

export const USER_ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export const USER_ROLE_VALUES = Object.values(USER_ROLES) as [string, ...string[]];

export const FEEDBACK_CATEGORIES = {
  BUG: 'BUG',
  FEATURE_REQUEST: 'FEATURE_REQUEST',
  COMPLAINT: 'COMPLAINT',
  OTHER: 'OTHER',
} as const;

export const FEEDBACK_CATEGORY_VALUES = Object.values(FEEDBACK_CATEGORIES) as [string, ...string[]];

export const FEEDBACK_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
} as const;

export const FEEDBACK_STATUS_VALUES = Object.values(FEEDBACK_STATUS) as [string, ...string[]];

export const DISCOUNT_TYPES = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
} as const;

export const DISCOUNT_TYPE_VALUES = Object.values(DISCOUNT_TYPES) as [string, ...string[]];

/**
 * Sort options accepted by `GET /products?sort=`.
 *
 * Every entry must have a matching branch in `productService.buildOrderBy` —
 * `tests/api/products.api.test.ts` asserts that the number of distinct orderings
 * produced equals the number of options, so an unhandled value (which silently
 * falls back to "newest") fails the suite.
 *
 * `rating_desc` was removed for exactly that reason: ratings live on `Review`,
 * not `Product`, so there is no column to order by, and advertising the option
 * only ever returned newest-first results.
 */
export const PRODUCT_SORT_OPTIONS = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'name_asc',
  'name_desc',
] as const;

/**
 * Legal order-status transitions.
 *
 * Without this an admin could move a `DELIVERED` order back to `PENDING`, or
 * resurrect a `CANCELLED` one — both of which corrupt revenue reporting and
 * confuse the customer timeline.
 */
export const ORDER_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const STATUS_TYPE = {
  ORDER: 'order_status',
  PAYMENT: 'payment_status',
  DELIVERY: 'delivery_status',
} as const;

/** Sentinel meaning "no stock limit" for `Product.quantityAvailable`. */
export const UNLIMITED_STOCK = -1;

/** Hard ceiling on units of a single product in one order. */
export const MAX_ITEMS_PER_ORDER = 50;
export const MAX_QUANTITY_PER_ITEM = 999;
