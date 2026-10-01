'use client'

import { useEffect, useRef } from 'react'
import { isHandheldDevice, syncBrowserPortraitShell } from '@/lib/landscape-fullscreen'

/**
 * Phones and tablets only. A mobile browser will not honor the installed-app
 * portrait lock, so when that browser turns landscape the shell turns the page
 * back. The lesson video is mounted on document.body and is not part of this shell.
 */
export function PortraitShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const shell = ref.current
    if (!shell) return

    const apply = () => {
      window.requestAnimationFrame(() => {
        if (!ref.current) return
        if (!isHandheldDevice()) {
          syncBrowserPortraitShell(ref.current)
          return
        }
        syncBrowserPortraitShell(ref.current)
      })
    }

    apply()
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    window.visualViewport?.addEventListener('resize', apply)
    window.visualViewport?.addEventListener('scroll', apply)
    screen.orientation?.addEventListener?.('change', apply)
    return () => {
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
      window.visualViewport?.removeEventListener('resize', apply)
      window.visualViewport?.removeEventListener('scroll', apply)
      screen.orientation?.removeEventListener?.('change', apply)
      if (ref.current) syncBrowserPortraitShell(ref.current)
    }
  }, [])

  return (
    <div ref={ref} className="portrait-shell flex min-h-full w-full flex-1 flex-col">
      {children}
    </div>
  )
}
