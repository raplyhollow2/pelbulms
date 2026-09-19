'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileNavigation } from './mobile-navigation'
import { NotificationBell } from './notification-bell'
import { APP_HEADER_PORTAL_ID } from './app-header-slot'

interface ResponsiveLayoutProps {
  children: React.ReactNode
  user?: any
}

export function ResponsiveLayout({ children, user }: ResponsiveLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  const isLearnPlayer = /^\/learn\/[^/]+\/lesson\//.test(pathname || '')

  useEffect(() => {
    const onToggle = (event: Event) => {
      const custom = event as CustomEvent<{ collapsed: boolean }>
      if (typeof custom.detail?.collapsed === 'boolean') {
        setSidebarCollapsed(custom.detail.collapsed)
      }
    }

    window.addEventListener('pelbu:sidebar-collapse', onToggle as EventListener)
    return () => {
      window.removeEventListener('pelbu:sidebar-collapse', onToggle as EventListener)
    }
  }, [])

  if (isLearnPlayer) {
    return (
      <div key={pathname} className="min-h-dvh bg-background">
        {children}
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(70rem_40rem_at_110%_-10%,rgba(255,199,44,0.10),transparent_60%),radial-gradient(60rem_38rem_at_-10%_10%,rgba(255,107,53,0.08),transparent_55%)] dark:bg-[radial-gradient(70rem_40rem_at_110%_-10%,rgba(255,199,44,0.06),transparent_60%),radial-gradient(60rem_38rem_at_-10%_10%,rgba(255,107,53,0.05),transparent_55%)]"
      />

      <div className="hidden md:block">
        <DesktopSidebar user={user} />
      </div>

      <main
        className={`flex min-h-dvh w-full flex-col transition-[padding] duration-300 ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        <header className="sticky top-0 z-40 flex shrink-0 items-center gap-2 border-b border-border/40 bg-background/85 px-3 py-2 backdrop-blur-xl safe-area-top sm:gap-3 sm:px-5 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <Link
              href="/dashboard"
              className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bhutan-yellow/15">
                <BookOpen className="h-4 w-4 text-bhutan-orange" />
              </span>
              <span className="truncate text-sm font-semibold tracking-tight">Pelbu LMS</span>
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
              onClick={() => window.dispatchEvent(new Event('pelbu:open-search'))}
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
        <MobileNavigation user={user} />
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
        localStorage.getItem('pelbu:sidebar-collapsed') === 'true' ||
        (width >= 768 && width < 1024)
      setSidebarWidth(collapsed ? 80 : 256)
    }

    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('pelbu:sidebar-collapse', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('pelbu:sidebar-collapse', sync)
    }
  }, [])

  return sidebarWidth
}
