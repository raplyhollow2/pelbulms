'use client'

import { AuthShell } from '@/components/layout/auth-shell'

export default function TeachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthShell requireTeach loadingLabel="Loading teacher workspace...">{children}</AuthShell>
}
