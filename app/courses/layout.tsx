'use client'

import { AuthShell } from '@/components/layout/auth-shell'

export default function CoursesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthShell loadingLabel="Loading courses...">{children}</AuthShell>
}
