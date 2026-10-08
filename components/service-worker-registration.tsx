'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'rigbu-pwa-install-dismissed'
const OFFSET_VAR = '--install-bar-offset'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // Private mode can block storage. The bar still hides for this visit.
  }
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function ServiceWorkerRegistration() {
  const barRef = useRef<HTMLDivElement>(null)
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service Worker registration failed:', error)
      })
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      if (wasDismissed()) return
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  useLayoutEffect(() => {
    const bar = barRef.current
    if (!promptEvent || !bar) {
      document.documentElement.style.removeProperty(OFFSET_VAR)
      return
    }

    const apply = () => {
      document.documentElement.style.setProperty(OFFSET_VAR, `${bar.offsetHeight}px`)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(bar)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty(OFFSET_VAR)
    }
  }, [promptEvent])

  const dismiss = () => {
    rememberDismiss()
    setPromptEvent(null)
  }

  const install = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') rememberDismiss()
    setPromptEvent(null)
  }

  if (!promptEvent) return null

  return (
    <div
      ref={barRef}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] text-card-foreground md:inset-x-auto md:bottom-4 md:left-4 md:max-w-sm md:rounded-xl md:border md:pb-0 md:shadow-sm"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm text-card-foreground">Install Rigbu for offline access</p>
        <Button type="button" size="sm" onClick={install}>
          Install
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={dismiss} aria-label="Dismiss install prompt">
          <X />
        </Button>
      </div>
    </div>
  )
}
