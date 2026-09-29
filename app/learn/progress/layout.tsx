'use client'

import { CapabilityGate } from '@/components/auth/capability-gate'
import { CAP } from '@/lib/capability-keys'

export default function LearnProgressLayout({ children }: { children: React.ReactNode }) {
  return (
    <CapabilityGate anyOf={[CAP.LEARN_PROGRESS_VIEW]} fallback="/dashboard">
      {children}
    </CapabilityGate>
  )
}
