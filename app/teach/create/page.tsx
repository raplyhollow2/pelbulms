'use client'

import { CreateStudio } from '@/components/teach/create-studio'
import { CapabilityGate } from '@/components/auth/capability-gate'
import { CAP } from '@/lib/capability-keys'

export default function TeachCreatePage() {
  return (
    <CapabilityGate anyOf={[CAP.TEACH_CREATE_VIEW]} fallback="/teach/dashboard">
      <CreateStudio />
    </CapabilityGate>
  )
}
