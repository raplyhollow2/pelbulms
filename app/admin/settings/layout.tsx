import { AdminSettingsNav } from '@/components/admin/settings-nav'
import { SuperadminGate } from '@/components/admin/superadmin-gate'

export default function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SuperadminGate>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-10">
        <header className="space-y-4 border-b border-border/50 pb-5">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Administration
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Site administration</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Configure the LMS, registration requirements, institutions, and public marketing.
            </p>
          </div>
          <AdminSettingsNav />
        </header>
        {children}
      </div>
    </SuperadminGate>
  )
}
