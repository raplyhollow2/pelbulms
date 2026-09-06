import { redirect } from 'next/navigation'

/** Legacy URL — enrolled learners now open the course player. */
export default async function LegacyLearnCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  redirect(`/learn/${courseId}`)
}
