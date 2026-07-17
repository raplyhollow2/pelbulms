'use client'

import { AuthShell } from '@/components/layout/auth-shell'

export default function AnnouncementsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthShell loadingLabel="Loading announcements...">{children}</AuthShell>
}
