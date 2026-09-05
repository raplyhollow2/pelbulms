import { blocksFromFilledLesson, slugify, type CourseOutline, type FilledLesson } from '@/lib/ai-course-builder'

type Service = {
  from: (table: string) => any
}

export async function createDraftCourse(
  service: Service,
  opts: {
    userId: string
    outline: CourseOutline
    language: string
  }
) {
  const slug = `${slugify(opts.outline.title) || 'course'}-${Date.now().toString(36).slice(-5)}`
  const { data: course, error } = await service
    .from('courses')
    .insert({
      instructor_id: opts.userId,
      title: opts.outline.title,
      slug,
      description: opts.outline.description || null,
      category: 'General',
      level: 'beginner',
      language: opts.language || opts.outline.language || 'English',
      duration_minutes: opts.outline.durationMinutes || null,
      is_published: false,
      is_featured: false,
      enrollment_mode: 'approval',
      metadata: { generatedBy: 'gemini' },
    })
    .select('id')
    .single()
  if (error || !course) throw new Error(error?.message || 'Could not create course')

  const moduleIds: string[] = []
  for (let i = 0; i < opts.outline.modules.length; i++) {
    const mod = opts.outline.modules[i]
    const { data: moduleRow, error: modErr } = await service
      .from('modules')
      .insert({
        course_id: course.id,
        title: mod.title,
        description: mod.description || null,
        order_index: i,
        is_published: false,
      })
      .select('id')
      .single()
    if (modErr || !moduleRow) continue
    moduleIds.push(moduleRow.id)
    for (let j = 0; j < (mod.lessons || []).length; j++) {
      const les = mod.lessons[j]
      await service.from('lessons').insert({
        module_id: moduleRow.id,
        title: les.title,
        description: les.description || null,
        content: [],
        order_index: j,
        is_published: false,
        duration_minutes: 10,
        resources: [],
      })
    }
  }

  return { courseId: course.id as string, moduleIds }
}

export async function persistFilledLesson(
  service: Service,
  opts: {
    lessonId: string
    courseId: string
    instructorId: string
    filled: FilledLesson
  }
) {
  const ids: { quizId?: string; assignmentId?: string; scenarioId?: string; deckId?: string } = {}
  const resources: any[] = []

  if (opts.filled.quiz?.questions?.length) {
    const { data: quizRow } = await service
      .from('quizzes')
      .insert({
        lesson_id: opts.lessonId,
        title: opts.filled.quiz.title || 'Lesson quiz',
        passing_score: 70,
        max_attempts: 3,
        is_published: true,
      })
      .select('id')
      .single()
    if (quizRow) {
      ids.quizId = quizRow.id
      await service.from('quiz_questions').insert(
        opts.filled.quiz.questions.map((q, i) => ({
          quiz_id: quizRow.id,
          question_text: q.question,
          question_type: 'multiple_choice',
          options: JSON.stringify(
            (q.options || []).map((text, idx) => ({
              text,
              is_correct: idx === q.correctIndex,
            }))
          ),
          correct_answer: q.options?.[q.correctIndex] || '',
          explanation: q.explanation || null,
          order_index: i,
          points: 1,
        }))
      )
      resources.push({
        id: crypto.randomUUID(),
        activity: 'quiz',
        title: opts.filled.quiz.title || 'Quiz',
        quizId: quizRow.id,
        createdAt: new Date().toISOString(),
      })
    }
  }

  if (opts.filled.assignment) {
    const { data: assignment } = await service
      .from('assignments')
      .insert({
        lesson_id: opts.lessonId,
        title: opts.filled.assignment.title,
        description: opts.filled.assignment.instructions,
        instructions: opts.filled.assignment.instructions,
        max_points: opts.filled.assignment.maxPoints || 100,
        is_published: true,
      })
      .select('id')
      .single()
    if (assignment) {
      ids.assignmentId = assignment.id
      resources.push({
        id: crypto.randomUUID(),
        activity: 'assignment',
        title: opts.filled.assignment.title,
        createdAt: new Date().toISOString(),
      })
    }
  }

  if (opts.filled.scenario?.nodes?.length) {
    const { data: scenario } = await service
      .from('lesson_scenarios')
      .insert({
        lesson_id: opts.lessonId,
        title: opts.filled.scenario.title || 'Practice scenario',
        nodes: opts.filled.scenario.nodes,
        is_published: true,
      })
      .select('id')
      .single()
    if (scenario) ids.scenarioId = scenario.id
  }

  if (opts.filled.flashcards?.length) {
    const { data: deck } = await service
      .from('flashcard_decks')
      .insert({
        course_id: opts.courseId,
        lesson_id: opts.lessonId,
        instructor_id: opts.instructorId,
        title: `${opts.filled.title} flashcards`,
        is_published: true,
      })
      .select('id')
      .single()
    if (deck) {
      ids.deckId = deck.id
      await service.from('flashcards').insert(
        opts.filled.flashcards.map((card, i) => ({
          deck_id: deck.id,
          front: card.front,
          back: card.back,
          order_index: i,
        }))
      )
    }
  }

  const content = blocksFromFilledLesson(opts.filled, ids)
  await service
    .from('lessons')
    .update({
      description: opts.filled.description || null,
      content,
      duration_minutes: opts.filled.durationMinutes || 12,
      resources,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.lessonId)

  return { content, ...ids }
}
