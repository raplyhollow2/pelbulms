'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PermissionsMatrix } from '@/components/admin/permissions-matrix'

/**
 * Superadmin-only permissions matrix (QloApps-style).
 */
export default function AdminPermissionsPage() {
  const router = useRouter()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const role =
        (profile as { role?: string } | null)?.role ||
        (user.app_metadata?.role as string | undefined)
      if (role !== 'superadmin') {
        router.push('/admin/settings')
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
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking access…
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 md:pb-10">
      <header className="space-y-1 border-b border-border/50 pb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Administration
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Permissions</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Configure menu, module, and institution access for system and custom roles.
        </p>
      </header>
      <PermissionsMatrix />
    </div>
  )
}
