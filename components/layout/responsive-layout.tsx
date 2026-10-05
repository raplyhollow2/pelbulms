'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { Rigbu } from '@/components/brand/rigbu'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileNavigation } from './mobile-navigation'
import { NotificationBell } from './notification-bell'
import { APP_HEADER_PORTAL_ID } from './app-header-slot'

interface ResponsiveLayoutProps {
  children: React.ReactNode
  user?: any
  siteName?: string
  profile?: {
    role?: string | null
    full_name?: string | null
    avatar_url?: string | null
  } | null
}

const SIDEBAR_STORAGE_KEY = 'rigbu:sidebar-collapsed'

export function ResponsiveLayout({ children, user, siteName = 'Rigbu LMS', profile = null }: ResponsiveLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()
  const isLearnPlayer = /^\/learn\/[^/]+\/lesson\//.test(pathname || '')
  const isCourseAuthoring =
    pathname === '/teach/create' || /^\/teach\/courses\/[^/]+\/studio$/.test(pathname || '')

  useEffect(() => {
    const apply = () => {
      const width = window.innerWidth
      if (width < 768) return
      const isTablet = width >= 768 && width < 1024
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
      const collapsed = isTablet ? true : stored
      setSidebarOpen(!collapsed)
      window.dispatchEvent(new CustomEvent('rigbu:sidebar-collapse', { detail: { collapsed } }))
    }
    apply()
    const tabletMq = window.matchMedia('(min-width: 768px) and (max-width: 1023px)')
    tabletMq.addEventListener('change', apply)
    return () => tabletMq.removeEventListener('change', apply)
  }, [])

  const onSidebarOpenChange = (open: boolean) => {
    setSidebarOpen(open)
    const collapsed = !open
    if (window.innerWidth >= 1024) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
    }
    window.dispatchEvent(new CustomEvent('rigbu:sidebar-collapse', { detail: { collapsed } }))
  }

  if (isLearnPlayer || isCourseAuthoring) {
    return (
      <div key={pathname} className="h-dvh overflow-hidden bg-background">
        {children}
      </div>
    )
  }

  return (
    <TooltipProvider delay={200}>
    <SidebarProvider open={sidebarOpen} onOpenChange={onSidebarOpenChange} className="min-h-dvh bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-background"
      />

      <DesktopSidebar user={user} siteName={siteName} profile={profile} />

      <SidebarInset className="min-h-dvh overflow-x-clip bg-transparent">
        <header className="sticky top-0 z-40 flex shrink-0 items-center gap-2 border-b border-border/40 bg-background/85 px-3 py-2 backdrop-blur-xl safe-area-top sm:gap-3 sm:px-5 md:px-6 lg:px-8">
          <SidebarTrigger className="hidden md:inline-flex" />
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <Link
              href="/dashboard"
              className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1"
            >
              <Rigbu className="h-8 w-8" />
              <span className="truncate text-sm font-semibold tracking-tight">{siteName}</span>
            </Link>
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
          className="page-shell flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {children}
        </div>
      </SidebarInset>

      <div className="md:hidden">
        <MobileNavigation user={user} profile={profile} />
      </div>
    </SidebarProvider>
    </TooltipProvider>
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
      setSidebarWidth(collapsed ? 48 : 256)
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
