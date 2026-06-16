<template>
  <div class="animate-fade-in-up">
    <h1 class="text-2xl font-black text-text-primary tracking-tight mb-6">Payment Management</h1>

    <!-- Payment Gateways -->
    <div class="glass-card p-6 rounded-xl mb-6">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-lg font-bold text-text-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-neon-cyan">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
          Payment Gateways
        </h2>
        <button @click="showGatewayForm = true" class="px-4 py-2 btn-neon rounded-xl text-sm inline-flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Gateway
        </button>
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="skeleton h-16 rounded-xl"></div>
      </div>

      <div v-else class="space-y-3">
        <div v-for="gateway in gateways" :key="gateway.id" class="flex items-center justify-between p-4 rounded-xl bg-surface-card hover:bg-surface-hover border border-border-glass transition-all group">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-neon-cyan/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-neon-cyan">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <div>
              <p class="font-semibold text-text-primary text-sm">{{ gateway.gatewayName }}</p>
              <p class="text-xs text-text-muted">{{ gateway.accountIdentifier || 'No account set' }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span :class="gateway.isEnabled ? 'badge-success' : 'badge-error'" class="px-2.5 py-1 rounded-full text-xs font-semibold">
              {{ gateway.isEnabled ? 'Active' : 'Inactive' }}
            </span>
            <button @click="toggleGateway(gateway.id)" :class="gateway.isEnabled ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-border-glass">
              {{ gateway.isEnabled ? 'Disable' : 'Enable' }}
            </button>
          </div>
        </div>
        <div v-if="gateways.length === 0" class="text-center text-text-muted py-8">
          <div class="text-4xl mb-2">💳</div>
          <p>No payment gateways configured</p>
        </div>
      </div>
    </div>

    <!-- Add Gateway Modal -->
    <div v-if="showGatewayForm" class="modal-overlay flex items-center justify-center" @click.self="showGatewayForm = false">
      <div class="modal-glass p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-neon-cyan">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Payment Gateway
        </h3>
        <form @submit.prevent="handleAddGateway" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Gateway Name</label>
            <input v-model="gatewayForm.gatewayName" required class="input-glass" placeholder="e.g. BKASH" />
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Account Number</label>
            <input v-model="gatewayForm.accountIdentifier" class="input-glass" placeholder="017XXXXXXXX" />
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Account Holder Name</label>
            <input v-model="gatewayForm.accountHolderName" class="input-glass" />
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Instructions</label>
            <textarea v-model="gatewayForm.instructions" rows="3" class="input-glass resize-none" placeholder="Instructions for customers..."></textarea>
          </div>
          <div class="flex gap-3 justify-end pt-2 border-t border-border-glass">
            <button type="button" @click="showGatewayForm = false" class="px-4 py-2 btn-glass rounded-xl text-sm">Cancel</button>
            <button type="submit" class="px-4 py-2 btn-neon rounded-xl text-sm">Save</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { paymentGatewayAPI } from '../services/api'
import toast from '../utils/toast'

const gateways = ref<any[]>([])
const loading = ref(true)
const showGatewayForm = ref(false)
const gatewayForm = ref({ gatewayName: '', accountIdentifier: '', accountHolderName: '', instructions: '' })

onMounted(loadGateways)

async function loadGateways() {
  try {
    const res = await paymentGatewayAPI.list()
    gateways.value = res.data.data
  } catch { console.error('Failed to load gateways') }
  finally { loading.value = false }
}

async function handleAddGateway() {
  try {
    await paymentGatewayAPI.create(gatewayForm.value)
    toast.success('Gateway added!')
    showGatewayForm.value = false
    gatewayForm.value = { gatewayName: '', accountIdentifier: '', accountHolderName: '', instructions: '' }
    loadGateways()
  } catch { toast.error('Failed to add gateway') }
}

async function toggleGateway(id: string) {
  const gateway = gateways.value.find(g => g.id === id)
  if (!gateway) return
  try {
    await paymentGatewayAPI.update(id, { isEnabled: !gateway.isEnabled })
    toast.success('Toggled!')
    loadGateways()
  } catch { toast.error('Failed to toggle') }
}
</script>
