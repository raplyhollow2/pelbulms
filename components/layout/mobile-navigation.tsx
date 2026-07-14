'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, BookOpen, GraduationCap, User,
  Menu, X, LogOut, Settings, Search,
  Bell, MessageCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { haptic } from '@/lib/utils'

interface MobileNavigationProps {
  user?: any
}

export function MobileNavigation({ user }: MobileNavigationProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const mainNavigation = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Courses', href: '/courses', icon: BookOpen },
    { name: 'Learn', href: '/learn', icon: GraduationCap },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  const secondaryNavigation = [
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Notifications', href: '/notifications', icon: Bell },
    { name: 'Messages', href: '/messages', icon: MessageCircle },
    { name: 'Search', href: '/search', icon: Search },
  ]

  const handleLogout = async () => {
    haptic.warning()
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const toggleMenu = () => {
    haptic.tap()
    setMenuOpen(!menuOpen)
  }

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-border/40 z-50 safe-area-bottom">
        {/* Main Navigation */}
        <div className="flex items-center justify-around h-16 px-2">
          {mainNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => haptic.tap()}
                className={`flex flex-col items-center justify-center min-w-[60px] py-2 px-1 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'text-bhutan-yellow'
                    : 'text-muted-foreground'
                }`}
              >
                <item.icon className={`w-6 h-6 ${isActive ? 'fill-bhutan-yellow' : ''}`} />
                <span className="text-xs mt-1 font-medium">{item.name}</span>
              </Link>
            )
          })}

          {/* Menu Button for Secondary Navigation */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMenu}
            className={`flex flex-col items-center justify-center min-w-[60px] py-2 px-1 rounded-lg touch-feedback ${
              menuOpen ? 'text-bhutan-yellow' : 'text-muted-foreground'
            }`}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            <span className="text-xs mt-1 font-medium">Menu</span>
          </Button>
        </div>

        {/* Secondary Menu Drawer */}
        {menuOpen && (
          <div className="fixed inset-0 bg-black/50 z-50" onClick={toggleMenu}>
            <div
              className="absolute bottom-16 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl border-t border-border/40 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* User Info */}
              <div className="flex items-center gap-3 p-4 mb-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <Avatar className="w-12 h-12 bg-bhutan-yellow">
                  <AvatarFallback className="bg-bhutan-yellow text-black font-semibold text-lg">
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

              {/* Secondary Navigation Items */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {secondaryNavigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => {
                      haptic.tap()
                      setMenuOpen(false)
                    }}
                    className="flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <item.icon className="w-6 h-6 mb-2 text-muted-foreground" />
                    <span className="text-xs font-medium">{item.name}</span>
                  </Link>
                ))}
              </div>

              {/* Logout Button */}
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full touch-feedback"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Safe Area Spacer for Mobile */}
      <div className="h-16 safe-area-bottom-spacer" />
    </>
  )
}