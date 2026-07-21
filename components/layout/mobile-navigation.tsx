'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, BookOpen, GraduationCap, User,
  Menu, X, LogOut, Settings, Search,
  Bell, TrendingUp, Users, Plus, HardDrive
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { cn, haptic, warning as hapticWarning } from '@/lib/utils'

interface MobileNavigationProps {
  user?: any
}

export function MobileNavigation({ user }: MobileNavigationProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userRole, setUserRole] = useState<
    'student' | 'instructor' | 'admin' | 'resource_person' | 'superadmin'
  >('student')
  const [canApprove, setCanApprove] = useState(false)

  const canTeach =
    userRole === 'instructor' ||
    userRole === 'admin' ||
    userRole === 'resource_person' ||
    userRole === 'superadmin'
  const canAdmin = userRole === 'admin' || userRole === 'superadmin'
  const isSuper = userRole === 'superadmin'
  const isResourcePerson = userRole === 'resource_person'
  const showApprovals = isSuper || isResourcePerson || canApprove

  const mainNavigation = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Courses', href: '/courses', icon: BookOpen },
    { name: 'Learn', href: '/learn/progress', icon: TrendingUp },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  const secondaryNavigation = [
    { name: 'Announcements', href: '/announcements', icon: Bell },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const teacherNavigation = [
    { name: 'Teacher Hub', href: '/teach/dashboard', icon: GraduationCap },
    { name: 'New Course', href: '/teach/courses/new', icon: Plus },
    { name: 'Media Library', href: '/teach/media', icon: HardDrive },
    { name: 'Analytics', href: '/teach/analytics', icon: TrendingUp },
    { name: 'Announcements', href: '/teach/announcements', icon: Bell },
    ...(showApprovals && !canAdmin
      ? [{ name: 'Users', href: '/admin/users?tab=approvals', icon: Users }]
      : []),
  ]

  const adminNavigation = [
    { name: 'Users', href: '/admin/users', icon: Users },
  ]

  useEffect(() => {
    if (user) fetchUserRole()
  }, [user])

  useEffect(() => {
    setMenuOpen(false)
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const metaRole =
        user?.app_metadata?.role || user?.user_metadata?.role || null
      const profileRole = (profile as any)?.role || null
      const role =
        profileRole === 'superadmin' || metaRole === 'superadmin'
          ? 'superadmin'
          : profileRole === 'resource_person' || metaRole === 'resource_person'
            ? 'resource_person'
            : profileRole || metaRole || 'student'

      setUserRole(role)

      if (role === 'superadmin' || role === 'resource_person') {
        setCanApprove(true)
      } else {
        const { data: reviewerRows } = await supabase
          .from('registration_reviewers')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1)
        setCanApprove(!!(reviewerRows && reviewerRows.length > 0))
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
    }
  }

  const handleLogout = async () => {
    hapticWarning()
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2"
        aria-label="Mobile navigation"
      >
        <div className="pointer-events-auto mx-auto flex max-w-md items-stretch justify-around gap-1 rounded-2xl border border-border/50 bg-background/80 p-1.5 shadow-floating backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
          {mainNavigation.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => haptic()}
                aria-current={active ? 'page' : undefined}
                className="press relative flex flex-1 flex-col items-center justify-center gap-1 min-w-0 rounded-xl py-2"
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-xl bg-bhutan-yellow/15 ring-1 ring-bhutan-yellow/25"
                  />
                )}
                <item.icon
                  className={cn(
                    'relative h-5 w-5 shrink-0 transition-transform duration-300',
                    active ? 'scale-110 text-bhutan-orange' : 'text-muted-foreground'
                  )}
                  style={{ transitionTimingFunction: 'var(--ease-spring)' }}
                />
                <span
                  className={cn(
                    'relative max-w-full truncate px-0.5 text-[10px] font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {item.name}
                </span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={() => {
              haptic()
              setMenuOpen((open) => !open)
            }}
            className="press relative flex flex-1 flex-col items-center justify-center gap-1 min-w-0 rounded-xl py-2"
            aria-expanded={menuOpen}
            aria-label="Open menu"
          >
            {menuOpen && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-xl bg-bhutan-yellow/15 ring-1 ring-bhutan-yellow/25"
              />
            )}
            <span className="relative">
              {menuOpen ? (
                <X className="h-5 w-5 text-bhutan-orange" />
              ) : (
                <Menu className="h-5 w-5 text-muted-foreground" />
              )}
            </span>
            <span
              className={cn(
                'relative text-[10px] font-medium transition-colors',
                menuOpen ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              Menu
            </span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 lg:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute bottom-0 inset-x-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-border/40 bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-overlay animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />

            <div className="mb-4 flex items-center gap-3 rounded-xl bg-muted/60 p-3">
              <Avatar className="h-11 w-11 shrink-0 bg-bhutan-yellow">
                <AvatarFallback className="bg-bhutan-yellow font-semibold text-black">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                haptic()
                setMenuOpen(false)
                window.dispatchEvent(new Event('pelbu:open-search'))
              }}
              className="mb-3 flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-left text-sm text-muted-foreground transition-colors active:bg-muted"
            >
              <Search className="h-4 w-4" />
              <span>Search courses…</span>
              <span className="ml-auto rounded-md bg-background px-1.5 py-0.5 text-[10px] font-medium">Live</span>
            </button>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {secondaryNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-muted/50 active:bg-muted transition-colors"
                >
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs font-medium text-center">{item.name}</span>
                </Link>
              ))}
            </div>

            {canTeach && (
              <div className="mb-4">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Teacher
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {teacherNavigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-bhutan-yellow/10 active:bg-bhutan-yellow/20 transition-colors"
                    >
                      <item.icon className="w-5 h-5 text-bhutan-yellow" />
                      <span className="text-xs font-medium text-center">{item.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {canAdmin && (
              <div className="mb-4">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Admin
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {adminNavigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-red-600/10 active:bg-red-600/20 transition-colors"
                    >
                      <item.icon className="w-5 h-5 text-red-600" />
                      <span className="text-xs font-medium text-center">{item.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" onClick={handleLogout} className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
