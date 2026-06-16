import { Request, Response, NextFunction } from 'express';

type ValidationRule = {
  field: string;
  type: 'string' | 'number' | 'email' | 'phone' | 'uuid' | 'array' | 'object' | 'boolean';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  message?: string;
};

export const validate = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(rule.message || `${rule.field} is required`);
        continue;
      }

      if (value === undefined || value === null || value === '') continue;

      switch (rule.type) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(rule.message || `${rule.field} must be a valid email`);
          }
          break;
        case 'phone':
          if (!/^\+?[\d\s-]{10,15}$/.test(value)) {
            errors.push(rule.message || `${rule.field} must be a valid phone number`);
          }
          break;
        case 'string':
          if (typeof value !== 'string') {
            errors.push(rule.message || `${rule.field} must be a string`);
          } else if (rule.min && value.length < rule.min) {
            errors.push(rule.message || `${rule.field} must be at least ${rule.min} characters`);
          } else if (rule.max && value.length > rule.max) {
            errors.push(rule.message || `${rule.field} must be at most ${rule.max} characters`);
          } else if (rule.pattern && !rule.pattern.test(value)) {
            errors.push(rule.message || `${rule.field} format is invalid`);
          }
          break;
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(rule.message || `${rule.field} must be a number`);
          }
          break;
        case 'array':
          if (!Array.isArray(value)) {
            errors.push(rule.message || `${rule.field} must be an array`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(rule.message || `${rule.field} must be a boolean`);
          }
          break;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    next();
  };
};

// Reusable validation rules
export const passwordRule: ValidationRule = {
  field: 'password',
  type: 'string',
  required: true,
  min: 6,
  message: 'Password must be at least 6 characters',
};

export const emailRule: ValidationRule = {
  field: 'email',
  type: 'email',
  required: true,
  message: 'Valid email is required',
};

export const phoneRule: ValidationRule = {
  field: 'phone',
  type: 'phone',
  required: false,
  message: 'Valid phone number is required',
};
