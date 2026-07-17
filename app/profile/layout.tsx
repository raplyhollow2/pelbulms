'use client'

import { AuthShell } from '@/components/layout/auth-shell'

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthShell loadingLabel="Loading profile...">{children}</AuthShell>
}
