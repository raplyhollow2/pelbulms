'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RigbuIcon, type RigbuIconName } from '@/components/brand/RigbuIcon'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand/brand-logo'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { resolveMediaUrl } from '@/lib/media'
import { createClient } from '@/lib/supabase/client'
import { leavePresenceAndSignOut } from '@/components/presence/presence-tracker'
import { cn, haptic, warning as hapticWarning } from '@/lib/utils'
import { useCapabilities } from '@/components/auth/capabilities-provider'
import { buildAccessNav, hasMenuAccess, ROLE_PANELS } from '@/lib/nav-access'
import { coerceUserRole, ROLE_LABELS } from '@/lib/roles'

interface MobileNavigationProps {
  user?: any
  profile?: {
    role?: string | null
    full_name?: string | null
    avatar_url?: string | null
  } | null
  menuOpen?: boolean
  onMenuOpenChange?: (open: boolean) => void
}

const MOBILE_TABS: { name: string; href: string; icon: RigbuIconName }[] = [
  { name: 'Home', href: '/dashboard', icon: 'home' },
  { name: 'Explore', href: '/courses', icon: 'explore' },
  { name: 'My learning', href: '/learn/progress', icon: 'progress' },
  { name: 'Certificates', href: '/profile#certificates', icon: 'certificates' },
  { name: 'Profile', href: '/profile', icon: 'profile' },
]

/** Path plus hash, without the query string. Keeps `/profile#certificates` distinct from `/profile`. */
function hrefWithoutQuery(href: string) {
  const hashIndex = href.indexOf('#')
  const queryIndex = href.indexOf('?')
  const cuts = [hashIndex, queryIndex].filter((index) => index >= 0)
  const path = href.slice(0, cuts.length ? Math.min(...cuts) : href.length)
  if (hashIndex === -1) return path
  return path + href.slice(hashIndex).split('?')[0]
}

export function MobileNavigation({
  user,
  profile = null,
  menuOpen = false,
  onMenuOpenChange,
}: MobileNavigationProps) {
  const pathname = usePathname()
  const [hash, setHash] = useState('')
  const { loaded: capsLoaded, has: hasCapKey, role: capRole } = useCapabilities()
  const [userRole, setUserRole] = useState<
    'student' | 'instructor' | 'admin' | 'resource_person' | 'superadmin'
  >('student')

  const roleForNav = coerceUserRole(profile?.role || (capsLoaded ? capRole : userRole))
  const has = hasMenuAccess(roleForNav, hasCapKey)
  const panels = buildAccessNav(has)
  const accountLabel = ROLE_LABELS[roleForNav]
  const allowedHrefs = new Set(
    ROLE_PANELS.flatMap((panel) => panels[panel.id].map((item) => hrefWithoutQuery(item.href)))
  )
  const visibleTabs = MOBILE_TABS.filter((item) => {
    const key = hrefWithoutQuery(item.href)
    if (allowedHrefs.has(key)) return true
    return key === '/profile#certificates' && allowedHrefs.has('/profile')
  })
  const tabHrefs = new Set(visibleTabs.map((item) => hrefWithoutQuery(item.href)))

  const setMenuOpen = (open: boolean) => onMenuOpenChange?.(open)

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash)
    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [pathname])

  useEffect(() => {
    if (user) fetchUserRole()
  }, [user, profile])

  useEffect(() => {
    onMenuOpenChange?.(false)
    // Close the overflow sheet when the route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  const fetchUserRole = async () => {
    try {
      const supabase = createClient()
      let role = profile?.role
        ? coerceUserRole(profile.role)
        : coerceUserRole(user?.app_metadata?.role)
      if (!profile?.role) {
        const { data: row } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        role = coerceUserRole((row as any)?.role || user?.app_metadata?.role)
      }

      setUserRole(role)
    } catch (error) {
      console.error('Error fetching user role:', error)
    }
  }

  const handleLogout = async () => {
    hapticWarning()
    try {
      await leavePresenceAndSignOut()
      window.location.replace('/')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const isTabActive = (href: string) => {
    if (href === '/profile#certificates') {
      return pathname === '/profile' && hash === '#certificates'
    }
    if (href === '/profile') {
      return (pathname === '/profile' || pathname.startsWith('/profile/')) && hash !== '#certificates'
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <>
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50"
        aria-label="Mobile navigation"
      >
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 top-0 bg-background"
        />
        <div className="relative px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-4">
        <div className="pointer-events-auto mx-auto flex w-full max-w-lg items-stretch justify-around gap-0.5 rounded-2xl border border-border/50 bg-background p-1.5 shadow-lg sm:gap-1">
          {visibleTabs.map((item) => {
            const active = isTabActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => {
                  haptic()
                  if (item.href === '/profile') setHash('')
                  if (item.href === '/profile#certificates') setHash('#certificates')
                }}
                aria-current={active ? 'page' : undefined}
                className="press relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2"
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-xl bg-[rgba(245,184,46,0.16)]"
                  />
                )}
                <RigbuIcon name={item.icon} size={20} active={active} className="relative" />
                <span
                  className={cn(
                    'relative max-w-full text-center text-[10px] font-medium leading-tight',
                    active ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {item.name}
                </span>
              </Link>
            )
          })}
        </div>
        </div>
      </nav>

      {menuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-border/40 bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-overlay animate-in slide-in-from-bottom-8 duration-300 sm:mx-auto sm:max-w-lg sm:rounded-t-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />

            <div className="mb-4 flex flex-col gap-2">
              <BrandLogo href="/dashboard" variant="mark" height={32} className="px-2" />
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex h-12 items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-muted"
              >
                <Avatar>
                  <AvatarImage src={resolveMediaUrl(profile?.avatar_url) || undefined} alt="" />
                  <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                    {(profile?.full_name || user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate font-medium">
                    {profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{accountLabel}</span>
                </span>
              </Link>
            </div>

            <button
              type="button"
              onClick={() => {
                haptic()
                setMenuOpen(false)
                window.dispatchEvent(new Event('rigbu:open-search'))
              }}
              className="mb-3 flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-left text-sm text-muted-foreground transition-colors active:bg-muted"
            >
              <RigbuIcon name="search" size={16} />
              <span>Search courses…</span>
              <span className="ml-auto rounded-md bg-background px-1.5 py-0.5 text-[10px] font-medium">Live</span>
            </button>

            {ROLE_PANELS.map((panel) => {
              const items = panels[panel.id].filter(
                (item) => !tabHrefs.has(hrefWithoutQuery(item.href))
              )
              if (items.length === 0) return null
              return (
                <div key={panel.id} className="mb-4">
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {panel.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors active:bg-muted"
                      >
                        <RigbuIcon name={item.icon} size={20} />
                        <span className="text-center text-xs font-medium">{item.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}

            <Button variant="outline" onClick={handleLogout} className="w-full">
              <RigbuIcon name="sign-out" size={16} />
              Logout
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
