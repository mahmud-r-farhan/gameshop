<template>
  <div class="min-h-screen flex items-center justify-center bg-[#0A0D14] bg-grid px-4 relative overflow-hidden">
    <!-- Decorative glow orbs -->
    <div class="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-neon-cyan/5 blur-[100px]"></div>
    <div class="absolute bottom-1/4 -right-20 w-72 h-72 rounded-full bg-neon-violet/5 blur-[100px]"></div>

    <div class="w-full max-w-md animate-scale-in">
      <div class="glass-card p-8 rounded-2xl">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-black gradient-text tracking-tight">GameShop</h1>
          <p class="text-text-muted mt-2 text-sm">Admin Panel Login</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
            <input
              v-model="email"
              type="email"
              required
              placeholder="admin@gameshop.com"
              class="input-glass"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
            <input
              v-model="password"
              type="password"
              required
              placeholder="Enter your password"
              class="input-glass"
            />
          </div>

          <div v-if="error" class="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm border border-red-500/20">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3 btn-neon rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminAuthStore } from '../store/useAuthStore'

const router = useRouter()
const authStore = useAdminAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    const user = await authStore.login(email.value, password.value)
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      router.push('/dashboard')
    } else {
      error.value = 'You do not have admin access'
      authStore.logout()
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>
