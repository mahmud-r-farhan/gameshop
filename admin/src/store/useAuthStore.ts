import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { adminAuthAPI } from '../services/api'

export const useAdminAuthStore = defineStore('adminAuth', () => {
  const user = ref<any>(null)
  const token = ref<string | null>(localStorage.getItem('admin_token'))
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value)

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const res = await adminAuthAPI.login(email, password)
      const { user: userData, accessToken } = res.data.data
      user.value = userData
      token.value = accessToken
      localStorage.setItem('admin_token', accessToken)
      return userData
    } finally {
      loading.value = false
    }
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('admin_token')
  }

  async function fetchProfile() {
    try {
      const res = await adminAuthAPI.getProfile()
      user.value = res.data.data
    } catch {
      logout()
    }
  }

  return { user, token, loading, isAuthenticated, login, logout, fetchProfile }
})
