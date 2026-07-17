'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ResponsiveLayout } from '@/components/layout/responsive-layout'
import { createClient } from '@/lib/supabase/client'

interface AuthShellProps {
  children: React.ReactNode
  loadingLabel?: string
}

/**
 * Shared authenticated shell: session gate + responsive sidebar/bottom nav.
 */
export function AuthShell({
  children,
  loadingLabel = 'Loading...',
}: AuthShellProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const checkUser = async () => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push('/auth/login')
          return
        }

        if (mounted) setUser(session.user)
      } catch (error) {
        console.error('Error checking user:', error)
        router.push('/auth/login')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    checkUser()
    return () => {
      mounted = false
    }
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white dark:from-gray-900 dark:to-black flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-bhutan-yellow" />
          <p className="text-sm text-muted-foreground">{loadingLabel}</p>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveLayout user={user}>
      {children}
    </ResponsiveLayout>
  )
}
