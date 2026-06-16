<template>
  <div class="animate-fade-in-up">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-black text-text-primary tracking-tight">Products</h1>
      <router-link to="/products/new" class="px-5 py-2.5 btn-neon rounded-xl text-sm inline-flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Product
      </router-link>
    </div>

    <div v-if="loading" class="glass-card p-6 rounded-xl">
      <div v-for="i in 5" :key="i" class="flex items-center gap-4 mb-4">
        <div class="w-12 h-12 skeleton rounded-xl"></div>
        <div class="flex-1"><div class="skeleton h-4 w-3/4 mb-1"></div><div class="skeleton h-3 w-1/2"></div></div>
      </div>
    </div>

    <div v-else class="glass-card rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table-glass">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th>Featured</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in products" :key="product.id" class="animate-fade-in-up" :style="{ animationDelay: `${products.indexOf(product) * 40}ms` }">
              <td>
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-violet/20 flex items-center justify-center text-neon-cyan text-xs font-bold border border-border-glass">
                    {{ product.name?.charAt(0) }}
                  </div>
                  <div>
                    <p class="font-semibold text-text-primary text-sm">{{ product.name }}</p>
                    <p class="text-xs text-text-muted">{{ product.gameType || '—' }}</p>
                  </div>
                </div>
              </td>
              <td>
                <span :class="product.category === 'CURRENCY' ? 'badge-warning' : 'badge-violet'" class="px-2.5 py-1 rounded-full text-xs font-semibold">
                  {{ product.category }}
                </span>
              </td>
              <td class="font-semibold text-text-primary">BDT {{ Number(product.price).toLocaleString() }}</td>
              <td>
                <span :class="product.isAvailable ? 'badge-success' : 'badge-error'" class="px-2.5 py-1 rounded-full text-xs font-semibold">
                  {{ product.isAvailable ? 'Available' : 'Unavailable' }}
                </span>
              </td>
              <td>
                <button @click="toggleFeatured(product.id)" class="text-lg cursor-pointer transition-transform hover:scale-110">
                  {{ product.isFeatured ? '⭐' : '☆' }}
                </button>
              </td>
              <td>
                <div class="flex items-center gap-2">
                  <router-link :to="`/products/${product.id}/edit`" class="px-3 py-1.5 btn-glass rounded-lg text-xs font-medium">Edit</router-link>
                  <button @click="confirmDelete(product)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all">Delete</button>
                </div>
              </td>
            </tr>
            <tr v-if="products.length === 0">
              <td colspan="6" class="text-center text-text-muted py-12">
                <div class="text-4xl mb-3">📦</div>
                <p class="font-medium">No products found</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="deleteTarget" class="modal-overlay flex items-center justify-center" @click.self="deleteTarget = null">
      <div class="modal-glass p-6 max-w-sm mx-4 w-full">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#EF4444" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-bold text-text-primary">Delete Product</h3>
            <p class="text-sm text-text-muted">This cannot be undone</p>
          </div>
        </div>
        <p class="text-text-secondary text-sm mb-6">Are you sure you want to delete <span class="font-semibold text-text-primary">"{{ deleteTarget.name }}"</span>?</p>
        <div class="flex gap-3 justify-end">
          <button @click="deleteTarget = null" class="px-4 py-2 btn-glass rounded-xl text-sm">Cancel</button>
          <button @click="handleDelete" class="px-4 py-2 rounded-xl text-sm font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { productsAPI } from '../services/api'
import toast from '../utils/toast'

const products = ref<any[]>([])
const loading = ref(true)
const deleteTarget = ref<any>(null)

onMounted(loadProducts)

async function loadProducts() {
  try {
    const res = await productsAPI.list({ limit: 100 })
    products.value = res.data.data.products
  } catch { toast.error('Failed to load products') }
  finally { loading.value = false }
}

async function toggleFeatured(id: string) {
  try {
    await productsAPI.toggleFeatured(id)
    toast.success('Updated!')
    loadProducts()
  } catch { toast.error('Failed to update') }
}

function confirmDelete(product: any) {
  deleteTarget.value = product
}

async function handleDelete() {
  if (!deleteTarget.value) return
  try {
    await productsAPI.delete(deleteTarget.value.id)
    toast.success('Product deleted')
    deleteTarget.value = null
    loadProducts()
  } catch { toast.error('Failed to delete') }
}
</script>
