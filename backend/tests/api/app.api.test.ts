import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', async () => {
  const { prismaMock } = await import('../helpers/prisma-mock.js');
  return { default: prismaMock, prisma: prismaMock };
});

const { api, resetDb, model, productRow, UUID } = await import('./helpers.js');
const { default: prisma } = await import('../../src/config/database.js');

/**
 * Application plumbing: mounting, health, metrics, CORS, correlation ids and the
 * error envelope. These are the things a container healthcheck or a browser
 * preflight hits first — and every one of them was broken at some point.
 */

beforeEach(() => {
  resetDb();
});

describe('GET /', () => {
  it('advertises the service without requiring authentication', async () => {
    const response = await api().get('/');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { service: 'GameShop API' } });
  });

  it('hides the Express fingerprint', async () => {
    const response = await api().get('/');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('GET /api/v1', () => {
  it('returns a machine-readable endpoint index', async () => {
    const response = await api().get('/api/v1');

    expect(response.status).toBe(200);
    expect(response.body.data.endpoints).toEqual(
      expect.arrayContaining(['/api/v1/auth', '/api/v1/products', '/api/v1/orders', '/api/v1/metrics']),
    );
  });
});

describe('health checks', () => {
  /**
   * Regression: the Dockerfiles, docker-compose and the deploy workflow all
   * probe `/health`, but the router was only mounted under `/api/v1`. Every
   * probe 404'd, so containers were reported unhealthy forever.
   */
  it('is reachable at the root path used by the container healthchecks', async () => {
    const response = await api().get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('UP');
  });

  it('is also reachable at the canonical versioned path', async () => {
    const response = await api().get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('UP');
  });

  it('reports per-dependency state and latency', async () => {
    const response = await api().get('/health');

    expect(response.body.checks.database).toMatchObject({ status: 'UP' });
    expect(typeof response.body.checks.database.latencyMs).toBe('number');
    expect(response.body).toMatchObject({ environment: 'test' });
    expect(typeof response.body.uptime).toBe('number');
  });

  // A health endpoint that reports UP while the database is down is worse than
  // no health endpoint: the orchestrator keeps routing traffic to a dead pod.
  it('reports DEGRADED with a 503 when the database probe fails', async () => {
    (prisma.$queryRaw as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(
      new Error('ECONNREFUSED'),
    );

    const response = await api().get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ status: 'DEGRADED' });
    expect(response.body.checks.database.status).toBe('DOWN');
  });

  it('liveness never touches a dependency', async () => {
    const response = await api().get('/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'UP' });
  });

  it('readiness returns 200 when the database answers', async () => {
    const response = await api().get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'UP', checks: { database: 'UP' } });
  });

  it('readiness returns 503 when the database does not answer', async () => {
    (prisma.$queryRaw as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(
      new Error('ECONNREFUSED'),
    );

    const response = await api().get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'DOWN', checks: { database: 'DOWN' } });
  });
});

describe('GET /api/v1/metrics', () => {
  it('exposes a Prometheus scrape target', async () => {
    await api().get('/api/v1').expect(200);
    const response = await api().get('/api/v1/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/plain/);
    expect(response.text).toContain('gameshop_http_requests_total');
  });

  it('labels a matched request with its route *template*, not the raw URL', async () => {
    model('product').findUnique.mockResolvedValue(productRow({ specs: [], reviews: [], _count: {} }));
    model('review').groupBy.mockResolvedValue([]);

    await api().get(`/api/v1/products/${UUID.product}`).expect(200);
    const response = await api().get('/api/v1/metrics');

    expect(response.text).toMatch(/route="\/api\/v1\/products\/:id"/);
    expect(response.text).not.toContain(UUID.product);
  });

  /**
   * The route label is a Prometheus dimension, so its value set must be bounded
   * by the routes we declare. Falling back to `req.path` made it unbounded: an
   * attacker could mint a new time series per request simply by asking for
   * random URLs, and exhaust the process's memory.
   */
  it('collapses every unmatched URL onto a single label value', async () => {
    await api().get('/api/v1/scrape-me-1').expect(404);
    await api().get('/api/v1/scrape-me-2').expect(404);
    await api().get('/totally/made/up/path').expect(404);

    const response = await api().get('/api/v1/metrics');

    expect(response.text).toMatch(/route="other"/);
    expect(response.text).not.toContain('scrape-me-1');
    expect(response.text).not.toContain('made/up/path');
  });
});

describe('correlation ids', () => {
  it('generates a request id and echoes it back', async () => {
    const response = await api().get('/');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('preserves an upstream request id', async () => {
    const response = await api().get('/').set('X-Request-Id', 'trace-abc-123');
    expect(response.headers['x-request-id']).toBe('trace-abc-123');
  });
});

describe('unknown routes', () => {
  it('returns the JSON error envelope rather than Express HTML', async () => {
    const response = await api().get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toMatchObject({ success: false, code: 'ROUTE_NOT_FOUND' });
  });

  it('names the offending method and path to speed up debugging', async () => {
    const response = await api().delete('/api/v1/auth/login');
    expect(response.body.error).toContain('DELETE /api/v1/auth/login');
  });
});

describe('request body handling', () => {
  it('rejects malformed JSON with a 400 instead of hanging or 500ing', async () => {
    const response = await api()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.com",');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false });
  });

  it('rejects an oversized body', async () => {
    const response = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'x'.repeat(2 * 1024 * 1024) });

    expect(response.status).toBe(413);
  });
});

describe('CORS', () => {
  it('allows a configured web origin', async () => {
    const response = await api().get('/api/v1').set('Origin', 'http://localhost:5173');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('refuses an unlisted origin', async () => {
    const response = await api().get('/api/v1').set('Origin', 'https://evil.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers preflight with the allowed methods and headers', async () => {
    const response = await api()
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toMatch(/authorization/i);
  });

  it('exposes the request id and rate-limit headers to browser clients', async () => {
    const response = await api().get('/api/v1').set('Origin', 'http://localhost:5173');
    expect(response.headers['access-control-expose-headers']).toMatch(/x-request-id/i);
  });
});

describe('security headers', () => {
  it('sets a restrictive CSP and disables sniffing', async () => {
    const response = await api().get('/');

    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
  });
});
