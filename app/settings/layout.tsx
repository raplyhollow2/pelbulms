'use client'

import { AuthShell } from '@/components/layout/auth-shell'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthShell loadingLabel="Loading settings...">{children}</AuthShell>
}
