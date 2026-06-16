<template>
  <div class="fixed top-4 right-4 z-[100] space-y-2">
    <div
      v-for="t in toasts"
      :key="t.id"
      :class="[
        'px-5 py-3.5 rounded-2xl text-sm font-medium shadow-2xl transition-all duration-500 max-w-sm animate-scale-in flex items-center gap-3',
        t.type === 'success' ? 'glass-card' : t.type === 'error' ? 'glass-card' : 'glass-card'
      ]"
      :style="{
        borderColor: t.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : t.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 240, 255, 0.3)',
        boxShadow: t.type === 'success' ? '0 8px 32px rgba(34, 197, 94, 0.15)' : t.type === 'error' ? '0 8px 32px rgba(239, 68, 68, 0.15)' : '0 8px 32px rgba(0, 240, 255, 0.15)'
      }"
    >
      <div
        :class="[
          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
          t.type === 'success' ? 'bg-green-500/15 text-green-400' : t.type === 'error' ? 'bg-red-500/15 text-red-400' : 'bg-neon-cyan/15 text-neon-cyan'
        ]"
      >
        <svg v-if="t.type === 'success'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        <svg v-else-if="t.type === 'error'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      </div>
      <span :class="t.type === 'success' ? 'text-green-300' : t.type === 'error' ? 'text-red-300' : 'text-neon-cyan'">{{ t.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { toast as toastManager } from '../utils/toast'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

const toasts = ref<Toast[]>([])

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = toastManager.subscribe((newToasts) => {
    toasts.value = newToasts
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})
</script>
