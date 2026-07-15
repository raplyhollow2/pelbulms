import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Haptic feedback utilities for mobile devices
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
  }
}

// Export haptic methods for advanced usage
export const hapticMethods = hapticUtils

// Export individual methods for convenience
export const { success, warning, error, light, medium, heavy, tap } = hapticUtils

// Default haptic function (uses tap method) - exported as tap for clarity
export const haptic = hapticUtils.tap
