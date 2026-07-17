'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ResponsiveLayout } from '@/components/layout/responsive-layout'
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
      const canTeach =
        role === 'instructor' ||
        role === 'admin' ||
        role === 'resource_person' ||
        role === 'superadmin'
      if (!profile || !canTeach) {
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

  return <ResponsiveLayout user={user}>{children}</ResponsiveLayout>
}
