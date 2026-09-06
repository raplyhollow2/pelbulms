import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const FIXTURE_PATH = path.join(__dirname, '.fixture.json')

export const TEST_PASSWORD = 'PelbuE2E!Test2026'
export const RUN_ID = process.env.E2E_RUN_ID || `e2e${Date.now().toString(36)}`

export type TestUser = {
  id: string
  email: string
  full_name: string
  role: 'student' | 'instructor'
}

export type Fixture = {
  runId: string
  courseId: string
  courseTitle: string
  owner: TestUser
  coTeacher: TestUser
  students: TestUser[]
}

function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const val = m[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

export function getServiceClient(): SupabaseClient {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function ensureUser(
  admin: SupabaseClient,
  email: string,
  full_name: string,
  role: 'student' | 'instructor'
): Promise<TestUser> {
  let userId: string | undefined

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name, role },
  })

  if (data?.user) {
    userId = data.user.id
  } else if (error) {
    // Reuse if a previous run left the account (unique email collision)
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (!existing) throw new Error(`createUser ${email}: ${error.message}`)
    userId = existing.id
    await admin.auth.admin.updateUserById(userId, {
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name, role },
    })
  }

  if (!userId) throw new Error(`createUser ${email}: no user id`)

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      full_name,
      role,
      account_status: 'active',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (profileError) throw new Error(`profile upsert ${email}: ${profileError.message}`)

  return { id: userId, email, full_name, role }
}

export async function seedEnrollmentFixture(): Promise<Fixture> {
  const admin = getServiceClient()
  const runId = RUN_ID

  const owner = await ensureUser(
    admin,
    `owner.${runId}@pelbu-e2e.test`,
    `E2E Owner ${runId}`,
    'instructor'
  )
  const coTeacher = await ensureUser(
    admin,
    `coteacher.${runId}@pelbu-e2e.test`,
    `E2E CoTeacher ${runId}`,
    'instructor'
  )

  const students: TestUser[] = []
  for (let i = 1; i <= 5; i++) {
    students.push(
      await ensureUser(
        admin,
        `student${i}.${runId}@pelbu-e2e.test`,
        `E2E Student ${i} ${runId}`,
        'student'
      )
    )
  }

  const courseTitle = `E2E Enrollment Approval ${runId}`
  const slug = `e2e-enroll-${runId}`
  const { data: course, error: courseError } = await admin
    .from('courses')
    .insert({
      title: courseTitle,
      slug,
      description: 'Playwright enrollment approval fixture',
      category: 'Testing',
      level: 'beginner',
      instructor_id: owner.id,
      is_published: true,
      enrollment_mode: 'approval',
      price: 0,
    })
    .select('id, title')
    .single()

  if (courseError || !course) throw new Error(`course create: ${courseError?.message}`)

  await admin.from('course_instructors').upsert(
    [
      { course_id: course.id, user_id: owner.id, role: 'owner', invited_by: owner.id },
      { course_id: course.id, user_id: coTeacher.id, role: 'co_teacher', invited_by: owner.id },
    ],
    { onConflict: 'course_id,user_id' }
  )

  // Clear any prior enrollments for these students on this course
  await admin
    .from('enrollments')
    .delete()
    .eq('course_id', course.id)
    .in(
      'user_id',
      students.map((s) => s.id)
    )

  const fixture: Fixture = {
    runId,
    courseId: course.id,
    courseTitle: course.title,
    owner,
    coTeacher,
    students,
  }
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2))
  return fixture
}

export function readFixture(): Fixture {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error('Missing e2e/.fixture.json — run seed first')
  }
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as Fixture
}

export async function cleanupFixture(fixture?: Fixture) {
  const data = fixture || (fs.existsSync(FIXTURE_PATH) ? readFixture() : null)
  if (!data) return
  const admin = getServiceClient()

  await admin.from('enrollments').delete().eq('course_id', data.courseId)
  await admin.from('course_instructors').delete().eq('course_id', data.courseId)
  await admin.from('courses').delete().eq('id', data.courseId)

  const users = [data.owner, data.coTeacher, ...data.students]
  for (const u of users) {
    await admin.auth.admin.deleteUser(u.id).catch(() => {})
  }

  if (fs.existsSync(FIXTURE_PATH)) fs.unlinkSync(FIXTURE_PATH)
}
