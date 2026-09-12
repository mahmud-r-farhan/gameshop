import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../middleware/errorHandler.js';
import { verifyAccessToken, type AccessTokenPayload } from '../utils/tokens.js';
import { USER_ROLES } from '../utils/constants.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Extract a bearer token.
 *
 * Tolerates a lower/upper-case scheme and arbitrary internal whitespace — a
 * naive `split(' ')` returns an empty token for `"Bearer  abc"`, which some HTTP
 * clients and hand-rolled integrations do emit.
 */
export function extractBearerToken(headerValue?: string | string[]): string | null {
  const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!header || typeof header !== 'string') return null;

  const match = /^\s*bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

function decode(headerValue?: string | string[]): AccessTokenPayload | null {
  const token = extractBearerToken(headerValue);
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

/** Reject the request unless a valid access token is present. */
export function authenticateToken(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers['authorization']);

  if (!token) {
    next(new UnauthorizedError('Access token required'));
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    // 401 (not 403) for a bad/expired token: the client is *unauthenticated*,
    // and the frontend interceptor keys off 401 to clear the session.
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

/** Attach the user when a valid token is present, but never block. */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const decoded = decode(req.headers['authorization']);
  if (decoded) req.user = decoded;
  next();
}

function isPrivileged(role: string | undefined): boolean {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN;
}

/** Restrict to administrators. Must run after `authenticateToken`. */
export function adminOnly(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }
  if (!isPrivileged(req.user.role)) {
    next(new ForbiddenError('Admin access required'));
    return;
  }
  next();
}

/** Restrict to super administrators. Must run after `authenticateToken`. */
export function superAdminOnly(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    next(new ForbiddenError('Super admin access required'));
    return;
  }
  next();
}

/** Composable role gate: `requireRole('ADMIN', 'SUPER_ADMIN')`. */
export function requireRole(...roles: string[]) {
  const allowed = new Set(roles);
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }
    if (!allowed.has(req.user.role)) {
      next(new ForbiddenError(`Requires role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}

/** True when the caller may act on resources owned by `ownerId`. */
export function canAccessResource(req: AuthRequest, ownerId: string): boolean {
  if (!req.user) return false;
  return req.user.id === ownerId || isPrivileged(req.user.role);
}

/**
 * Refuse the request in production when the deployment is still using a
 * placeholder signing key. `env.ts` already exits on boot, but this guards
 * against a config object built by tests or an older cached module.
 */
export function assertJwtConfigured(): void {
  if (env.isProd && env.jwt.secret.startsWith('dev-')) {
    throw new Error('JWT_SECRET is not configured');
  }
}
