'use client'

import { useEffect } from 'react'
import { isHandheldDevice, lockAppPortrait } from '@/lib/landscape-fullscreen'

/** Phones and tablets stay portrait. Desktop orientation is unchanged. */
export function StandaloneOrientationLock() {
  useEffect(() => {
    if (!isHandheldDevice()) return

    const lock = () => {
      void lockAppPortrait()
    }
    lock()
    window.addEventListener('orientationchange', lock)
    screen.orientation?.addEventListener?.('change', lock)
    return () => {
      window.removeEventListener('orientationchange', lock)
      screen.orientation?.removeEventListener?.('change', lock)
    }
  }, [])

  return null
}
