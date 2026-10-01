'use client'

import { useLayoutEffect, useRef } from 'react'
import { syncBrowserPortraitShell } from '@/lib/landscape-fullscreen'

/** Layout wrapper. Turning the phone does not rotate the page. */
export function PortraitShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (ref.current) syncBrowserPortraitShell(ref.current)
  }, [])

  return (
    <div ref={ref} className="portrait-shell flex min-h-full w-full flex-1 flex-col">
      {children}
    </div>
  )
}
