import { AdminSettingsNav } from '@/components/admin/settings-nav'
import { SuperadminGate } from '@/components/admin/superadmin-gate'
import { CAP } from '@/lib/capability-keys'

export default function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SuperadminGate
      anyOf={[
        CAP.SETTINGS_VIEW,
        CAP.SETTINGS_SITE_VIEW,
        CAP.SETTINGS_REGISTRATION_VIEW,
        CAP.SETTINGS_MARKETING_VIEW,
        CAP.SETTINGS_EMAILS_VIEW,
        CAP.SETTINGS_EMAIL_TEMPLATES_VIEW,
        CAP.INSTITUTIONS_VIEW,
      ]}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 md:flex-row md:items-start md:pb-10">
        <AdminSettingsNav />
        <div className="min-w-0 flex-1 space-y-6">
          <header className="space-y-1 border-b border-border/50 pb-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Administration
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Site administration</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Configure the LMS, registration requirements, institutions, marketing, email hosts, email templates, and Cloudinary.
            </p>
          </header>
          {children}
        </div>
      </div>
    </SuperadminGate>
  )
}
