import { parseLessonActivities, tracksActivityCompletion } from '@/lib/lesson-activities'
import { parseLessonBlocks } from '@/lib/lesson-blocks'

export type LessonContentCounts = {
  assignment_count: number
  activity_count: number
  quiz_count: number
}

/**
 * Count viewer-facing curriculum items on one lesson.
 * Quiz rows, quiz activities, and quiz blocks that share an id count once.
 * Reading resources (files, pages, links) stay part of the lecture.
 */
export function countLessonContent(
  lesson: { resources?: unknown; content?: unknown },
  extraQuizIds: string[] = []
): LessonContentCounts {
  let assignmentCount = 0
  let activityCount = 0
  const quizIds = new Set<string>()
  let unlinkedQuizzes = 0

  const noteQuiz = (quizId?: string | null) => {
    const id = quizId?.trim()
    if (!id) {
      unlinkedQuizzes += 1
      return
    }
    quizIds.add(id)
  }

  for (const activity of parseLessonActivities(lesson.resources)) {
    if (activity.activity === 'assignment') {
      assignmentCount += 1
      continue
    }
    if (activity.activity === 'quiz') {
      noteQuiz(activity.quizId)
      continue
    }
    if (tracksActivityCompletion(activity)) activityCount += 1
  }

  for (const block of parseLessonBlocks(lesson.content)) {
    if (block.type === 'assignment') {
      assignmentCount += 1
      continue
    }
    if (block.type === 'quiz') {
      if (block.quizId.trim()) noteQuiz(block.quizId)
      continue
    }
    if (block.type === 'scenario') activityCount += 1
  }

  for (const quizId of extraQuizIds) {
    const id = quizId.trim()
    if (id) quizIds.add(id)
  }

  return {
    assignment_count: assignmentCount,
    activity_count: activityCount,
    quiz_count: quizIds.size + unlinkedQuizzes,
  }
}
