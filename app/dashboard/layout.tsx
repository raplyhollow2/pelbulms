'use client'

import { AuthShell } from '@/components/layout/auth-shell'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthShell loadingLabel="Loading your dashboard...">{children}</AuthShell>
}
