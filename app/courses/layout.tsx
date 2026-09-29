'use client'

import { AuthShell } from '@/components/layout/auth-shell'
import { CapabilityGate } from '@/components/auth/capability-gate'
import { CAP } from '@/lib/capability-keys'

export default function CoursesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthShell loadingLabel="Loading courses...">
      <CapabilityGate anyOf={[CAP.LEARN_COURSES_VIEW]} fallback="/dashboard">
        {children}
      </CapabilityGate>
    </AuthShell>
  )
}
