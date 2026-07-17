'use client'

import { useEffect, useState } from 'react'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileNavigation } from './mobile-navigation'

interface ResponsiveLayoutProps {
  children: React.ReactNode
  user?: any
}

export function ResponsiveLayout({ children, user }: ResponsiveLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white dark:from-gray-900 dark:to-black overflow-x-hidden">
      {/* Desktop sidebar — hidden below lg */}
      <div className="hidden lg:block">
        <DesktopSidebar user={user} />
      </div>

      <main
        className={`min-h-screen w-full transition-[padding] duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Mobile bottom nav clearance */}
        <div className="page-shell pb-24 lg:pb-0">
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
