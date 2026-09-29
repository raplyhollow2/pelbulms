'use client'

import { CapabilityGate } from '@/components/auth/capability-gate'
import { CAP } from '@/lib/capability-keys'

export default function TeachMediaLayout({ children }: { children: React.ReactNode }) {
  return (
    <CapabilityGate anyOf={[CAP.TEACH_MEDIA_VIEW]} fallback="/teach/dashboard">
      {children}
    </CapabilityGate>
  )
}
