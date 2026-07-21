'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, BookOpen, GraduationCap, Settings, User,
  ChevronLeft, ChevronRight, LogOut, Search, TrendingUp, Users,
  Bell,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { resolveMediaUrl } from '@/lib/media'
import { cn, haptic, warning as hapticWarning, tap as hapticTap } from '@/lib/utils'

interface DesktopSidebarProps {
  user?: any
}

interface NavItem {
  name: string
  href: string
  icon: LucideIcon
}

const STORAGE_KEY = 'pelbu:sidebar-collapsed'

export function DesktopSidebar({ user }: DesktopSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [userRole, setUserRole] = useState<
    'student' | 'instructor' | 'admin' | 'resource_person' | 'superadmin'
  >('student')
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string } | null>(null)
  const [canApprove, setCanApprove] = useState(false)

  const canTeach =
    userRole === 'instructor' ||
    userRole === 'admin' ||
    userRole === 'resource_person' ||
    userRole === 'superadmin'
  const canAdmin = userRole === 'admin' || userRole === 'superadmin'
  const isSuper = userRole === 'superadmin'
  const isResourcePerson = userRole === 'resource_person'
  // Always show Approvals for superadmin + resource_person; also assigned reviewers
  const showApprovals = isSuper || isResourcePerson || canApprove

  // Ordered by everyday priority for a learner.
  const navigation: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Courses', href: '/courses', icon: BookOpen },
    { name: 'My Progress', href: '/learn/progress', icon: TrendingUp },
    { name: 'Announcements', href: '/announcements', icon: Bell },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const teacherNavigation: NavItem[] = [
    { name: 'Teacher Dashboard', href: '/teach/dashboard', icon: GraduationCap },
    { name: 'New Course', href: '/teach/courses/new', icon: BookOpen },
    { name: 'Analytics', href: '/teach/analytics', icon: TrendingUp },
    { name: 'Announcements', href: '/teach/announcements', icon: Bell },
    ...(showApprovals && !canAdmin
      ? [{ name: 'Users', href: '/admin/users?tab=approvals', icon: Users } as NavItem]
      : []),
  ]

  const adminNavigation: NavItem[] = [
    { name: 'Users', href: '/admin/users', icon: Users },
  ]

  // Restore persisted collapse state and notify the layout on mount.
  useEffect(() => {
    const stored = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true'
    if (stored) {
      setCollapsed(true)
      window.dispatchEvent(
        new CustomEvent('pelbu:sidebar-collapse', { detail: { collapsed: true } })
      )
    }
  }, [])

  useEffect(() => {
    if (user) fetchProfile()
  }, [user])

  const fetchProfile = async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('role, full_name, avatar_url')
        .eq('id', user.id)
        .single()

      const metaRole =
        user?.app_metadata?.role || user?.user_metadata?.role || null
      const profileRole = (data as any)?.role || null
      const role =
        profileRole === 'superadmin' || metaRole === 'superadmin'
          ? 'superadmin'
          : profileRole === 'resource_person' || metaRole === 'resource_person'
            ? 'resource_person'
            : profileRole || metaRole || 'student'

      setUserRole(role)
      if (data) {
        setProfile({ full_name: (data as any).full_name, avatar_url: (data as any).avatar_url })
      }

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
      console.error('Error fetching profile:', error)
    }
  }

  const openCommandPalette = () => {
    window.dispatchEvent(new Event('pelbu:open-search'))
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

  const toggleCollapse = () => {
    hapticTap()
    const next = !collapsed
    setCollapsed(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(next))
    }
    window.dispatchEvent(
      new CustomEvent('pelbu:sidebar-collapse', { detail: { collapsed: next } })
    )
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const initials = displayName.charAt(0).toUpperCase()

  const renderNav = (items: NavItem[]) =>
    items.map((item) => {
      const isActive = pathname === item.href
      const link = (
        <Link
          key={item.name}
          href={item.href}
          onClick={() => haptic()}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'group press relative flex items-center rounded-xl text-sm font-medium transition-all duration-300',
            collapsed ? 'h-11 w-11 justify-center' : 'gap-3 px-3 py-2.5',
            isActive
              ? 'bg-gradient-to-r from-bhutan-yellow/20 to-bhutan-orange/10 text-foreground shadow-soft'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          )}
        >
          {isActive && (
            <span
              className={cn(
                'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-bhutan-yellow',
                collapsed && 'left-0'
              )}
            />
          )}
          <item.icon
            className={cn('h-5 w-5 shrink-0', isActive && 'text-bhutan-orange')}
          />
          {!collapsed && <span className="truncate">{item.name}</span>}
        </Link>
      )

      if (collapsed) {
        return (
          <Tooltip key={item.name}>
            <TooltipTrigger render={link} />
            <TooltipContent side="right">{item.name}</TooltipContent>
          </Tooltip>
        )
      }
      return link
    })

  const sectionLabel = (label: string, short: string) => (
    <p
      className={cn(
        'px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70',
        collapsed && 'text-center px-0'
      )}
    >
      {collapsed ? short : label}
    </p>
  )

  return (
    <TooltipProvider delay={200}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col border-r border-border/40 bg-background/80 shadow-[6px_0_24px_rgba(17,24,39,0.03)] backdrop-blur-xl transition-[width] duration-300 dark:shadow-[6px_0_24px_rgba(0,0,0,0.35)]',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Logo & Collapse Button */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border/40 px-4">
          {!collapsed ? (
            <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bhutan-yellow/15">
                <BookOpen className="h-5 w-5 text-bhutan-orange" />
              </div>
              <span className="truncate bg-gradient-to-r from-bhutan-yellow to-bhutan-orange bg-clip-text text-base font-bold text-transparent">
                Pelbu LMS
              </span>
            </Link>
          ) : (
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-bhutan-yellow/15">
              <BookOpen className="h-5 w-5 text-bhutan-orange" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('h-8 w-8 shrink-0', collapsed && 'absolute -right-3 top-5 h-6 w-6 rounded-full border border-border/60 bg-background shadow-sm')}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Profile */}
        <div className="shrink-0 border-b border-border/40 p-3">
          <div
            className={cn(
              'flex items-center gap-2',
              collapsed && 'flex-col'
            )}
          >
            <Link
              href="/profile"
              className={cn(
                'flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted',
                collapsed && 'justify-center'
              )}
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={resolveMediaUrl(profile?.avatar_url) || undefined} alt={displayName} />
                <AvatarFallback className="bg-bhutan-yellow font-semibold text-black">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              )}
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <nav className="scroll-premium flex-1 space-y-1 overflow-y-auto p-3">
          {/* Search */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={openCommandPalette}
                    className="mx-auto mb-2 h-11 w-11"
                    aria-label="Search"
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                }
              />
              <TooltipContent side="right">
                Search <kbd className="ml-1 rounded bg-background/20 px-1 text-[10px]">⌘K</kbd>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              className="mb-2 w-full justify-start gap-3 text-muted-foreground"
              onClick={openCommandPalette}
            >
              <Search className="h-5 w-5" />
              <span>Search</span>
              <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs">⌘K</kbd>
            </Button>
          )}

          {renderNav(navigation)}

          {canTeach && (
            <>
              {sectionLabel('Teacher Tools', 'Teach')}
              {renderNav(teacherNavigation)}
            </>
          )}

          {canAdmin && (
            <>
              {sectionLabel('Administration', 'Admin')}
              {renderNav(adminNavigation)}
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="shrink-0 border-t border-border/40 p-3">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    aria-label="Logout"
                    className="mx-auto h-11 w-11 text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                }
              />
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
