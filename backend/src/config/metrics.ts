import client from 'prom-client';
import { env } from './env.js';

/**
 * Prometheus metrics.
 *
 * `prom-client` was already a dependency but nothing was ever registered or
 * exposed, so the documented Grafana/Prometheus integration had no data source.
 */

export const register = new client.Registry();

client.collectDefaultMetrics({ register, prefix: 'gameshop_' });

export const httpRequestsTotal = new client.Counter({
  name: 'gameshop_http_requests_total',
  help: 'Total HTTP requests processed, labelled by method, route and status',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'gameshop_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const ordersCreatedTotal = new client.Counter({
  name: 'gameshop_orders_created_total',
  help: 'Total orders successfully created',
  registers: [register],
});

export const paymentsVerifiedTotal = new client.Counter({
  name: 'gameshop_payments_verified_total',
  help: 'Total payments verified by an administrator',
  registers: [register],
});

export const loginAttemptsTotal = new client.Counter({
  name: 'gameshop_login_attempts_total',
  help: 'Total login attempts, labelled by outcome',
  labelNames: ['outcome'] as const,
  registers: [register],
});

/**
 * Label value for requests that matched no route.
 *
 * The route label is a Prometheus dimension, so its value set must be bounded by
 * the number of routes we declare. Falling back to `req.path` made it unbounded:
 * anyone could mint a new time series per request simply by asking for random
 * URLs (`/a`, `/b`, …) and exhaust the process's memory. Every unmatched request
 * therefore collapses onto one label.
 */
export const UNMATCHED_ROUTE = 'other';

/** Reduce high-cardinality URLs (`/products/<uuid>`) to their route pattern. */
export function normalizeRoute(req: { route?: { path?: string }; baseUrl?: string }): string {
  const template = req.route?.path;
  if (template) {
    const base = req.baseUrl ?? '';
    // `req.route.path` is `'/'` for a router mounted at its own root.
    return template === '/' ? base || '/' : `${base}${template}`;
  }
  return UNMATCHED_ROUTE;
}

export async function renderMetrics(): Promise<string> {
  return register.metrics();
}

export function metricsContentType(): string {
  return register.contentType;
}

export const metricsEnabled = (): boolean => env.metrics.enabled;
