'use client'

import { AuthShell } from '@/components/layout/auth-shell'

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthShell loadingLabel="Loading learning space...">{children}</AuthShell>
}
