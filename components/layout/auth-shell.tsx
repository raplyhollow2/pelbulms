'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrandCharacter, RigbuLoader } from '@/components/brand/brand-character'
import { ResponsiveLayout } from '@/components/layout/responsive-layout'
import { PresenceTracker } from '@/components/presence/presence-tracker'
import { createClient } from '@/lib/supabase/client'

interface AuthShellProps {
  children: React.ReactNode
  loadingLabel?: string
  /** Instructors, staff, and anyone with a teach menu capability. */
  requireTeach?: boolean
}

/**
 * Shared authenticated shell: session gate + responsive sidebar/bottom nav.
 */
async function canOpenTeach(role: string | undefined) {
  let allowed =
    role === 'instructor' ||
    role === 'admin' ||
    role === 'resource_person' ||
    role === 'superadmin'

  try {
    const capRes = await fetch('/api/admin/capabilities/me')
    if (capRes.ok) {
      const capJson = await capRes.json()
      const list: string[] = capJson.capabilities || []
      const hasTeach =
        list.includes('*') || list.some((key: string) => key.startsWith('menu.teach.'))
      const authoritative = capJson.catalogResolved === true || list.length > 0
      if (hasTeach) allowed = true
      else if (authoritative) allowed = false
    }
  } catch {
    // Keep the role check when capabilities cannot be loaded.
  }

  return allowed
}

export function AuthShell({
  children,
  loadingLabel = 'Loading...',
  requireTeach = false,
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
      let holdLoader = false
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          holdLoader = true
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
        if (requireTeach && !(await canOpenTeach(role))) {
          holdLoader = true
          router.push('/dashboard')
          return
        }
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
        holdLoader = true
        router.push('/auth/login')
      } finally {
        if (mounted && !holdLoader) setLoading(false)
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
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <RigbuLoader size={80} />
          <p className="text-sm text-muted-foreground">{loadingLabel}</p>
        </div>
      </div>
    )
  }

  if (maintenance) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <BrandCharacter pose="sleepy" alt="Rigbu resting" className="mx-auto mb-4" />
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
