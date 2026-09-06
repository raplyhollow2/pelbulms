import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveCoursePlayerPath } from '@/lib/learn-entry'

/**
 * Enrolled learners skip this hub and open the Udemy-style player.
 */
export default async function LearnCourseEntryPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?next=/learn/${courseId}`)
  }

  const playerPath = await resolveCoursePlayerPath(courseId, user.id)
  if (!playerPath) {
    redirect(`/courses/${courseId}`)
  }
  if (playerPath !== 'empty') {
    redirect(playerPath)
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">No lectures yet</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This course does not have published lectures. Check back after the instructor adds content.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex min-h-11 items-center rounded-md bg-bhutan-yellow px-4 text-sm font-medium text-black hover:bg-bhutan-orange"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
