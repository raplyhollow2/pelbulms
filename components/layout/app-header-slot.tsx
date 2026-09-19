'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const APP_HEADER_PORTAL_ID = 'app-header-portal'

/**
 * Renders children into the sticky top app bar (desktop), beside notifications.
 * On phones the portal target is hidden — also render a mobile fallback in-page.
 */
export function AppHeaderPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(document.getElementById(APP_HEADER_PORTAL_ID))
  }, [])

  if (!target) return null
  return createPortal(children, target)
}
