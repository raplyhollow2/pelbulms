import { z } from 'zod'
import type { CourseOutline, OutlineLesson } from '@/lib/ai-course-builder'

export const courseStructureSchema = z.object({
  summary: z.string(),
  learningObjectives: z.array(z.string()).max(8),
  modules: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        lessons: z
          .array(
            z.object({
              action: z.enum(['keep', 'move', 'add', 'split']),
              title: z.string(),
              sourceTitle: z.string(),
              description: z.string(),
              hasQuiz: z.boolean(),
            })
          )
          .max(12),
      })
    )
    .max(12),
})

export type CourseStructureProposal = z.infer<typeof courseStructureSchema>

function norm(value: string) {
  return value.trim().toLowerCase()
}

export function applyProposalToOutline(
  outline: CourseOutline,
  proposal: CourseStructureProposal,
  acceptedIndexes: number[]
): CourseOutline {
  const accepted = proposal.modules.filter((_, index) => acceptedIndexes.includes(index))
  const pool: OutlineLesson[] = outline.modules.flatMap((mod) => mod.lessons.map((lesson) => ({ ...lesson })))
  const take = (title: string) => {
    const key = norm(title)
    if (!key) return null
    const index = pool.findIndex((lesson) => norm(lesson.title) === key)
    if (index < 0) return null
    return pool.splice(index, 1)[0]
  }

  const modules = accepted.map((mod) => ({
    title: mod.title,
    description: mod.description,
    lessons: mod.lessons.flatMap((lesson) => {
      if (lesson.action === 'add') {
        return [
          {
            title: lesson.title,
            description: lesson.description,
            hasQuiz: lesson.hasQuiz,
          },
        ]
      }
      const existing = take(lesson.sourceTitle || lesson.title)
      if (lesson.action === 'split' && existing && norm(existing.title) !== norm(lesson.title)) {
        return [
          existing,
          {
            title: lesson.title,
            description: lesson.description,
            hasQuiz: lesson.hasQuiz,
          },
        ]
      }
      if (existing) {
        return [
          {
            ...existing,
            title: lesson.title || existing.title,
            description: lesson.description || existing.description,
            hasQuiz: lesson.hasQuiz || existing.hasQuiz,
          },
        ]
      }
      return [
        {
          title: lesson.title,
          description: lesson.description,
          hasQuiz: lesson.hasQuiz,
        },
      ]
    }),
  }))

  if (pool.length) {
    modules.push({
      title: 'Kept pages',
      description: 'Pages the proposal did not place.',
      lessons: pool,
    })
  }

  return {
    ...outline,
    learningObjectives: proposal.learningObjectives.length
      ? proposal.learningObjectives
      : outline.learningObjectives,
    modules,
  }
}
