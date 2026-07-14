'use client'

import { useEffect, useState } from 'react'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileNavigation } from './mobile-navigation'

interface ResponsiveLayoutProps {
  children: React.ReactNode
  user?: any
}

export function ResponsiveLayout({ children, user }: ResponsiveLayoutProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    // Initial check
    checkMobile()

    // Listen for resize changes
    window.addEventListener('resize', checkMobile)

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (!isMounted) {
    return null // Prevent hydration mismatch
  }

  if (isMobile) {
    // Mobile/Tablet Layout
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white dark:from-gray-900 dark:to-black">
        {children}
        <MobileNavigation user={user} />
      </div>
    )
  }

  // Desktop Layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white dark:from-gray-900 dark:to-black">
      <DesktopSidebar user={user} />
      <main className="transition-all duration-300" style={{ marginLeft: isMobile ? '0' : '256px' }}>
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  )
}

// Helper hook to get current sidebar width for desktop content padding
export function useSidebarWidth() {
  const [sidebarWidth, setSidebarWidth] = useState(256) // Default expanded width

  useEffect(() => {
    const checkSidebar = () => {
      const isMobile = window.innerWidth < 1024
      setSidebarWidth(isMobile ? 0 : 256) // 256px for desktop, 0 for mobile
    }

    checkSidebar()
    window.addEventListener('resize', checkSidebar)
    return () => window.removeEventListener('resize', checkSidebar)
  }, [])

  return sidebarWidth
}