<template>
  <div class="animate-fade-in-up">
    <div class="flex items-center gap-4 mb-6">
      <router-link to="/products" class="inline-flex items-center gap-1.5 text-text-muted hover:text-neon-cyan transition-all text-sm font-medium">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back
      </router-link>
      <h1 class="text-2xl font-black text-text-primary tracking-tight">{{ isEdit ? 'Edit Product' : 'Add Product' }}</h1>
    </div>

    <div class="glass-card p-8 rounded-2xl max-w-2xl">
      <form @submit.prevent="handleSubmit" class="space-y-6">
        <div class="grid grid-cols-2 gap-5">
          <div class="col-span-2">
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Product Name</label>
            <input v-model="form.name" required class="input-glass" placeholder="Enter product name" />
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Category</label>
            <select v-model="form.category" required class="select-glass">
              <option value="">Select...</option>
              <option value="CURRENCY">Game Currency</option>
              <option value="GAME">Game</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Game Type</label>
            <select v-model="form.gameType" class="select-glass">
              <option value="">Select...</option>
              <option value="PUBG">PUBG</option>
              <option value="FREE_FIRE">Free Fire</option>
              <option value="GTA">GTA</option>
              <option value="MLBB">MLBB</option>
              <option value="VALORANT">Valorant</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Price (BDT)</label>
            <input v-model.number="form.price" type="number" min="0" required class="input-glass" placeholder="0" />
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Original Price</label>
            <input v-model.number="form.originalPrice" type="number" min="0" class="input-glass" placeholder="Optional" />
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
            <textarea v-model="form.description" rows="4" class="input-glass resize-none" placeholder="Product description..."></textarea>
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Thumbnail URL</label>
            <input v-model="form.thumbnailUrl" class="input-glass" placeholder="https://example.com/image.jpg" />
          </div>
          <div class="col-span-2 flex gap-6">
            <label class="flex items-center gap-2 cursor-pointer group">
              <input v-model="form.isFeatured" type="checkbox" class="w-4 h-4 rounded border-border-glass bg-surface-card text-neon-cyan focus:ring-neon-cyan/30" />
              <span class="text-sm text-text-secondary group-hover:text-text-primary transition-colors">Featured Product</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer group">
              <input v-model="form.isAvailable" type="checkbox" class="w-4 h-4 rounded border-border-glass bg-surface-card text-neon-cyan focus:ring-neon-cyan/30" />
              <span class="text-sm text-text-secondary group-hover:text-text-primary transition-colors">Available</span>
            </label>
          </div>
        </div>

        <div class="flex gap-3 pt-2 border-t border-border-glass">
          <button type="submit" :disabled="submitting" class="px-6 py-2.5 btn-neon rounded-xl text-sm disabled:opacity-50">
            {{ submitting ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product' }}
          </button>
          <router-link to="/products" class="px-6 py-2.5 btn-glass rounded-xl text-sm">Cancel</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { productsAPI } from '../services/api'
import toast from '../utils/toast'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)
const submitting = ref(false)

const form = ref({
  name: '',
  category: '',
  gameType: '',
  price: 0,
  originalPrice: 0,
  description: '',
  thumbnailUrl: '',
  isFeatured: false,
  isAvailable: true,
})

onMounted(async () => {
  if (isEdit.value) {
    try {
      const res = await productsAPI.getById(route.params.id as string)
      const p = res.data.data
      Object.assign(form.value, {
        name: p.name,
        category: p.category,
        gameType: p.gameType || '',
        price: Number(p.price),
        originalPrice: p.originalPrice ? Number(p.originalPrice) : 0,
        description: p.description || '',
        thumbnailUrl: p.thumbnailUrl || '',
        isFeatured: p.isFeatured,
        isAvailable: p.isAvailable,
      })
    } catch { toast.error('Failed to load product') }
  }
})

async function handleSubmit() {
  submitting.value = true
  try {
    const payload = { ...form.value }
    if (!payload.originalPrice) delete payload.originalPrice
    if (!payload.gameType) delete payload.gameType

    if (isEdit.value) {
      await productsAPI.update(route.params.id as string, payload)
      toast.success('Product updated!')
    } else {
      await productsAPI.create(payload)
      toast.success('Product created!')
    }
    router.push('/products')
  } catch { toast.error('Failed to save product') }
  finally { submitting.value = false }
}
</script>
