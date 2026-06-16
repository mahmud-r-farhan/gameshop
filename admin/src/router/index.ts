import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '../layout/AdminLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AdminLayout,
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('../views/Dashboard.vue'),
        },
        {
          path: 'products',
          name: 'Products',
          component: () => import('../views/Products.vue'),
        },
        {
          path: 'products/new',
          name: 'NewProduct',
          component: () => import('../views/ProductForm.vue'),
        },
        {
          path: 'products/:id/edit',
          name: 'EditProduct',
          component: () => import('../views/ProductForm.vue'),
        },
        {
          path: 'orders',
          name: 'Orders',
          component: () => import('../views/Orders.vue'),
        },
        {
          path: 'orders/:id',
          name: 'OrderDetail',
          component: () => import('../views/OrderDetail.vue'),
        },
        {
          path: 'payments',
          name: 'Payments',
          component: () => import('../views/Payments.vue'),
        },
        {
          path: 'analytics',
          name: 'Analytics',
          component: () => import('../views/Analytics.vue'),
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('../views/Settings.vue'),
        },
      ],
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
    },
  ],
})

// Auth guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token')
  if (to.name !== 'Login' && !token) {
    next({ name: 'Login' })
  } else {
    next()
  }
})

export default router
