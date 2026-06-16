import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

export const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

export const generateTransactionId = (): string => {
  return `TRX-${uuidv4().substring(0, 8).toUpperCase()}`;
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateAccessToken = (user: { id: string; email: string; role: string }): string => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn as any }
  );
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { id: userId },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn as any }
  );
};

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const calculateDiscount = (subtotal: number, discountType: string, discountValue: number): number => {
  if (discountType === 'PERCENTAGE') {
    return (subtotal * discountValue) / 100;
  }
  return discountValue;
};

export const calculateDiscountedPrice = (price: number, discountPercent: number): number => {
  return price - (price * discountPercent) / 100;
};

export const formatCurrency = (amount: number, currency: string = 'BDT'): string => {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const sanitizeUser = (user: any) => {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

export const paginateResponse = (data: any[], total: number, page: number, limit: number) => {
  return {
    data,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: limit,
    },
  };
};
