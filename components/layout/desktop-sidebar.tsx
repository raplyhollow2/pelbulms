'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, BookOpen, GraduationCap, Settings, User,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Search, TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { haptic } from '@/lib/utils'

interface DesktopSidebarProps {
  user?: any
}

export function DesktopSidebar({ user }: DesktopSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Courses', href: '/courses', icon: BookOpen },
    { name: 'Progress', href: '/learn/progress', icon: TrendingUp },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const openCommandPalette = () => {
    // Trigger command palette keyboard shortcut
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      ctrlKey: true
    })
    document.dispatchEvent(event)
  }

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

  const toggleCollapse = () => {
    haptic.tap()
    setCollapsed(!collapsed)
  }

  return (
    <div
      className={`fixed left-0 top-0 h-full glass-strong border-r border-border/40 transition-all duration-300 z-50 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo & Collapse Button */}
      <div className="flex items-center justify-between p-4 border-b border-border/40">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-bhutan-yellow" />
            <span className="text-lg font-bold bg-gradient-to-r from-bhutan-yellow to-bhutan-orange bg-clip-text text-transparent">
              Pelbu LMS
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapse}
          className="ml-auto touch-feedback"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Profile Card */}
      <div className="p-4 border-b border-border/40">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <Avatar className="w-10 h-10 bg-bhutan-yellow">
            <AvatarFallback className="bg-bhutan-yellow text-black font-semibold">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {/* Search Button */}
        <Button
          variant="outline"
          className={`w-full justify-start mb-2 ${collapsed ? 'px-4' : ''}`}
          onClick={openCommandPalette}
        >
          <Search className="w-5 h-5" />
          {!collapsed && (
            <>
              <span className="ml-3">Search</span>
              <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
            </>
          )}
        </Button>

        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => haptic.tap()}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 touch-feedback ${
                isActive
                  ? 'bg-bhutan-yellow text-black shadow-lg'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className={`w-5 h-5 ${collapsed ? 'mx-auto' : ''}`} />
              {!collapsed && (
                <span className="font-medium">{item.name}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-border/40">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={`w-full justify-start touch-feedback ${collapsed ? 'px-4' : ''}`}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="ml-3">Logout</span>}
        </Button>
      </div>
    </div>
  )
}