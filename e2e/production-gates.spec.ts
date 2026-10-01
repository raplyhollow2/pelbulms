import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import {
  cleanupFixture,
  getServiceClient,
  seedEnrollmentFixture,
  TEST_PASSWORD,
  type Fixture,
} from './helpers/seed'
import { loginWithPassword } from './helpers/auth'

test.describe.configure({ mode: 'serial' })

let fixture: Fixture
let courseId = ''
let moduleId = ''
let lessonId = ''
let quizId = ''

function userClient(accessToken: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function tokenFor(email: string) {
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  if (error || !data.session) throw new Error(error?.message || 'no session')
  return data.session.access_token
}

test.beforeAll(async () => {
  fixture = await seedEnrollmentFixture()
})

test.afterAll(async () => {
  const admin = getServiceClient()
  if (quizId) await admin.from('quiz_attempts').delete().eq('quiz_id', quizId)
  if (quizId) await admin.from('quiz_questions').delete().eq('quiz_id', quizId)
  if (quizId) await admin.from('quizzes').delete().eq('id', quizId)
  if (lessonId) await admin.from('lesson_progress').delete().eq('lesson_id', lessonId)
  if (lessonId) await admin.from('lessons').delete().eq('id', lessonId)
  if (moduleId) await admin.from('modules').delete().eq('id', moduleId)
  if (courseId) await admin.from('courses').delete().eq('id', courseId)
  await cleanupFixture(fixture)
})

test('instructor can create a blank course and a student cannot change it or their role', async ({ browser }) => {
  test.setTimeout(90_000)
  const context = await browser.newContext()
  await loginWithPassword(context, fixture.owner.email, TEST_PASSWORD)
  const page = await context.newPage()
  const created = await page.request.post('/api/teach/courses', {
    data: { title: `E2E blank ${fixture.runId}`, category: 'Testing' },
  })
  const body = await created.json()
  expect(created.ok(), JSON.stringify(body)).toBe(true)
  courseId = body.id

  const admin = getServiceClient()
  const { data: module, error: moduleError } = await admin
    .from('modules')
    .insert({ course_id: courseId, title: 'Module 1', order_index: 0 })
    .select('id')
    .single()
  if (moduleError || !module) throw new Error(moduleError?.message || 'module')
  moduleId = module.id
  const { data: lesson, error: lessonError } = await admin
    .from('lessons')
    .insert({
      module_id: moduleId,
      title: 'Lesson 1',
      order_index: 0,
      is_published: true,
      content: 'Lesson body',
    })
    .select('id')
    .single()
  if (lessonError || !lesson) throw new Error(lessonError?.message || 'lesson')
  lessonId = lesson.id

  const studentToken = await tokenFor(fixture.students[0].email)
  const student = userClient(studentToken)
  const { data: updated, error: updateError } = await student
    .from('courses')
    .update({ title: 'taken over' })
    .eq('id', courseId)
    .select('id')
  expect(updateError || (updated || []).length === 0).toBeTruthy()
  const { data: still } = await admin.from('courses').select('title').eq('id', courseId).single()
  expect(still?.title).toBe(`E2E blank ${fixture.runId}`)

  const { error: roleError } = await student
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', fixture.students[0].id)
  expect(roleError).toBeTruthy()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', fixture.students[0].id).single()
  expect(profile?.role).toBe('student')

  const { data: hidden } = await student.from('quiz_questions').select('correct_answer').limit(1)
  expect(hidden || []).toEqual([])
  await context.close()
})

test('server grading ignores a client-supplied score and stores lesson progress', async ({ browser }) => {
  test.setTimeout(90_000)
  const admin = getServiceClient()
  await admin.from('courses').update({ is_published: true }).eq('id', courseId)
  const { data: quiz, error: quizError } = await admin
    .from('quizzes')
    .insert({
      lesson_id: lessonId,
      title: 'Gate quiz',
      passing_score: 70,
      max_attempts: 3,
      is_published: true,
    })
    .select('id')
    .single()
  if (quizError || !quiz) throw new Error(quizError?.message || 'quiz')
  quizId = quiz.id
  const { data: question, error: questionError } = await admin
    .from('quiz_questions')
    .insert({
      quiz_id: quizId,
      question_text: 'Two plus two',
      question_type: 'multiple_choice',
      options: JSON.stringify([
        { text: '4', is_correct: true },
        { text: '5', is_correct: false },
      ]),
      correct_answer: '4',
      order_index: 0,
      points: 1,
    })
    .select('id')
    .single()
  if (questionError || !question) throw new Error(questionError?.message || 'question')

  await admin.from('enrollments').insert({
    user_id: fixture.students[0].id,
    course_id: courseId,
    status: 'active',
  })

  const context = await browser.newContext()
  await loginWithPassword(context, fixture.students[0].email, TEST_PASSWORD)
  const page = await context.newPage()
  const play = await page.request.get(`/api/quizzes/${quizId}/play`)
  const playBody = await play.json()
  expect(play.ok(), JSON.stringify(playBody)).toBe(true)
  expect(JSON.stringify(playBody.questions)).not.toContain('correct_answer')
  expect(JSON.stringify(playBody.questions)).not.toContain('is_correct')

  const attempt = await page.request.post(`/api/quizzes/${quizId}/attempts`, {
    data: {
      answers: { [question.id]: '5' },
      score: 100,
      passed: true,
    },
  })
  const attemptBody = await attempt.json()
  expect(attempt.ok(), JSON.stringify(attemptBody)).toBe(true)
  expect(attemptBody.passed).toBe(false)
  expect(attemptBody.attempt.score).toBe(0)

  const student = userClient(await tokenFor(fixture.students[0].email))
  const { data: progress, error: progressError } = await student
    .from('lesson_progress')
    .insert({
      user_id: fixture.students[0].id,
      lesson_id: lessonId,
      course_id: courseId,
      completed: true,
      progress_percentage: 100,
    })
    .select('id, completed')
    .single()
  expect(progressError, progressError?.message).toBeNull()
  expect(progress?.completed).toBe(true)
  await context.close()
})
