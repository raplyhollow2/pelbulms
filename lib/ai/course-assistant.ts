import { parseLessonActivities, type LessonActivity } from '@/lib/lesson-activities'
import { parseLessonBlocks, readCourseAiMetadata } from '@/lib/lesson-blocks'

export const ASSISTANT_TASKS = [
  'chat',
  'recap_previous',
  'summarize_lesson',
  'summarize_notes',
  'worksheet',
  'document',
] as const

export type AssistantTask = (typeof ASSISTANT_TASKS)[number]

type QueryResult = { data: unknown; error: { message: string } | null }

type Query = {
  select: (columns?: string) => Query
  insert: (values: Record<string, unknown>) => Query
  update: (values: Record<string, unknown>) => Query
  delete: () => Query
  eq: (column: string, value: unknown) => Query
  in: (column: string, values: readonly string[]) => Query
  order: (column: string, options?: { ascending?: boolean }) => Query
  limit: (count: number) => Query
  maybeSingle: () => Promise<QueryResult>
  single: () => Promise<QueryResult>
  then: (
    onfulfilled?: (value: QueryResult) => unknown,
    onrejected?: (reason: unknown) => unknown
  ) => Promise<unknown>
}

export type AssistantDb = {
  from: (table: string) => Query
}

export function asAssistantDb(client: { from: (table: string) => unknown }): AssistantDb {
  return {
    from(table: string) {
      return client.from(table) as Query
    },
  }
}

type Row = Record<string, unknown>

function assertQuery(error: { message: string } | null) {
  if (error?.message) throw new Error(error.message)
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function rowsOf(data: unknown): Row[] {
  if (!Array.isArray(data)) return []
  return data.filter((item): item is Row => Boolean(item) && typeof item === 'object')
}

function rowOf(data: unknown): Row | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return data as Row
}

const LIMITS = {
  instructions: 2000,
  outline: 4000,
  lesson: 6000,
  previous: 3000,
  notes: 3000,
  worksheets: 4000,
  historyTurn: 1500,
  question: 4000,
}

const DEFAULT_QUESTION: Record<AssistantTask, string> = {
  chat: '',
  recap_previous: 'Can you give me a recap of the previous lecture?',
  summarize_lesson: 'Summarize this lesson',
  summarize_notes: 'Summarize my notes',
  worksheet: 'Build from my worksheet',
  document: 'Build a document from my saved work',
}

export function isAssistantTask(value: unknown): value is AssistantTask {
  return typeof value === 'string' && (ASSISTANT_TASKS as readonly string[]).includes(value)
}

