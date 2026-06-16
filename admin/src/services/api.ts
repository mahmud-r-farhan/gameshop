import axios from 'axios'

const API_BASE = '/api/v1'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// Auth
export const adminAuthAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  getProfile: () => api.get('/auth/profile'),
}

// Dashboard
export const dashboardAPI = {
  getStats: () => api.get('/admin/dashboard/stats'),
}

// Products
export const productsAPI = {
  list: (params?: any) => api.get('/products', { params }),
  getById: (id: string) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.patch(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  toggleFeatured: (id: string) => api.patch(`/products/${id}/toggle-featured`),
}

// Orders
export const ordersAPI = {
  list: (params?: any) => api.get('/orders/admin/all', { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  updateStatus: (id: string, status: string) => api.patch(`/orders/${id}/status`, { status }),
  verifyPayment: (id: string, data: any) => api.patch(`/orders/${id}/verify-payment`, data),
}

// Payments / Gateways
export const paymentGatewayAPI = {
  list: () => api.get('/admin/payment-gateways'),
  create: (data: any) => api.post('/admin/payment-gateways', data),
  update: (id: string, data: any) => api.put(`/admin/payment-gateways/${id}`, data),
  delete: (id: string) => api.delete(`/admin/payment-gateways/${id}`),
}

// Promotions
export const promotionsAPI = {
  list: (params?: any) => api.get('/admin/promotions', { params }),
  create: (data: any) => api.post('/admin/promotions', data),
  toggle: (id: string) => api.patch(`/admin/promotions/${id}/toggle`),
}

// Feedback
export const feedbackAPI = {
  list: (params?: any) => api.get('/admin/feedback', { params }),
  reply: (id: string, reply: string) => api.post(`/admin/feedback/${id}/reply`, { reply }),
}

// Users
export const usersAPI = {
  list: (params?: any) => api.get('/admin/users', { params }),
  toggleStatus: (id: string) => api.patch(`/admin/users/${id}/toggle-status`),
}

// Settings
export const settingsAPI = {
  list: () => api.get('/admin/settings'),
  update: (key: string, value: any) => api.put(`/admin/settings/${key}`, { value }),
}
