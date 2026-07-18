import { redirect } from 'next/navigation'

/** Reviewer assignment lives under Users → Reviewers tab */
export default function ReviewersRedirectPage() {
  redirect('/admin/users?tab=reviewers')
}