function clip(text: string, max: number) {
  const value = String(text || '').replace(/[ \t]+\n/g, '\n').trim()
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

function lessonPlainText(lesson: Row) {
  const blocks = parseLessonBlocks(lesson?.content)
  const fromBlocks = blocks
    .map((block) => {
      if (block.type === 'text') return block.html
      if (block.type === 'flipcards') {
        return block.cards.map((card) => `${card.front} ${card.back}`).join('\n')
      }
      if (block.type === 'accordion') {
        return block.items.map((item) => `${item.title}\n${item.html}`).join('\n')
      }
      return ''
    })
    .join('\n')
    .replace(/<[^>]+>/g, ' ')
  return [text(lesson.title), text(lesson.description), fromBlocks, text(lesson.transcript)]
    .filter(Boolean)
    .join('\n')
}

function orderedLessons(modules: Row[], lessons: Row[]) {
  const rank = new Map<string, number>()
  modules.forEach((module, index) => {
    rank.set(text(module.id), typeof module.order_index === 'number' ? module.order_index : index)
  })
  return [...lessons].sort((a, b) => {
    const moduleDelta = (rank.get(text(a.module_id)) ?? 0) - (rank.get(text(b.module_id)) ?? 0)
    if (moduleDelta !== 0) return moduleDelta
    const aOrder = typeof a.order_index === 'number' ? a.order_index : 0
    const bOrder = typeof b.order_index === 'number' ? b.order_index : 0
    return aOrder - bOrder
  })
}

function worksheetFields(activity: LessonActivity, response: unknown, includeEmpty: boolean) {
  const saved =
    response && typeof response === 'object' && !Array.isArray(response)
      ? ((response as { fields?: unknown }).fields as Record<string, unknown> | undefined)
      : undefined
  const lines: string[] = []
  for (const field of activity.fields || []) {
    const rawValue = saved?.[field.id]
    const value = typeof rawValue === 'string' ? rawValue.trim() : ''
    if (!value && !includeEmpty) continue
    lines.push(`- ${field.label}: ${value || '(empty)'}`)
  }
  return lines.join('\n')
}

function hasFilledFields(activity: LessonActivity, response: unknown) {
  return Boolean(worksheetFields(activity, response, false))
}

function artifactKind(task: AssistantTask): 'summary' | 'document' | null {
  if (task === 'recap_previous' || task === 'summarize_lesson' || task === 'summarize_notes') {
    return 'summary'
  }
  if (task === 'worksheet' || task === 'document') return 'document'
  return null
}

function titleFromMarkdown(body: string, fallback: string) {
  const heading = body.match(/^#\s+(.+)$/m)
  return clip(heading?.[1] || fallback, 120)
}

async function ensureThread(db: AssistantDb, userId: string, courseId: string) {
  const { data: existing } = await db
    .from('ai_threads')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()
  const existingId = text(rowOf(existing)?.id)
  if (existingId) return existingId

  const { data: created, error } = await db
    .from('ai_threads')
    .insert({ user_id: userId, course_id: courseId })
    .select('id')
    .single()
  const createdId = text(rowOf(created)?.id)
  if (createdId) return createdId

  const { data: again, error: lookupError } = await db
    .from('ai_threads')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()
  const againId = text(rowOf(again)?.id)
  if (againId) return againId
  throw new Error(lookupError?.message || error?.message || 'Could not open the assistant thread')
}

async function persistTurn(
  db: AssistantDb,
  opts: {
    userId: string
    courseId: string
    lessonId?: string | null
    task: AssistantTask
    question: string
    answer: string
    artifact: { title: string; kind: 'summary' | 'document'; activityId?: string | null } | null
  }
) {
  const threadId = await ensureThread(db, opts.userId, opts.courseId)
  const { data: userMessage, error: userError } = await db
    .from('ai_messages')
    .insert({
      thread_id: threadId,
      role: 'user',
      content: opts.question,
      lesson_id: opts.lessonId || null,
      task: opts.task,
    })
    .select('id, role, content, lesson_id, task, created_at')
    .single()
  if (userError) throw new Error(userError.message)

  const { data: assistantMessage, error: assistantError } = await db
    .from('ai_messages')
    .insert({
      thread_id: threadId,
      role: 'assistant',
      content: opts.answer,
      lesson_id: opts.lessonId || null,
      task: opts.task,
    })
    .select('id, role, content, lesson_id, task, created_at')
    .single()
  if (assistantError) throw new Error(assistantError.message)

  let artifact = null
  if (opts.artifact) {
    const { data, error } = await db
      .from('ai_artifacts')
      .insert({
        user_id: opts.userId,
        course_id: opts.courseId,
        lesson_id: opts.lessonId || null,
        activity_id: opts.artifact.activityId || null,
        title: opts.artifact.title,
        kind: opts.artifact.kind,
        body_markdown: opts.answer,
      })
      .select('id, title, kind, body_markdown, lesson_id, activity_id, created_at')
      .single()
    if (error) throw new Error(error.message)
    artifact = data
  }

  await db.from('ai_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
  return { userMessage, assistantMessage, artifact }
}

export async function answerCourseTutor(
  db: AssistantDb,
  runText: (opts: { feature: 'tutor'; prompt: string; system?: string; userId: string }) => Promise<{ text: string }>,
  opts: {
    userId: string
    courseId: string
    lessonId?: string | null
    task: AssistantTask
    activityId?: string | null
    question?: string | null
  }
) {
  const question = clip(opts.question || DEFAULT_QUESTION[opts.task], LIMITS.question)
  if (!question) {
    return { ok: false as const, status: 400, error: 'Enter a question' }
  }
  if (opts.task === 'worksheet' && !opts.activityId) {
    return { ok: false as const, status: 400, error: 'Choose a worksheet' }
  }

  const [{ data: course }, { data: modules }, { data: noteRows }] = await Promise.all([
    db.from('courses').select('title, description, metadata').eq('id', opts.courseId).maybeSingle(),
    db.from('modules').select('id, title, order_index').eq('course_id', opts.courseId).order('order_index'),
    db
      .from('notes')
      .select('content')
      .eq('user_id', opts.userId)
      .eq('course_id', opts.courseId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(30),
  ])
  const courseRow = rowOf(course)
  const tutor = readCourseAiMetadata(courseRow?.metadata).tutor
  const name = tutor?.name || 'Course tutor'
  const instructions = clip(
    tutor?.instructions || 'Answer only from this course. If the question is off-topic, politely redirect.',
    LIMITS.instructions
  )

  const moduleRows = rowsOf(modules)
  const moduleIds = moduleRows.map((module) => text(module.id)).filter(Boolean)

  let lessonRows: Row[] = []
  if (moduleIds.length) {
    const { data: lessons } = await db
      .from('lessons')
      .select('id, title, description, content, resources, transcript, module_id, order_index')
      .in('module_id', moduleIds)
      .order('order_index')
    lessonRows = rowsOf(lessons)
  }
  const lessons = orderedLessons(moduleRows, lessonRows)
  const currentIndex = opts.lessonId
    ? lessons.findIndex((lesson) => text(lesson.id) === opts.lessonId)
    : -1
  const current = currentIndex >= 0 ? lessons[currentIndex] : null
  const previous = currentIndex > 0 ? lessons[currentIndex - 1] : null

  const outline = clip(
    moduleRows
      .map((module) => {
        const titles = lessons
          .filter((lesson) => text(lesson.module_id) === text(module.id))
          .map((lesson) => `- ${text(lesson.title)}`)
          .join('\n')
        return `${text(module.title)}\n${titles}`
      })
      .join('\n'),
    LIMITS.outline
  )

  const notes = clip(
    rowsOf(noteRows)
      .map((note) => text(note.content).trim())
      .filter(Boolean)
      .join('\n\n'),
    LIMITS.notes
  )

  const worksheetHits: {
    lessonTitle: string
    activity: LessonActivity
    response: unknown
  }[] = []
  if (lessons.length) {
    const { data: progressRows } = await db
      .from('lesson_activity_progress')
      .select('lesson_id, activity_id, response')
      .eq('user_id', opts.userId)
      .in(
        'lesson_id',
        lessons.map((lesson) => text(lesson.id)).filter(Boolean)
      )
    const progressByKey = new Map<string, unknown>()
    for (const row of rowsOf(progressRows)) {
      progressByKey.set(`${text(row.lesson_id)}:${text(row.activity_id)}`, row.response)
    }
    for (const lesson of lessons) {
      for (const activity of parseLessonActivities(lesson.resources)) {
        if (activity.activity !== 'worksheet') continue
        worksheetHits.push({
          lessonTitle: text(lesson.title),
          activity,
          response: progressByKey.get(`${text(lesson.id)}:${activity.id}`) ?? null,
        })
      }
    }
  }

  const targetWorksheet = opts.activityId
    ? worksheetHits.find((hit) => hit.activity.id === opts.activityId) || null
    : null

  let directAnswer = ''
  if (opts.task === 'recap_previous' && !previous) {
    directAnswer = 'This is the first lecture in the course, so there is no previous lecture to recap.'
  } else if (opts.task === 'summarize_lesson' && !current) {
    directAnswer = 'Open a lesson first, then ask me to summarize it.'
  } else if (opts.task === 'summarize_notes' && !notes) {
    directAnswer = 'You do not have saved notes in this course yet. Add notes on the Notes tab, then ask again.'
  } else if (opts.task === 'worksheet' && !targetWorksheet) {
    directAnswer = 'That worksheet is not on this course.'
  } else if (opts.task === 'worksheet' && targetWorksheet && !hasFilledFields(targetWorksheet.activity, targetWorksheet.response)) {
    directAnswer = `Fill in “${targetWorksheet.activity.title}” on the Resources tab first. I will use only what you write there.`
  }

  const threadId = await ensureThread(db, opts.userId, opts.courseId)
  const { data: historyRows } = await db
    .from('ai_messages')
    .select('role, content')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(12)
  const history = rowsOf(historyRows)
    .reverse()
    .map((row) => {
      const who = row.role === 'assistant' ? name : 'Student'
      return `${who}: ${clip(text(row.content), LIMITS.historyTurn)}`
    })
    .join('\n')

  const filledWorksheets = clip(
    worksheetHits
      .map((hit) => {
        const body = worksheetFields(hit.activity, hit.response, false)
        if (!body) return ''
        return `${hit.lessonTitle} — ${hit.activity.title}\n${body}`
      })
      .filter(Boolean)
      .join('\n\n'),
    LIMITS.worksheets
  )

  let answer = directAnswer
  if (!answer) {
    const taskBrief = taskInstruction(
      opts.task,
      targetWorksheet?.activity || null,
      previous ? { title: text(previous.title) } : null
    )
    const courseTitle = text(courseRow?.title)
    const courseDescription = text(courseRow?.description)
    const sections = [
      `Course: ${courseTitle || 'Course'}`,
      courseDescription ? `Description: ${clip(courseDescription, 1000)}` : '',
      outline ? `Outline:\n${outline}` : '',
      current ? `Current lesson:\n${clip(lessonPlainText(current), LIMITS.lesson)}` : '',
      opts.task === 'recap_previous' && previous
        ? `Previous lesson:\n${clip(lessonPlainText(previous), LIMITS.previous)}`
        : '',
      notes ? `Student notes:\n${notes}` : 'Student notes: none saved.',
      filledWorksheets
        ? `Filled worksheets:\n${filledWorksheets}`
        : 'Filled worksheets: none saved.',
      opts.task === 'worksheet' && targetWorksheet
        ? `Worksheet to use (${targetWorksheet.activity.title}):\n${targetWorksheet.activity.aiBrief || 'Use only the student answers. Mark empty fields instead of inventing facts.'}\n${worksheetFields(targetWorksheet.activity, targetWorksheet.response, true)}`
        : '',
      history ? `Recent conversation:\n${history}` : '',
      `Student request: ${question}`,
      taskBrief,
    ].filter(Boolean)

    const result = await runText({
      feature: 'tutor',
      userId: opts.userId,
      system: `You are ${name}, the AI tutor for this Pelbu LMS course.
${instructions}
Use the course materials, the student's notes, and their worksheet answers. Never invent notes or worksheet answers. If a field or note is missing, say so.`,
      prompt: sections.join('\n\n'),
    })
    answer = result.text.trim()
    if (!answer) {
      return { ok: false as const, status: 502, error: 'The tutor returned an empty answer' }
    }
  }

  const kind = directAnswer ? null : artifactKind(opts.task)
  const fallbackTitle =
    opts.task === 'worksheet' && targetWorksheet
      ? targetWorksheet.activity.title
      : opts.task === 'recap_previous'
        ? 'Recap of the previous lecture'
        : opts.task === 'summarize_lesson'
          ? 'Lesson summary'
          : opts.task === 'summarize_notes'
            ? 'Notes summary'
            : 'Study document'

  const saved = await persistTurn(db, {
    userId: opts.userId,
    courseId: opts.courseId,
    lessonId: text(current?.id) || null,
    task: opts.task,
    question,
    answer,
    artifact: kind
      ? {
          kind,
          title: titleFromMarkdown(answer, fallbackTitle),
          activityId: opts.activityId,
        }
      : null,
  })

  return {
    ok: true as const,
    answer,
    tutorName: name,
    userMessage: saved.userMessage,
    assistantMessage: saved.assistantMessage,
    artifact: saved.artifact,
  }
}

function taskInstruction(
  task: AssistantTask,
  worksheet: LessonActivity | null,
  previous: { title?: string } | null
) {
  if (task === 'recap_previous') {
    return `Recap the previous lecture${previous?.title ? ` (“${previous.title}”)` : ''}. Keep it short and tied to that lesson.`
  }
  if (task === 'summarize_lesson') {
    return 'Summarize the current lesson for a student who just watched or read it. Start with a markdown heading.'
  }
  if (task === 'summarize_notes') {
    return 'Summarize the student notes above. Do not add facts that are not in the notes or the current lesson. Start with a markdown heading.'
  }
  if (task === 'worksheet') {
    return `Follow the worksheet brief for “${worksheet?.title || 'this template'}”. Start with a markdown heading. Use only the written answers and mark empty fields.`
  }
  if (task === 'document') {
    return 'Write a study document the student can keep. Start with a markdown heading as the title. Use their notes and worksheet answers. If there is not enough saved input, say what is missing instead of inventing it.'
  }
  return 'Answer the student request. If it is outside this course, redirect them back to the lesson.'
}

export async function loadAssistantState(db: AssistantDb, userId: string, courseId: string) {
  const threadResult = await db
    .from('ai_threads')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()
  assertQuery(threadResult.error)
  const threadId = text(rowOf(threadResult.data)?.id)

  const [messagesResult, promptsResult, artifactsResult] = await Promise.all([
    threadId
      ? db
          .from('ai_messages')
          .select('id, role, content, lesson_id, task, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true })
          .limit(100)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    db
      .from('ai_saved_prompts')
      .select('id, text, created_at')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('ai_artifacts')
      .select('id, title, kind, body_markdown, lesson_id, activity_id, created_at')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  assertQuery(messagesResult.error ?? null)
  assertQuery(promptsResult.error ?? null)
  assertQuery(artifactsResult.error ?? null)

  return {
    messages: rowsOf(messagesResult.data),
    savedPrompts: rowsOf(promptsResult.data),
    artifacts: rowsOf(artifactsResult.data),
  }
}
