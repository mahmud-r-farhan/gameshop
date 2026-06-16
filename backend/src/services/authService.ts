import prisma from '../config/database.js';
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, generateOTP, sanitizeUser } from '../utils/helpers.js';
import { AppError } from '../middleware/errorHandler.js';

export class AuthService {
  async register(email: string, phone: string | undefined, password: string, fullName: string) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(phone ? [{ phone }] : [])],
      },
    });

    if (existingUser) {
      throw new AppError('Email or phone already registered', 409);
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash: hashedPassword,
        fullName,
        notificationPreferences: {},
      },
    });

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken(user.id);

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('Invalid email or password', 401);

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) throw new AppError('Invalid email or password', 401);

    if (!user.isActive) throw new AppError('Account is disabled', 403);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken(user.id);

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email exists, an OTP has been sent' };
    }

    const otp = generateOTP();

    // In production, store OTP in Redis with 10min expiry
    // For now, we'll use a simple approach
    (global as any)._otpStore = (global as any)._otpStore || {};
    (global as any)._otpStore[email] = { otp, expiresAt: Date.now() + 600000 };

    // In production, send via email
    console.log(`OTP for ${email}: ${otp}`);

    return { message: 'OTP sent to your email' };
  }

  async verifyOTP(email: string, otp: string) {
    const store = (global as any)._otpStore || {};
    const stored = store[email];

    if (!stored || stored.otp !== otp) {
      throw new AppError('Invalid OTP', 400);
    }

    if (Date.now() > stored.expiresAt) {
      delete store[email];
      throw new AppError('OTP has expired', 400);
    }

    delete store[email];

    const resetToken = generateAccessToken({ id: '', email, role: 'USER' });
    return { resetToken };
  }

  async resetPassword(email: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404);

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    });

    return { message: 'Password reset successful' };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    return sanitizeUser(user);
  }

  async updateProfile(userId: string, data: any) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });
    return sanitizeUser(user);
  }
}

export const authService = new AuthService();
