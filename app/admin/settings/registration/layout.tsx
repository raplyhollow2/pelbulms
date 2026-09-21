import { SuperadminGate } from '@/components/admin/superadmin-gate'
import { CAP } from '@/lib/capability-keys'

export default function SettingsViewLayout({ children }: { children: React.ReactNode }) {
  return <SuperadminGate anyOf={[CAP.SETTINGS_VIEW]}>{children}</SuperadminGate>
}
