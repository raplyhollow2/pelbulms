'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useCapabilities } from '@/components/auth/capabilities-provider'

export function CapabilityGate({
  children,
  anyOf,
  fallback = '/dashboard',
  loadingLabel = 'Checking access…',
}: {
  children: React.ReactNode
  anyOf: string[]
  fallback?: string
  loadingLabel?: string
}) {
  const router = useRouter()
  const { loaded, hasAny } = useCapabilities()
  const [ok, setOk] = useState(false)

  const needed = anyOf.join('|')

  useEffect(() => {
    if (!loaded) return
    if (!hasAny(needed ? needed.split('|') : [])) {
      router.push(fallback)
      return
    }
    setOk(true)
  }, [loaded, hasAny, needed, fallback, router])

  if (!ok) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {loadingLabel}
      </div>
    )
  }

  return <>{children}</>
}
