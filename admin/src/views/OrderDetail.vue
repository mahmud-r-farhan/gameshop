<template>
  <div class="animate-fade-in-up">
    <div class="flex items-center gap-4 mb-6">
      <router-link to="/orders" class="inline-flex items-center gap-1.5 text-text-muted hover:text-neon-cyan transition-all text-sm font-medium">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back
      </router-link>
      <h1 class="text-2xl font-black text-text-primary tracking-tight">Order {{ order?.orderNumber }}</h1>
      <span :class="statusClass(order?.orderStatus)" class="px-3 py-1 rounded-full text-xs font-semibold">{{ order?.orderStatus }}</span>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm text-text-muted">Loading order...</span>
      </div>
    </div>

    <div v-else-if="order" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Order Items -->
      <div class="lg:col-span-2 glass-card p-6 rounded-xl">
        <h2 class="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-neon-cyan">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Items
        </h2>
        <div class="space-y-3">
          <div v-for="item in order.items" :key="item.id" class="flex justify-between items-center py-3 border-b border-border-glass last:border-0">
            <div>
              <p class="font-semibold text-text-primary text-sm">{{ item.productName }}</p>
              <p class="text-xs text-text-muted mt-0.5">Qty: {{ item.quantity }} × BDT {{ Number(item.price).toLocaleString() }}</p>
            </div>
            <p class="font-bold text-text-primary">BDT {{ (item.quantity * Number(item.price)).toLocaleString() }}</p>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-border-glass space-y-2">
          <div class="flex justify-between text-sm"><span class="text-text-muted">Subtotal</span><span class="text-text-primary">BDT {{ Number(order.subtotal).toLocaleString() }}</span></div>
          <div v-if="Number(order.discountAmount) > 0" class="flex justify-between text-sm"><span class="text-text-muted">Discount</span><span class="text-green-400">-BDT {{ Number(order.discountAmount).toLocaleString() }}</span></div>
          <div class="flex justify-between font-bold text-lg pt-2 border-t border-border-glass"><span class="text-text-primary">Total</span><span class="neon-text">BDT {{ Number(order.totalAmount).toLocaleString() }}</span></div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="space-y-4">
        <div class="glass-card p-5 rounded-xl">
          <h2 class="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Customer</h2>
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-violet/20 flex items-center justify-center text-neon-cyan font-bold text-sm">
              {{ order.user?.fullName?.charAt(0) || '?' }}
            </div>
            <div>
              <p class="font-semibold text-text-primary text-sm">{{ order.user?.fullName }}</p>
              <p class="text-xs text-text-muted">{{ order.user?.email }}</p>
            </div>
          </div>
          <p class="text-xs text-text-muted flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            {{ order.user?.phone || 'No phone' }}
          </p>
        </div>

        <div class="glass-card p-5 rounded-xl">
          <h2 class="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Delivery</h2>
          <p class="text-sm text-text-secondary leading-relaxed">{{ order.deliveryAddress }}</p>
          <p v-if="order.deliveryInstructions" class="text-xs text-text-muted mt-2 italic border-t border-border-glass pt-2">{{ order.deliveryInstructions }}</p>
        </div>

        <div class="glass-card p-5 rounded-xl">
          <h2 class="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Payment</h2>
          <div class="space-y-3">
            <div class="flex justify-between items-center text-sm">
              <span class="text-text-muted">Status</span>
              <span :class="statusClass(order.paymentStatus)" class="px-2.5 py-0.5 rounded-full text-xs font-semibold">{{ order.paymentStatus }}</span>
            </div>
            <div class="flex justify-between text-sm"><span class="text-text-muted">Method</span><span class="text-text-primary">{{ order.paymentMethod || '—' }}</span></div>
            <div class="flex justify-between text-sm"><span class="text-text-muted">Transaction</span><span class="font-mono text-xs text-neon-cyan bg-neon-cyan/5 px-2 py-0.5 rounded">{{ order.transactionId || '—' }}</span></div>
          </div>
        </div>

        <!-- Actions -->
        <div class="glass-card p-5 rounded-xl">
          <h2 class="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Actions</h2>
          <div class="space-y-2.5">
            <button
              v-if="order.paymentStatus === 'PENDING_VERIFICATION'"
              @click="handleVerifyPayment"
              class="w-full py-2.5 btn-neon rounded-xl text-sm font-semibold"
            >
              Verify Payment
            </button>
            <button
              v-if="order.orderStatus === 'PROCESSING'"
              @click="handleDeliver"
              class="w-full py-2.5 btn-neon-violet rounded-xl text-sm font-semibold"
            >
              Mark as Delivered
            </button>
            <button
              v-if="order.orderStatus === 'PENDING' || order.orderStatus === 'PROCESSING'"
              @click="handleCancel"
              class="w-full py-2.5 rounded-xl text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all"
            >
              Cancel Order
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ordersAPI } from '../services/api'
import toast from '../utils/toast'

const route = useRoute()
const order = ref<any>(null)
const loading = ref(true)

onMounted(loadOrder)

async function loadOrder() {
  try {
    const res = await ordersAPI.getById(route.params.id as string)
    order.value = res.data.data
  } catch { toast.error('Failed to load order') }
  finally { loading.value = false }
}

async function handleVerifyPayment() {
  try {
    await ordersAPI.verifyPayment(order.value.id, {
      transactionId: order.value.transactionId || `ADM-${Date.now()}`,
      note: 'Verified by admin',
    })
    toast.success('Payment verified!')
    loadOrder()
  } catch { toast.error('Failed to verify') }
}

async function handleDeliver() {
  try {
    await ordersAPI.updateStatus(order.value.id, 'DELIVERED')
    toast.success('Order marked as delivered!')
    loadOrder()
  } catch { toast.error('Failed to update') }
}

async function handleCancel() {
  try {
    await ordersAPI.updateStatus(order.value.id, 'CANCELLED')
    toast.success('Order cancelled')
    loadOrder()
  } catch { toast.error('Failed to cancel') }
}

function statusClass(status: string) {
  const map: Record<string, string> = {
    PENDING: 'badge-warning',
    PROCESSING: 'badge-info',
    DELIVERED: 'badge-success',
    CANCELLED: 'badge-error',
    VERIFIED: 'badge-success',
    PENDING_VERIFICATION: 'text-orange-400 bg-orange-500/10 border border-orange-500/20',
    FAILED: 'badge-error',
  }
  return map[status] || 'bg-surface-card text-text-secondary border border-border-glass'
}
</script>
