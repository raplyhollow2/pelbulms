import { redirect } from 'next/navigation'

/** Prefer the wider dedicated permissions page. */
export default function SettingsPermissionsRedirect() {
  redirect('/admin/permissions')
}
