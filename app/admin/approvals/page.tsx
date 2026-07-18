import { redirect } from 'next/navigation'

/** Approvals live under Users → Approvals tab */
export default function ApprovalsRedirectPage() {
  redirect('/admin/users?tab=approvals')
}
