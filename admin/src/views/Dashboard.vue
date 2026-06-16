<template>
  <div class="animate-fade-in-up">
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-black text-text-primary tracking-tight">Dashboard</h1>
        <p class="text-text-muted mt-1">Welcome back, {{ authStore.user?.fullName || 'Admin' }}</p>
      </div>
      <div class="flex gap-2">
        <button
          v-for="tf in timeframes"
          :key="tf"
          @click="timeframe = tf"
          :class="[
            'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ease-spring',
            timeframe === tf
              ? 'btn-neon'
              : 'btn-glass'
          ]"
        >
          {{ tf.charAt(0).toUpperCase() + tf.slice(1) }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div v-for="i in 4" :key="i" class="glass-card p-6 rounded-xl">
        <div class="skeleton h-4 w-1/2 mb-3"></div>
        <div class="skeleton h-8 w-3/4"></div>
      </div>
    </div>

    <!-- KPI Cards -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="glass-card p-6 rounded-xl group hover:border-neon-cyan/30">
        <div class="text-2xl mb-2">📦</div>
        <p class="text-text-muted text-xs font-medium uppercase tracking-wider">Total Orders</p>
        <p class="text-2xl font-black neon-text mt-1">{{ stats?.today?.totalOrders || 0 }}</p>
      </div>
      <div class="glass-card p-6 rounded-xl group hover:border-green-500/30">
        <div class="text-2xl mb-2">💰</div>
        <p class="text-text-muted text-xs font-medium uppercase tracking-wider">Revenue</p>
        <p class="text-2xl font-black text-green-400 mt-1">BDT {{ formatNumber(stats?.today?.totalRevenue) }}</p>
      </div>
      <div class="glass-card p-6 rounded-xl group hover:border-neon-amber/30">
        <div class="text-2xl mb-2">⏳</div>
        <p class="text-text-muted text-xs font-medium uppercase tracking-wider">Pending Payments</p>
        <p class="text-2xl font-black neon-text-amber mt-1">{{ stats?.today?.pendingPayments || 0 }}</p>
      </div>
      <div class="glass-card p-6 rounded-xl group hover:border-green-500/30">
        <div class="text-2xl mb-2">✅</div>
        <p class="text-text-muted text-xs font-medium uppercase tracking-wider">Delivered</p>
        <p class="text-2xl font-black text-green-400 mt-1">{{ stats?.today?.deliveredOrders || 0 }}</p>
      </div>
    </div>

    <!-- Charts Row -->
    <div v-if="!loading" class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div class="glass-card p-6 rounded-xl">
        <h2 class="text-lg font-bold text-text-primary mb-4">Revenue Overview</h2>
        <div class="space-y-3">
          <div class="flex justify-between items-center p-4 rounded-xl bg-green-500/5 border border-green-500/10">
            <span class="text-sm text-text-secondary">Today</span>
            <span class="font-bold text-green-400">BDT {{ formatNumber(stats?.today?.totalRevenue) }}</span>
          </div>
          <div class="flex justify-between items-center p-4 rounded-xl bg-neon-cyan/5 border border-neon-cyan/10">
            <span class="text-sm text-text-secondary">This Week</span>
            <span class="font-bold text-neon-cyan">BDT {{ formatNumber(stats?.weekly?.totalRevenue) }}</span>
          </div>
          <div class="flex justify-between items-center p-4 rounded-xl bg-neon-violet/5 border border-neon-violet/10">
            <span class="text-sm text-text-secondary">This Month</span>
            <span class="font-bold neon-text-violet">BDT {{ formatNumber(stats?.monthly?.totalRevenue) }}</span>
          </div>
        </div>
      </div>

      <div class="glass-card p-6 rounded-xl">
        <h2 class="text-lg font-bold text-text-primary mb-4">Payment Methods</h2>
        <div class="space-y-4">
          <div v-for="(count, method) in stats?.today?.paymentMethods || {}" :key="method" class="flex justify-between items-center">
            <span class="text-sm text-text-secondary capitalize">{{ method }}</span>
            <div class="flex items-center gap-3">
              <div class="w-32 bg-surface-card rounded-full h-2">
                <div
                  class="bg-neon-cyan h-2 rounded-full transition-all duration-500"
                  :style="{ width: (count / totalPayments * 100) + '%' }"
                ></div>
              </div>
              <span class="text-sm font-semibold text-text-primary w-6 text-right">{{ count }}</span>
            </div>
          </div>
          <div v-if="!stats?.today?.paymentMethods || Object.keys(stats.today.paymentMethods).length === 0" class="text-text-muted text-sm text-center py-6">
            No payment data yet
          </div>
        </div>
      </div>
    </div>

    <!-- Top Products -->
    <div v-if="stats?.topProducts?.length > 0" class="glass-card p-6 rounded-xl">
      <h2 class="text-lg font-bold text-text-primary mb-4">Top Selling Products</h2>
      <div class="overflow-x-auto">
        <table class="table-glass">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Sales</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(product, idx) in stats.topProducts" :key="idx">
              <td>
                <span class="w-7 h-7 rounded-lg bg-neon-cyan/10 text-neon-cyan text-xs font-bold flex items-center justify-center">{{ idx + 1 }}</span>
              </td>
              <td class="font-medium text-text-primary">{{ product.name }}</td>
              <td class="font-semibold text-neon-cyan">{{ product.sales }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAdminAuthStore } from '../store/useAuthStore'
import { dashboardAPI } from '../services/api'

const authStore = useAdminAuthStore()
const stats = ref<any>(null)
const loading = ref(true)
const timeframe = ref('today')

const timeframes = ['today', 'weekly', 'monthly']

const totalPayments = computed(() => {
  const methods = stats.value?.today?.paymentMethods || {}
  return Object.values(methods).reduce((sum: number, count: any) => sum + count, 0)
})

function formatNumber(num: number | undefined | null) {
  return (num || 0).toLocaleString()
}

async function loadStats() {
  loading.value = true
  try {
    const res = await dashboardAPI.getStats()
    stats.value = res.data.data
  } catch (err) {
    console.error('Failed to load dashboard stats:', err)
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>
