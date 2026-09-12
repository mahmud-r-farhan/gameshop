import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { generateAccessToken } from '../../src/utils/tokens.js';
import { model, resetPrismaMock } from '../helpers/prisma-mock.js';

/**
 * Shared fixtures for the HTTP-level suite.
 *
 * The real Express app is mounted — routing, Zod validation, auth middleware,
 * error mapping and the JSON envelope are all exercised — while Prisma is the
 * in-memory double from `tests/helpers/prisma-mock.ts`, so no database is
 * needed. Rate limiters self-skip under `NODE_ENV=test`.
 */

let app: Express | undefined;

/** One app instance per test file; rebuilding it is wasteful and slow. */
export function getApp(): Express {
  if (!app) app = createApp({ rateLimit: false });
  return app;
}

export function api() {
  return request(getApp());
}

export const UUID = {
  user: '6f1e2c3d-0000-4000-8000-000000000001',
  admin: '6f1e2c3d-0000-4000-8000-000000000002',
  product: '6f1e2c3d-0000-4000-8000-000000000003',
  order: '6f1e2c3d-0000-4000-8000-000000000004',
  review: '6f1e2c3d-0000-4000-8000-000000000005',
  gateway: '6f1e2c3d-0000-4000-8000-000000000006',
  promo: '6f1e2c3d-0000-4000-8000-000000000007',
} as const;

export const USER = { id: UUID.user, email: 'buyer@example.com', role: 'USER' } as const;
export const ADMIN = { id: UUID.admin, email: 'admin@example.com', role: 'ADMIN' } as const;
export const SUPER_ADMIN = {
  id: '6f1e2c3d-0000-4000-8000-0000000000ff',
  email: 'root@example.com',
  role: 'SUPER_ADMIN',
} as const;

export function bearerFor(user: { id: string; email: string; role: string }): string {
  return generateAccessToken({ id: user.id, email: user.email, role: user.role });
}

export function asUser(user: { id: string; email: string; role: string } = USER) {
  return { Authorization: `Bearer ${bearerFor(user)}` };
}

export const asAdmin = () => asUser(ADMIN);
export const asSuperAdmin = () => asUser(SUPER_ADMIN);

/** Reset the Prisma double between tests. */
export function resetDb(): void {
  resetPrismaMock();
}

export { model };

/** A product row shaped like the public catalogue returns. */
export function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID.product,
    name: 'Elden Ring',
    category: 'ACTION',
    price: '4500.00',
    originalPrice: '5000.00',
    quantityAvailable: 5,
    isAvailable: true,
    isFeatured: false,
    thumbnailUrl: null,
    images: null,
    ...overrides,
  };
}
