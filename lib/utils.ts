import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Haptic Feedback Utility
 * Provides tactile feedback for user interactions on supported devices
 */
export const haptic = {
  /**
   * Light tap feedback (button clicks, light interactions)
   */
  tap: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }
  },

  /**
   * Medium feedback (success confirmations)
   */
  success: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([15, 50, 15])
    }
  },

  /**
   * Heavy feedback (errors, warnings, important actions)
   */
  warning: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([20, 30, 20, 30, 20])
    }
  },

  /**
   * Long feedback (achievements, milestones)
   */
  achievement: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 40, 30, 40, 60])
    }
  },
}

/**
 * Format utilities for consistent data display
 */
export const format = {
  /**
   * Format date with relative time (e.g., "2 hours ago")
   */
  date: (date: string | Date): string => {
    const now = new Date()
    const past = new Date(date)
    const seconds = Math.floor((now.getTime() - past.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return past.toLocaleDateString()
  },

  /**
   * Format duration in seconds to human-readable time
   */
  duration: (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  },

  /**
   * Format file size in bytes to human-readable format
   */
  fileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  },
}

/**
 * Validation utilities
 */
export const validation = {
  /**
   * Validate email format
   */
  email: (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  },

  /**
   * Validate phone number (Bhutan format)
   */
  phone: (phone: string): boolean => {
    return /^(\+975)?[17]\d{8}$/.test(phone.replace(/\s/g, ''))
  },

  /**
   * Validate strong password
   */
  password: (password: string): boolean => {
    return password.length >= 8
  },
}

/**
 * Performance utilities
 */
export const performance = {
  /**
   * Debounce function execution
   */
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | null = null
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  },

  /**
   * Throttle function execution
   */
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => (inThrottle = false), limit)
      }
    }
  },
}

/**
 * Color utilities for design system
 */
export const color = {
  /**
   * Check if color is light or dark
   */
  isLight: (hexColor: string): boolean => {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 128
  },
}
