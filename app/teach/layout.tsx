'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ResponsiveLayout } from '@/components/layout/responsive-layout'
import { PresenceTracker } from '@/components/presence/presence-tracker'
import { createClient } from '@/lib/supabase/client'

export default function TeachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

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

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      const role = (profile as { role?: string } | null)?.role
      let allowed =
        role === 'instructor' ||
        role === 'admin' ||
        role === 'resource_person' ||
        role === 'superadmin'

      try {
        const capRes = await fetch('/api/admin/capabilities/me')
        if (capRes.ok) {
          const capJson = await capRes.json()
          const list: string[] = capJson.capabilities || []
          const hasTeach =
            list.includes('*') || list.some((k: string) => k.startsWith('menu.teach.'))
          if (hasTeach) allowed = true
          else if (list.length > 0) allowed = false
        }
      } catch {
        // keep coarse role fallback
      }

      if (!profile || !allowed) {
        router.push('/dashboard')
        return
      }

      setUser(session.user)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white dark:from-gray-900 dark:to-black flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-bhutan-yellow" />
          <p className="text-sm text-muted-foreground">Loading teacher workspace...</p>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveLayout user={user}>
      <PresenceTracker />
      {children}
    </ResponsiveLayout>
  )
}
