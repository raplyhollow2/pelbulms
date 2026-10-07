'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { BrandLogo } from '@/components/brand/brand-logo'
import { ResponsiveLayout } from '@/components/layout/responsive-layout'
import { PresenceTracker } from '@/components/presence/presence-tracker'
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
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<{
    role?: string | null
    full_name?: string | null
    avatar_url?: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [siteName, setSiteName] = useState('Rigbu LMS')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [maintenance, setMaintenance] = useState<{ siteName: string } | null>(null)

  useEffect(() => {
    const onIdentity = (event: Event) => {
      const detail = (event as CustomEvent<{ siteName?: string; logoUrl?: string | null }>).detail
      if (typeof detail?.siteName === 'string' && detail.siteName.trim()) setSiteName(detail.siteName.trim())
      if (detail && 'logoUrl' in detail) {
        setLogoUrl(typeof detail.logoUrl === 'string' && detail.logoUrl.trim() ? detail.logoUrl.trim() : null)
      }
    }
    window.addEventListener('rigbu:platform-identity', onIdentity)
    return () => window.removeEventListener('rigbu:platform-identity', onIdentity)
  }, [])

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
            .select('maintenance_mode, site_name, logo_url')
            .eq('id', 'default')
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('role, full_name, avatar_url')
            .eq('id', session.user.id)
            .maybeSingle(),
        ])

        const resolvedName =
          typeof (settings as any)?.site_name === 'string' && (settings as any).site_name.trim()
            ? (settings as any).site_name.trim()
            : 'Rigbu LMS'
        const resolvedLogo =
          typeof (settings as any)?.logo_url === 'string' && (settings as any).logo_url.trim()
            ? (settings as any).logo_url.trim()
            : null
        const role = (profile as { role?: string } | null)?.role
        const staff = role === 'admin' || role === 'superadmin'
        if ((settings as any)?.maintenance_mode && !staff) {
          if (mounted) {
            setSiteName(resolvedName)
            setLogoUrl(resolvedLogo)
            setMaintenance({ siteName: resolvedName })
            setUser(session.user)
          }
          return
        }

        if (mounted) {
          setSiteName(resolvedName)
          setLogoUrl(resolvedLogo)
          setUser(session.user)
          setProfile((profile as { role?: string | null; full_name?: string | null; avatar_url?: string | null } | null) || null)
        }
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
    // Once per session. Middleware still gates every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white dark:from-gray-900 dark:to-black flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">{loadingLabel}</p>
        </div>
      </div>
    )
  }

  if (maintenance) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo src={logoUrl} height={32} markBelow400 />
          </div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
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
    <ResponsiveLayout user={user} siteName={siteName} logoUrl={logoUrl} profile={profile}>
      <PresenceTracker />
      {children}
    </ResponsiveLayout>
  )
}
