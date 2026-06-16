<template>
  <div class="animate-fade-in-up">
    <h1 class="text-2xl font-black text-text-primary tracking-tight mb-6">Settings</h1>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6 p-1.5 glass rounded-2xl w-fit">
      <button v-for="tab in tabs" :key="tab" @click="activeTab = tab" :class="['px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ease-spring', activeTab === tab ? 'btn-neon' : 'text-text-muted hover:text-text-primary']">
        {{ tab }}
      </button>
    </div>

    <!-- Promotions Tab -->
    <div v-if="activeTab === 'Promotions'" class="glass-card p-6 rounded-xl">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-lg font-bold text-text-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-neon-amber">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
          Promotion Codes
        </h2>
        <button @click="showPromoForm = true" class="px-4 py-2 btn-neon rounded-xl text-sm inline-flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Promo
        </button>
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="skeleton h-14 rounded-xl"></div>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table-glass">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Valid Until</th>
              <th>Used</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="promo in promotions" :key="promo.id">
              <td><span class="font-mono font-bold text-neon-cyan bg-neon-cyan/5 px-2 py-1 rounded-lg text-xs">{{ promo.code }}</span></td>
              <td class="text-text-primary font-semibold">{{ promo.discountType === 'PERCENTAGE' ? promo.discountValue + '%' : 'BDT ' + Number(promo.discountValue).toLocaleString() }}</td>
              <td class="text-xs text-text-muted">{{ new Date(promo.validUntil).toLocaleDateString() }}</td>
              <td class="text-text-secondary">{{ promo.usedCount }}{{ promo.maxUsage ? ' / ' + promo.maxUsage : '' }}</td>
              <td>
                <span :class="promo.isActive ? 'badge-success' : 'badge-error'" class="px-2.5 py-1 rounded-full text-xs font-semibold">
                  {{ promo.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>
                <button @click="togglePromo(promo.id)" :class="promo.isActive ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-border-glass">
                  {{ promo.isActive ? 'Deactivate' : 'Activate' }}
                </button>
              </td>
            </tr>
            <tr v-if="promotions.length === 0">
              <td colspan="6" class="text-center text-text-muted py-12">
                <div class="text-4xl mb-2">🎫</div>
                <p>No promotions yet</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Users Tab -->
    <div v-if="activeTab === 'Users'" class="glass-card p-6 rounded-xl">
      <h2 class="text-lg font-bold text-text-primary mb-5 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-neon-violet">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        User Management
      </h2>

      <div v-if="loadingUsers" class="space-y-3">
        <div v-for="i in 5" :key="i" class="skeleton h-14 rounded-xl"></div>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table-glass">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Orders</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td class="font-medium text-text-primary">{{ user.fullName }}</td>
              <td class="text-sm text-text-muted">{{ user.email }}</td>
              <td class="text-sm text-text-muted">{{ user.phone || '—' }}</td>
              <td><span class="badge-violet px-2.5 py-1 rounded-full text-xs font-semibold">{{ user.role }}</span></td>
              <td class="text-text-secondary">{{ user._count?.orders || 0 }}</td>
              <td>
                <span :class="user.isActive ? 'badge-success' : 'badge-error'" class="px-2.5 py-1 rounded-full text-xs font-semibold">
                  {{ user.isActive ? 'Active' : 'Disabled' }}
                </span>
              </td>
              <td>
                <button @click="toggleUserStatus(user.id)" :class="user.isActive ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-border-glass">
                  {{ user.isActive ? 'Disable' : 'Enable' }}
                </button>
              </td>
            </tr>
            <tr v-if="users.length === 0">
              <td colspan="7" class="text-center text-text-muted py-12">
                <div class="text-4xl mb-2">👥</div>
                <p>No users found</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Promo Modal -->
    <div v-if="showPromoForm" class="modal-overlay flex items-center justify-center" @click.self="showPromoForm = false">
      <div class="modal-glass p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-neon-amber">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
          Create Promotion
        </h3>
        <form @submit.prevent="handleCreatePromo" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Code</label>
            <input v-model="promoForm.code" required class="input-glass uppercase" placeholder="SAVE10" maxlength="20" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">Type</label>
              <select v-model="promoForm.discountType" class="select-glass">
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed Amount</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">Value</label>
              <input v-model.number="promoForm.discountValue" type="number" min="1" required class="input-glass" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">Valid From</label>
              <input v-model="promoForm.validFrom" type="date" required class="input-glass" />
            </div>
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">Valid Until</label>
              <input v-model="promoForm.validUntil" type="date" required class="input-glass" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">Max Uses</label>
              <input v-model.number="promoForm.maxUsage" type="number" min="1" class="input-glass" placeholder="Unlimited" />
            </div>
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">Min Purchase (BDT)</label>
              <input v-model.number="promoForm.minPurchaseAmount" type="number" min="0" class="input-glass" />
            </div>
          </div>
          <div class="flex gap-3 justify-end pt-2 border-t border-border-glass">
            <button type="button" @click="showPromoForm = false" class="px-4 py-2 btn-glass rounded-xl text-sm">Cancel</button>
            <button type="submit" class="px-4 py-2 btn-neon rounded-xl text-sm">Create</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { promotionsAPI, usersAPI } from '../services/api'
import toast from '../utils/toast'

const tabs = ['Promotions', 'Users']
const activeTab = ref('Promotions')

// Promotions
const promotions = ref<any[]>([])
const loading = ref(true)
const showPromoForm = ref(false)
const promoForm = ref({
  code: '',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  maxUsage: undefined as number | undefined,
  minPurchaseAmount: undefined as number | undefined,
})

// Users
const users = ref<any[]>([])
const loadingUsers = ref(true)

onMounted(() => {
  loadPromotions()
  loadUsers()
})

async function loadPromotions() {
  try {
    const res = await promotionsAPI.list()
    promotions.value = res.data.data.promotions
  } catch { console.error('Failed to load promotions') }
  finally { loading.value = false }
}

async function handleCreatePromo() {
  try {
    await promotionsAPI.create(promoForm.value)
    toast.success('Promotion created!')
    showPromoForm.value = false
    promoForm.value.code = ''
    loadPromotions()
  } catch { toast.error('Failed to create promotion') }
}

async function togglePromo(id: string) {
  try {
    await promotionsAPI.toggle(id)
    toast.success('Toggled!')
    loadPromotions()
  } catch { toast.error('Failed to toggle') }
}

async function loadUsers() {
  try {
    const res = await usersAPI.list()
    users.value = res.data.data.users
  } catch { console.error('Failed to load users') }
  finally { loadingUsers.value = false }
}

async function toggleUserStatus(id: string) {
  try {
    await usersAPI.toggleStatus(id)
    toast.success('User status updated!')
    loadUsers()
  } catch { toast.error('Failed to update user') }
}
</script>
