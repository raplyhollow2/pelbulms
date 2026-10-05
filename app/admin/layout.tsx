'use client'

import { AuthShell } from '@/components/layout/auth-shell'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthShell loadingLabel="Loading admin...">{children}</AuthShell>
}
