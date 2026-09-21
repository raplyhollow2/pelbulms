'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  PRESENCE_HEARTBEAT_HIDDEN_MS,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_IDLE_MS,
  beaconPresenceLeave,
  sendPresenceHeartbeat,
  sendPresenceLeave,
} from '@/lib/presence'

/**
 * Heartbeats while signed in. Background tabs stay connected (idle badge).
 * Logout and tab close mark offline; missed heartbeats time out of Active Now.
 */
export function PresenceTracker() {
  const pathname = usePathname()
  const lastInteractionRef = useRef(Date.now())
  const pathRef = useRef(pathname || '/')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    pathRef.current = pathname || '/'
  }, [pathname])

  useEffect(() => {
    const supabase = createClient()
    let stopped = false

    const markInteraction = () => {
      lastInteractionRef.current = Date.now()
    }

    const beat = async (force = false) => {
      if (stopped || (typeof window !== 'undefined' && (window as any).__pelbuLeaving)) return
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session || stopped) return

      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
      const stale = Date.now() - lastInteractionRef.current >= PRESENCE_IDLE_MS
      const idle = hidden || stale
      try {
        await sendPresenceHeartbeat({
          supabase,
          status: idle ? 'idle' : 'online',
          path: pathRef.current,
          interactive: !idle,
          force,
        })
      } catch {
        /* non-fatal */
      }
    }

    const schedule = () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      const hidden = document.visibilityState === 'hidden'
      const ms = hidden ? PRESENCE_HEARTBEAT_HIDDEN_MS : PRESENCE_HEARTBEAT_MS
      timerRef.current = window.setInterval(() => void beat(false), ms)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastInteractionRef.current = Date.now()
        void beat(true)
      }
      schedule()
    }

    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return
      beaconPresenceLeave('unload')
    }

    const events: (keyof WindowEventMap)[] = [
      'pointerdown',
      'keydown',
      'scroll',
      'touchstart',
    ]
    events.forEach((event) => window.addEventListener(event, markInteraction, { passive: true }))
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)

    void beat(true)
    schedule()

    return () => {
      stopped = true
      if (timerRef.current) window.clearInterval(timerRef.current)
      events.forEach((event) => window.removeEventListener(event, markInteraction))
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    void sendPresenceHeartbeat({
      supabase,
      status: hidden ? 'idle' : 'online',
      path: pathname || '/',
      interactive: !hidden,
    }).catch(() => {})
  }, [pathname])

  return null
}

export async function leavePresenceAndSignOut() {
  if (typeof window !== 'undefined') {
    ;(window as any).__pelbuLeaving = true
  }
  const supabase = createClient()
  try {
    await sendPresenceLeave(supabase, 'logout')
  } catch {
    beaconPresenceLeave('logout')
  }
  await supabase.auth.signOut()
}
