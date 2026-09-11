'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { canAccessAdmin } from '@/lib/roles'

/**
 * Gate for /admin/settings. Platform admin and superadmin may enter.
 * Matches sidebar role resolution (profile or JWT app_metadata).
 */
export function SuperadminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const profileRole = (profile as { role?: string } | null)?.role
      const metaRole = user.app_metadata?.role as string | undefined
      if (!canAccessAdmin(profileRole) && !canAccessAdmin(metaRole)) {
        router.push('/dashboard')
        return
      }
      if (mounted) setOk(true)
    })()
    return () => {
      mounted = false
    }
  }, [router])

  if (!ok) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking access…
      </div>
    )
  }

  return <>{children}</>
}
