import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { getOtpStore } from '../config/redis.js';
import { env } from '../config/env.js';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../middleware/errorHandler.js';
import { OtpService } from '../utils/otp.js';
import { comparePassword, hashPassword, sanitizeUser } from '../utils/helpers.js';
import {
  fingerprintPasswordHash,
  generateAccessToken,
  generatePasswordResetToken,
  generateRefreshToken,
  verifyPasswordResetToken,
  verifyRefreshToken,
} from '../utils/tokens.js';
import { USER_ROLES } from '../utils/constants.js';
import { loginAttemptsTotal } from '../config/metrics.js';

/** Fields a client is allowed to change on its own profile. */
const UPDATABLE_PROFILE_FIELDS = [
  'fullName',
  'phone',
  'avatarUrl',
  'division',
  'district',
  'address',
  'postalCode',
  'preferredPaymentMethod',
  'notificationPreferences',
] as const;

type UpdatableProfileField = (typeof UPDATABLE_PROFILE_FIELDS)[number];

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private otpService(): OtpService {
    return new OtpService(getOtpStore());
  }

  async register(email: string, phone: string | undefined, password: string, fullName: string) {
    const normalizedEmail = email.toLowerCase();

    // A `findFirst` + `create` pair is a race: two simultaneous signups with the
    // same email both pass the check and the loser hits the unique index, which
    // used to surface as an HTTP 500. The unique constraint is now the single
    // source of truth and the violation is translated into a 409.
    try {
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          phone: phone || null,
          passwordHash: await hashPassword(password),
          fullName,
          notificationPreferences: {},
        },
      });

      return {
        user: sanitizeUser(user),
        ...this.issueTokens(user),
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Email or phone already registered');
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Always run a bcrypt comparison so the response time does not reveal
    // whether the email exists (user-enumeration via timing).
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const isValid = await comparePassword(password, hash);

    if (!user || !isValid) {
      loginAttemptsTotal.inc({ outcome: 'invalid_credentials' });
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      loginAttemptsTotal.inc({ outcome: 'disabled' });
      throw new ForbiddenError('Account is disabled. Please contact support.');
    }

    loginAttemptsTotal.inc({ outcome: 'success' });

    // Best-effort: a failed `lastLogin` write must not log the user out.
    await prisma.user
      .update({ where: { id: user.id }, data: { lastLogin: new Date() } })
      .catch(() => undefined);

    return {
      user: sanitizeUser(user),
      ...this.issueTokens(user),
    };
  }

  /** Exchange a refresh token for a fresh access/refresh pair (rotation). */
  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) throw new UnauthorizedError('Account no longer exists');
    if (!user.isActive) throw new ForbiddenError('Account is disabled');

    return {
      user: sanitizeUser(user),
      ...this.issueTokens(user),
    };
  }

  /**
   * Start a password reset.
   *
   * The response is intentionally identical whether or not the address exists,
   * so the endpoint cannot be used to enumerate registered users.
   */
  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, passwordHash: true },
    });

    const genericResponse = { message: 'If the email exists, an OTP has been sent' };
    if (!user) return genericResponse;

    const otp = await this.otpService().issue(normalizedEmail);
    await this.deliverOtp(normalizedEmail, otp);

    return { message: 'If the email exists, an OTP has been sent' };
  }

  /**
   * Verify the OTP and mint a single-purpose password-reset token.
   *
   * The reset token is signed with the *refresh* secret and carries
   * `type: 'password_reset'`, so it is rejected by `authenticateToken` — the
   * previous implementation signed it with the access-token secret, meaning a
   * password-reset token was accepted as a session credential.
   */
  async verifyOTP(email: string, otp: string) {
    const normalizedEmail = email.toLowerCase();
    await this.otpService().verify(normalizedEmail, otp);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { email: true, passwordHash: true },
    });
    if (!user) throw new NotFoundError('User');

    return {
      resetToken: generatePasswordResetToken(user.email, user.passwordHash),
      expiresInSeconds: 15 * 60,
    };
  }

  /**
   * Complete a password reset.
   *
   * **Requires** the `resetToken` issued by `verifyOTP`. The previous
   * implementation accepted `{ email, password }` alone, which allowed anyone
   * to overwrite any account's password without authenticating — a trivial,
   * unauthenticated account takeover.
   */
  async resetPassword(email: string, newPassword: string, resetToken: string) {
    const normalizedEmail = email.toLowerCase();

    let payload;
    try {
      payload = verifyPasswordResetToken(resetToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired reset token. Please request a new OTP.');
    }

    if (payload.email.toLowerCase() !== normalizedEmail) {
      throw new UnauthorizedError('Reset token does not match this account');
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) throw new NotFoundError('User');

    // Binds the token to the credential it was issued against: once the
    // password changes, the fingerprint differs and the token is dead.
    if (payload.phf !== fingerprintPasswordHash(user.passwordHash)) {
      throw new UnauthorizedError('This reset link has already been used. Please request a new OTP.');
    }

    if (await comparePassword(newPassword, user.passwordHash)) {
      throw new AppError('New password must be different from the current password', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    return { message: 'Password reset successful' };
  }

  /** Change password while authenticated. */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    if (!(await comparePassword(currentPassword, user.passwordHash))) {
      throw new UnauthorizedError('Current password is incorrect');
    }
    if (await comparePassword(newPassword, user.passwordHash)) {
      throw new AppError('New password must be different from the current password', 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    return { message: 'Password updated successfully' };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');
    return sanitizeUser(user);
  }

  /**
   * Update the caller's own profile.
   *
   * Only whitelisted columns are written. The previous implementation handed
   * `req.body` straight to Prisma, so `role`, `isActive` or `emailVerified`
   * could be self-assigned — a plain user could promote themselves to
   * `SUPER_ADMIN` with one PATCH.
   */
  async updateProfile(userId: string, data: Record<string, unknown>) {
    const payload: Record<string, unknown> = {};
    for (const field of UPDATABLE_PROFILE_FIELDS) {
      const value = data[field as UpdatableProfileField];
      if (value !== undefined) payload[field] = value === '' ? null : value;
    }

    if (Object.keys(payload).length === 0) {
      throw new AppError('No updatable fields provided', 400);
    }

    try {
      const user = await prisma.user.update({ where: { id: userId }, data: payload });
      return sanitizeUser(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('That phone number is already linked to another account');
      }
      if (isRecordNotFound(error)) {
        throw new NotFoundError('User');
      }
      throw error;
    }
  }

  private issueTokens(user: { id: string; email: string; role: string }): AuthTokens {
    return {
      accessToken: generateAccessToken({ id: user.id, email: user.email, role: user.role }),
      refreshToken: generateRefreshToken(user.id),
    };
  }

  /**
   * Deliver the OTP. SMTP is not wired up in this repository, so the fallback is
   * a structured log line — but only outside production, where leaking a
   * credential-reset code into an aggregated log would be a security incident.
   */
  private async deliverOtp(email: string, otp: string): Promise<void> {
    if (env.smtp.configured) {
      // An SMTP transport can be plugged in here without changing callers.
      await this.sendOtpEmail(email, otp).catch((error: Error) => {
        console.error(`Failed to send OTP email to ${email}: ${error.message}`);
      });
      return;
    }

    if (env.otp.logToConsole) {
      console.log(`🔐 Password reset OTP for ${email}: ${otp} (valid ${env.otp.ttlMs / 60000} min)`);
    }
  }

  private async sendOtpEmail(_email: string, _otp: string): Promise<void> {
    // Placeholder for a nodemailer/SES integration. Kept as a single seam so the
    // delivery mechanism can be swapped without touching the reset flow.
    return Promise.resolve();
  }
}

/**
 * A fixed bcrypt hash of an unguessable string. Comparing against it when the
 * account does not exist keeps login latency uniform.
 */
const DUMMY_HASH = bcrypt.hashSync('gameshop-dummy-password-for-timing-equalisation', 10);

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2025'
  );
}

export const authService = new AuthService();
export { USER_ROLES };
