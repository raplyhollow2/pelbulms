'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, BookOpen, GraduationCap, User,
  Menu, X, LogOut, Settings, Search,
  Bell, TrendingUp, Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { haptic, warning as hapticWarning } from '@/lib/utils'

interface MobileNavigationProps {
  user?: any
}

export function MobileNavigation({ user }: MobileNavigationProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userRole, setUserRole] = useState<
    'student' | 'instructor' | 'admin' | 'resource_person' | 'superadmin'
  >('student')

  const canTeach =
    userRole === 'instructor' ||
    userRole === 'admin' ||
    userRole === 'resource_person' ||
    userRole === 'superadmin'
  const canAdmin = userRole === 'admin' || userRole === 'superadmin'

  const mainNavigation = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Courses', href: '/courses', icon: BookOpen },
    { name: 'Learn', href: '/learn/progress', icon: TrendingUp },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  const secondaryNavigation = [
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Announcements', href: '/announcements', icon: Bell },
    { name: 'Search', href: '/courses', icon: Search },
  ]

  const teacherNavigation = [
    { name: 'Teacher Hub', href: '/teach/dashboard', icon: GraduationCap },
    { name: 'New Course', href: '/teach/courses/new', icon: BookOpen },
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

      if (profile) {
        setUserRole((profile as any).role || 'student')
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
        className="fixed bottom-0 inset-x-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-bottom"
        aria-label="Mobile navigation"
      >
        <div className="flex items-stretch justify-around h-16 px-1 max-w-lg mx-auto">
          {mainNavigation.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => haptic()}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 py-2 rounded-lg transition-colors ${
                  active ? 'text-bhutan-yellow' : 'text-muted-foreground'
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${active ? 'text-bhutan-yellow' : ''}`} />
                <span className="text-[10px] font-medium truncate max-w-full px-0.5">
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
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 py-2 rounded-lg transition-colors ${
              menuOpen ? 'text-bhutan-yellow' : 'text-muted-foreground'
            }`}
            aria-expanded={menuOpen}
            aria-label="Open menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span className="text-[10px] font-medium">Menu</span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute bottom-0 inset-x-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-border/40 bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />

            <div className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-muted/60">
              <Avatar className="w-11 h-11 bg-bhutan-yellow shrink-0">
                <AvatarFallback className="bg-bhutan-yellow text-black font-semibold">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>

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
