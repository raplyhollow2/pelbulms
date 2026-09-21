'use client'

import { CAP } from '@/lib/capability-keys'
import { CapabilityGate } from '@/components/auth/capability-gate'

export function SuperadminGate({
  children,
  anyOf = [CAP.SETTINGS_VIEW],
}: {
  children: React.ReactNode
  anyOf?: string[]
}) {
  return <CapabilityGate anyOf={anyOf}>{children}</CapabilityGate>
}
