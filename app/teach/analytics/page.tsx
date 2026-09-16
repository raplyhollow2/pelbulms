'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/** Legacy route — Course Insights now lives at /teach/reports */
export default function TeachAnalyticsRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/teach/reports')
  }, [router])

  return (
    <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      Redirecting to Reports…
    </div>
  )
}
