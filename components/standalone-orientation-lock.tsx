'use client'

import { useEffect } from 'react'
import { lockPortraitIfStandalone } from '@/lib/landscape-fullscreen'

/** Keeps an installed app in portrait until a lesson video asks for landscape. */
export function StandaloneOrientationLock() {
  useEffect(() => {
    void lockPortraitIfStandalone()
  }, [])

  return null
}
