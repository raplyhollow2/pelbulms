export { cn } from "cn"

const hapticUtils = {
  success: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50)
    }
  },
  warning: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 100])
    }
  },
  error: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200])
    }
  },
  light: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(25)
    }
  },
  medium: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50)
    }
  },
  heavy: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(75)
    }
  },
  tap: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(30)
    }
  },
}

export const hapticMethods = hapticUtils
export const { success, warning, error, light, medium, heavy, tap } = hapticUtils
export const haptic = hapticUtils.tap

/** One product name. "Rigbu" and "Rigbu LMS" are the same label. */
export function productLabel(name?: string | null) {
  const trimmed = name?.trim() || ''
  if (!trimmed || /^rigbu(\s+lms)?$/i.test(trimmed)) return 'Rigbu'
  return trimmed
}
