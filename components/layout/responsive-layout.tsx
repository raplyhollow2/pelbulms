'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { BrandLogo } from '@/components/brand/brand-logo'
import { Button } from '@/components/ui/button'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileNavigation } from './mobile-navigation'
import { NotificationBell } from './notification-bell'
import { APP_HEADER_PORTAL_ID } from './app-header-slot'

interface ResponsiveLayoutProps {
  children: React.ReactNode
  user?: any
  siteName?: string
  logoUrl?: string | null
  profile?: {
    role?: string | null
    full_name?: string | null
    avatar_url?: string | null
  } | null
}

export function ResponsiveLayout({ children, user, logoUrl = null, profile = null }: ResponsiveLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  const isLearnPlayer = /^\/learn\/[^/]+\/lesson\//.test(pathname || '')
  const isCourseAuthoring =
    pathname === '/teach/create' || /^\/teach\/courses\/[^/]+\/studio$/.test(pathname || '')

  useEffect(() => {
    const onToggle = (event: Event) => {
      const custom = event as CustomEvent<{ collapsed: boolean }>
      if (typeof custom.detail?.collapsed === 'boolean') {
        setSidebarCollapsed(custom.detail.collapsed)
      }
    }

    window.addEventListener('rigbu:sidebar-collapse', onToggle as EventListener)
    return () => {
      window.removeEventListener('rigbu:sidebar-collapse', onToggle as EventListener)
    }
  }, [])

  if (isLearnPlayer || isCourseAuthoring) {
    return (
      <div key={pathname} className="h-dvh overflow-hidden bg-background">
        {children}
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background">
      <div className="hidden md:block">
        <DesktopSidebar user={user} logoUrl={logoUrl} profile={profile} />
      </div>

      <main
        className={`flex min-h-dvh w-full flex-col transition-[padding] duration-300 ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        <header className="sticky top-0 z-40 flex shrink-0 items-center gap-2 border-b border-border/40 bg-background/85 px-3 py-2 backdrop-blur-xl safe-area-top sm:gap-3 sm:px-5 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <BrandLogo href="/dashboard" src={logoUrl} size={32} className="rounded-lg px-1 py-1" />
          </div>

          {/* Desktop page chrome (catalog toolbar, etc.) mounts here */}
          <div
            id={APP_HEADER_PORTAL_ID}
            className="hidden min-w-0 flex-1 items-center md:flex"
          />

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 md:hidden"
              aria-label="Search"
              onClick={() => window.dispatchEvent(new Event('rigbu:open-search'))}
            >
              <Search className="h-4 w-4" />
            </Button>
            <NotificationBell compact />
          </div>
        </header>

        <div
          key={pathname}
          className="page-shell page-enter flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {children}
        </div>
      </main>

      <div className="md:hidden">
        <MobileNavigation user={user} profile={profile} />
      </div>
    </div>
  )
}

export function useSidebarWidth() {
  const [sidebarWidth, setSidebarWidth] = useState(0)

  useEffect(() => {
    const sync = () => {
      const width = window.innerWidth
      if (width < 768) {
        setSidebarWidth(0)
        return
      }
      const collapsed =
        localStorage.getItem('rigbu:sidebar-collapsed') === 'true' ||
        (width >= 768 && width < 1024)
      setSidebarWidth(collapsed ? 80 : 256)
    }

    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('rigbu:sidebar-collapse', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('rigbu:sidebar-collapse', sync)
    }
  }, [])

  return sidebarWidth
}
