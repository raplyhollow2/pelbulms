'use client'

import { AuthShell } from '@/components/layout/auth-shell'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthShell loadingLabel="Loading admin...">
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(105deg,color-mix(in_oklch,var(--royal-from)_16%,transparent),color-mix(in_oklch,var(--royal-via)_12%,transparent)_46%,color-mix(in_oklch,var(--royal-to)_16%,transparent))]"
        />
        <div className="relative">{children}</div>
      </div>
    </AuthShell>
  )
}
