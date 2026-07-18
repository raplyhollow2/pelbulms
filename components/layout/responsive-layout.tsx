'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileNavigation } from './mobile-navigation'

interface ResponsiveLayoutProps {
  children: React.ReactNode
  user?: any
}

export function ResponsiveLayout({ children, user }: ResponsiveLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()

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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* Ambient brand backdrop — subtle, premium, non-distracting */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(70rem_40rem_at_110%_-10%,rgba(255,199,44,0.10),transparent_60%),radial-gradient(60rem_38rem_at_-10%_10%,rgba(255,107,53,0.08),transparent_55%)] dark:bg-[radial-gradient(70rem_40rem_at_110%_-10%,rgba(255,199,44,0.06),transparent_60%),radial-gradient(60rem_38rem_at_-10%_10%,rgba(255,107,53,0.05),transparent_55%)]"
      />

      {/* Desktop sidebar — hidden below lg */}
      <div className="hidden lg:block">
        <DesktopSidebar user={user} />
      </div>

      <main
        className={`min-h-screen w-full transition-[padding] duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Mobile bottom nav clearance; key on route for smooth enter animation */}
        <div key={pathname} className="page-shell page-enter pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — hidden on lg+ */}
      <div className="lg:hidden">
        <MobileNavigation user={user} />
      </div>
    </div>
  )
}

export function useSidebarWidth() {
  const [sidebarWidth, setSidebarWidth] = useState(256)

  useEffect(() => {
    const sync = () => {
      const isDesktop = window.innerWidth >= 1024
      setSidebarWidth(isDesktop ? 256 : 0)
    }

    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  return sidebarWidth
}
