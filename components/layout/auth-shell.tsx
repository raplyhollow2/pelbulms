'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ResponsiveLayout } from '@/components/layout/responsive-layout'
import { createClient } from '@/lib/supabase/client'

interface AuthShellProps {
  children: React.ReactNode
  loadingLabel?: string
}

/**
 * Shared authenticated shell: session gate + responsive sidebar/bottom nav.
 */
export function AuthShell({
  children,
  loadingLabel = 'Loading...',
}: AuthShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [maintenance, setMaintenance] = useState<{ siteName: string } | null>(null)

  useEffect(() => {
    let mounted = true

    const checkUser = async () => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push('/auth/login')
          return
        }

        const [{ data: settings }, { data: profile }] = await Promise.all([
          supabase
            .from('platform_settings' as any)
            .select('maintenance_mode, site_name')
            .eq('id', 'default')
            .maybeSingle(),
          supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle(),
        ])

        const role = (profile as { role?: string } | null)?.role
        const staff = role === 'admin' || role === 'superadmin'
        if ((settings as any)?.maintenance_mode && !staff) {
          if (mounted) {
            setMaintenance({ siteName: (settings as any)?.site_name || 'Pelbu LMS' })
            setUser(session.user)
          }
          return
        }

        if (mounted) setUser(session.user)
      } catch (error) {
        console.error('Error checking user:', error)
        router.push('/auth/login')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    checkUser()
    return () => {
      mounted = false
    }
  }, [router, pathname])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white dark:from-gray-900 dark:to-black flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-bhutan-yellow" />
          <p className="text-sm text-muted-foreground">{loadingLabel}</p>
        </div>
      </div>
    )
  }

  if (maintenance) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-bhutan-orange">
            {maintenance.siteName}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">We’ll be back shortly</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The learning platform is in maintenance mode. Please try again later.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveLayout user={user}>
      {children}
    </ResponsiveLayout>
  )
}
