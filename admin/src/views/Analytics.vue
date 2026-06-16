<template>
  <div class="animate-fade-in-up">
    <h1 class="text-2xl font-black text-text-primary tracking-tight mb-6">Analytics</h1>

    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div v-for="i in 4" :key="i" class="glass-card p-6 rounded-xl"><div class="skeleton h-48 rounded-xl"></div></div>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Revenue Stats -->
      <div class="glass-card p-6 rounded-xl">
        <h2 class="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-green-400">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Revenue Summary
        </h2>
        <div class="space-y-3">
          <div class="flex justify-between items-center p-4 rounded-xl bg-green-500/5 border border-green-500/10">
            <div><p class="text-xs text-text-muted uppercase tracking-wider font-medium">Today</p><p class="text-2xl font-black text-green-400 mt-0.5">BDT {{ formatNumber(stats?.today?.totalRevenue) }}</p></div>
          </div>
          <div class="flex justify-between items-center p-4 rounded-xl bg-neon-cyan/5 border border-neon-cyan/10">
            <div><p class="text-xs text-text-muted uppercase tracking-wider font-medium">This Week</p><p class="text-2xl font-black neon-text mt-0.5">BDT {{ formatNumber(stats?.weekly?.totalRevenue) }}</p></div>
          </div>
          <div class="flex justify-between items-center p-4 rounded-xl bg-neon-violet/5 border border-neon-violet/10">
            <div><p class="text-xs text-text-muted uppercase tracking-wider font-medium">This Month</p><p class="text-2xl font-black neon-text-violet mt-0.5">BDT {{ formatNumber(stats?.monthly?.totalRevenue) }}</p></div>
          </div>
        </div>
      </div>

      <!-- Order Stats -->
      <div class="glass-card p-6 rounded-xl">
        <h2 class="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-neon-amber">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Order Summary
        </h2>
        <div class="space-y-3">
          <div class="flex justify-between items-center p-4 rounded-xl bg-neon-amber/5 border border-neon-amber/10">
            <span class="text-sm text-text-muted">Orders Today</span>
            <span class="text-2xl font-black neon-text-amber">{{ stats?.today?.totalOrders || 0 }}</span>
          </div>
          <div class="flex justify-between items-center p-4 rounded-xl bg-neon-cyan/5 border border-neon-cyan/10">
            <span class="text-sm text-text-muted">Orders This Week</span>
            <span class="text-2xl font-black neon-text">{{ stats?.weekly?.totalOrders || 0 }}</span>
          </div>
          <div class="flex justify-between items-center p-4 rounded-xl bg-neon-violet/5 border border-neon-violet/10">
            <span class="text-sm text-text-muted">Orders This Month</span>
            <span class="text-2xl font-black neon-text-violet">{{ stats?.monthly?.totalOrders || 0 }}</span>
          </div>
        </div>
      </div>

      <!-- Payment Methods Distribution -->
      <div class="glass-card p-6 rounded-xl">
        <h2 class="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-neon-cyan">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
          </svg>
          Payment Methods Distribution
        </h2>
        <div class="space-y-4">
          <div v-for="(count, method) in stats?.today?.paymentMethods || {}" :key="method" class="flex justify-between items-center">
            <span class="text-sm text-text-secondary capitalize font-medium">{{ method }}</span>
            <div class="flex items-center gap-3">
              <div class="w-40 bg-surface-card rounded-full h-2.5">
                <div class="bg-gradient-to-r from-neon-cyan to-neon-violet h-2.5 rounded-full transition-all duration-500" :style="{ width: paymentPercent(count) + '%' }"></div>
              </div>
              <span class="text-sm font-semibold text-text-primary w-8 text-right">{{ count }}</span>
            </div>
          </div>
          <div v-if="!hasPaymentData" class="text-text-muted text-center py-6">
            <div class="text-3xl mb-2">📊</div>
            <p>No payment data available</p>
          </div>
        </div>
      </div>

      <!-- Top Products -->
      <div class="glass-card p-6 rounded-xl">
        <h2 class="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-neon-amber">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          Top Selling Products
        </h2>
        <div v-if="stats?.topProducts?.length" class="space-y-2">
          <div v-for="(product, idx) in stats.topProducts" :key="idx" class="flex items-center justify-between p-3 rounded-xl bg-surface-card hover:bg-surface-hover border border-border-glass transition-all group">
            <div class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-lg bg-neon-cyan/10 text-neon-cyan text-xs font-bold flex items-center justify-center">{{ idx + 1 }}</span>
              <span class="text-sm font-semibold text-text-primary">{{ product.name }}</span>
            </div>
            <span class="text-sm font-bold text-neon-cyan">{{ product.sales }} sales</span>
          </div>
        </div>
        <div v-else class="text-text-muted text-center py-6">
          <div class="text-3xl mb-2">🎮</div>
          <p>No product data yet</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { dashboardAPI } from '../services/api'

const stats = ref<any>(null)
const loading = ref(true)

const hasPaymentData = computed(() => {
  return stats.value?.today?.paymentMethods && Object.keys(stats.value.today.paymentMethods).length > 0
})

const totalPayments = computed(() => {
  const methods = stats.value?.today?.paymentMethods || {}
  return Object.values(methods).reduce((sum: number, count: any) => sum + count, 0)
})

function paymentPercent(count: number) {
  if (!totalPayments.value) return 0
  return (count / totalPayments.value) * 100
}

function formatNumber(num: number | undefined | null) {
  return (num || 0).toLocaleString()
}

onMounted(async () => {
  try {
    const res = await dashboardAPI.getStats()
    stats.value = res.data.data
  } catch { console.error('Failed to load stats') }
  finally { loading.value = false }
})
</script>
