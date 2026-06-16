import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authAPI = {
  register: (data: { email: string; phone?: string; password: string; fullName: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  verifyOTP: (email: string, otp: string) =>
    api.post('/auth/verify-otp', { email, otp }),
  resetPassword: (email: string, password: string) =>
    api.post('/auth/reset-password', { email, password }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.patch('/auth/profile', data),
};

// Product API
export const productAPI = {
  list: (params?: any) => api.get('/products', { params }),
  getFeatured: () => api.get('/products/featured'),
  getById: (id: string) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.patch(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  toggleFeatured: (id: string) => api.patch(`/products/${id}/toggle-featured`),
};

// Order API
export const orderAPI = {
  create: (data: any) => api.post('/orders', data),
  getMyOrders: (params?: any) => api.get('/orders', { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  submitPayment: (id: string, data: any) => api.post(`/orders/${id}/submit-payment`, data),
  getAll: (params?: any) => api.get('/orders/admin/all', { params }),
  updateStatus: (id: string, status: string) => api.patch(`/orders/${id}/status`, { status }),
  verifyPayment: (id: string, data: any) => api.patch(`/orders/${id}/verify-payment`, data),
};

// Review API
export const reviewAPI = {
  create: (data: any) => api.post('/reviews', data),
  getProductReviews: (productId: string, params?: any) =>
    api.get(`/reviews/product/${productId}`, { params }),
  getDistribution: (productId: string) =>
    api.get(`/reviews/product/${productId}/distribution`),
};

// Admin API
export const adminAPI = {
  getDashboardStats: () => api.get('/admin/dashboard/stats'),
  getPaymentGateways: () => api.get('/admin/payment-gateways'),
  createPaymentGateway: (data: any) => api.post('/admin/payment-gateways', data),
  updatePaymentGateway: (id: string, data: any) => api.put(`/admin/payment-gateways/${id}`, data),
  deletePaymentGateway: (id: string) => api.delete(`/admin/payment-gateways/${id}`),
  getPromotions: (params?: any) => api.get('/admin/promotions', { params }),
  createPromotion: (data: any) => api.post('/admin/promotions', data),
  togglePromotion: (id: string) => api.patch(`/admin/promotions/${id}/toggle`),
  getFeedback: (params?: any) => api.get('/admin/feedback', { params }),
  replyFeedback: (id: string, reply: string) => api.post(`/admin/feedback/${id}/reply`, { reply }),
  getUsers: (params?: any) => api.get('/admin/users', { params }),
  toggleUserStatus: (id: string) => api.patch(`/admin/users/${id}/toggle-status`),
};
