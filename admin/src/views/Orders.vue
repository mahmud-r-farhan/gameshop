<template>
  <div class="animate-fade-in-up">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-black text-text-primary tracking-tight">Orders</h1>
      <div class="flex gap-2">
        <select v-model="filters.status" @change="loadOrders" class="select-glass text-sm py-2 px-3 min-w-[140px]">
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select v-model="filters.paymentStatus" @change="loadOrders" class="select-glass text-sm py-2 px-3 min-w-[180px]">
          <option value="">All Payments</option>
          <option value="PENDING">Pending</option>
          <option value="PENDING_VERIFICATION">Awaiting Verification</option>
          <option value="VERIFIED">Verified</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="glass-card rounded-xl p-6">
      <div v-for="i in 5" :key="i" class="skeleton h-14 rounded-xl mb-3"></div>
    </div>

    <div v-else class="glass-card rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table-glass">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id" class="animate-fade-in-up" :style="{ animationDelay: `${orders.indexOf(order) * 30}ms` }">
              <td><span class="font-mono text-xs text-neon-cyan bg-neon-cyan/5 px-2 py-1 rounded-lg">{{ order.orderNumber }}</span></td>
              <td class="text-text-primary font-medium">{{ order.user?.fullName || 'N/A' }}</td>
              <td>{{ order.items?.length || 0 }}</td>
              <td class="font-semibold text-text-primary">BDT {{ Number(order.totalAmount).toLocaleString() }}</td>
              <td>
                <span :class="paymentBadgeClass(order.paymentStatus)" class="px-2.5 py-1 rounded-full text-xs font-semibold">{{ order.paymentStatus }}</span>
              </td>
              <td>
                <span :class="statusBadgeClass(order.orderStatus)" class="px-2.5 py-1 rounded-full text-xs font-semibold">{{ order.orderStatus }}</span>
              </td>
              <td class="text-xs text-text-muted">{{ new Date(order.createdAt).toLocaleDateString() }}</td>
              <td>
                <router-link :to="`/orders/${order.id}`" class="px-3 py-1.5 btn-glass rounded-lg text-xs font-medium inline-block">View</router-link>
              </td>
            </tr>
            <tr v-if="orders.length === 0">
              <td colspan="8" class="text-center text-text-muted py-12">
                <div class="text-4xl mb-3">📋</div>
                <p class="font-medium">No orders found</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="pagination" class="flex justify-between items-center p-4 border-t border-border-glass">
        <span class="text-sm text-text-muted">Page {{ pagination.currentPage }} of {{ pagination.totalPages }}</span>
        <div class="flex gap-2">
          <button :disabled="pagination.currentPage <= 1" @click="changePage(-1)" class="px-3 py-1.5 btn-glass rounded-lg text-sm disabled:opacity-40">Prev</button>
          <button :disabled="pagination.currentPage >= pagination.totalPages" @click="changePage(1)" class="px-3 py-1.5 btn-glass rounded-lg text-sm disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ordersAPI } from '../services/api'

const orders = ref<any[]>([])
const loading = ref(true)
const pagination = ref<any>(null)
const currentPage = ref(1)
const filters = reactive({ status: '', paymentStatus: '' })

onMounted(loadOrders)

async function loadOrders(page = 1) {
  loading.value = true
  currentPage.value = page
  try {
    const params: any = { page, limit: 20 }
    if (filters.status) params.status = filters.status
    if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus
    const res = await ordersAPI.list(params)
    orders.value = res.data.data.orders
    pagination.value = res.data.data.pagination
  } catch { console.error('Failed to load orders') }
  finally { loading.value = false }
}

function changePage(delta: number) {
  const newPage = currentPage.value + delta
  if (newPage < 1 || (pagination.value && newPage > pagination.value.totalPages)) return
  loadOrders(newPage)
}

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    PENDING: 'badge-warning',
    PROCESSING: 'badge-info',
    DELIVERED: 'badge-success',
    CANCELLED: 'badge-error',
  }
  return map[status] || 'bg-surface-card text-text-secondary border border-border-glass px-2.5 py-1 rounded-full text-xs font-semibold'
}

function paymentBadgeClass(status: string) {
  const map: Record<string, string> = {
    PENDING: 'badge-warning',
    PENDING_VERIFICATION: 'text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full text-xs font-semibold',
    VERIFIED: 'badge-success',
    FAILED: 'badge-error',
  }
  return map[status] || 'bg-surface-card text-text-secondary border border-border-glass px-2.5 py-1 rounded-full text-xs font-semibold'
}
</script>
