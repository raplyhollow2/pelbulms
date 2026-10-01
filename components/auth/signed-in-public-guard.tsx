'use client'

import { useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { publicHomeRedirectForSession } from '@/lib/auth-destination'
import { createClient } from '@/lib/supabase/client'

function metadataString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Sends a restored public page back into the LMS when a session is still
 * present. Back-forward cache can paint `/` or `/auth/login` without a
 * server request, so the server redirect never runs.
 */
export function SignedInPublicGuard({ allowPreview = false }: { allowPreview?: boolean }) {
  const router = useRouter()

  useLayoutEffect(() => {
    let cancelled = false

    const bounce = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user || cancelled) return

      const path = publicHomeRedirectForSession({
        accountStatus: metadataString(user.app_metadata?.account_status),
        role: metadataString(user.app_metadata?.role),
        preview: allowPreview,
      })
      if (!path || cancelled || window.location.pathname === path) return
      router.replace(path)
    }

    void bounce()

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void bounce()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => {
      cancelled = true
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [allowPreview, router])

  return null
}
