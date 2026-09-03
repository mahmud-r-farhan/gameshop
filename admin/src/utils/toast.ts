type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

const listeners: Array<(toasts: Toast[]) => void> = []
let toasts: Toast[] = []
let nextId = 0

function notify() {
  listeners.forEach((fn) => fn([...toasts]))
}

export const toast = {
  success(message: string) {
    toasts = [...toasts, { id: nextId++, message, type: 'success' }]
    notify()
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== nextId - 1)
      notify()
    }, 3000)
  },
  error(message: string) {
    toasts = [...toasts, { id: nextId++, message, type: 'error' }]
    notify()
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== nextId - 1)
      notify()
    }, 4000)
  },
  info(message: string) {
    toasts = [...toasts, { id: nextId++, message, type: 'info' }]
    notify()
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== nextId - 1)
      notify()
    }, 3000)
  },
  subscribe(fn: (toasts: Toast[]) => void) {
    listeners.push(fn)
    fn([...toasts])
    return () => {
      const idx = listeners.indexOf(fn)
      if (idx > -1) listeners.splice(idx, 1)
    }
  },
}

export default toast
