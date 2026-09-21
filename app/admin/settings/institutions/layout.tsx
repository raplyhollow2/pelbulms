import { SuperadminGate } from '@/components/admin/superadmin-gate'
import { CAP } from '@/lib/capability-keys'

export default function InstitutionsSettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SuperadminGate anyOf={[CAP.INSTITUTIONS_VIEW]}>{children}</SuperadminGate>
}
