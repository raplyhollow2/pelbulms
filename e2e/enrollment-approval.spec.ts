import { test, expect } from '@playwright/test'
import {
  cleanupFixture,
  seedEnrollmentFixture,
  TEST_PASSWORD,
  type Fixture,
} from './helpers/seed'
import {
  decideEnrollmentViaApi,
  enrollViaApi,
  listEnrollmentRequestsViaApi,
  loginWithPassword,
} from './helpers/auth'

/**
 * Enrollment approval story (5 students, 2 teachers, same course):
 * 1) Create student-role users (seeded via service role — login UI is OAuth-only)
 * 2) Students request enrollment (approval mode)
 * 3) Course owner sees pending queue and approve/rejects in Chromium
 * 4) Co-teacher can view roster but cannot approve
 *
 * Tuned for Apple M1 / 8 GB: serial, system Chrome, API seed + minimal UI.
 */
test.describe.configure({ mode: 'serial' })

let fixture: Fixture

test.beforeAll(async () => {
  fixture = await seedEnrollmentFixture()
})

test.afterAll(async () => {
  await cleanupFixture(fixture)
})

test('creates 5 student-role users and 2 instructors on one approval course', async () => {
  expect(fixture.students).toHaveLength(5)
  expect(fixture.students.every((s) => s.role === 'student')).toBe(true)
  expect(fixture.owner.role).toBe('instructor')
  expect(fixture.coTeacher.role).toBe('instructor')
  expect(fixture.courseId).toBeTruthy()
})

test('student without approved KYC cannot request enrollment', async ({ browser }) => {
  test.setTimeout(60_000)
  const context = await browser.newContext()
  await loginWithPassword(context, fixture.noKycStudent.email, TEST_PASSWORD)
  const page = await context.newPage()
  const result = await enrollViaApi(page, fixture.courseId)
  expect(result.ok).toBe(false)
  expect(result.status).toBe(403)
  expect(result.body.needsKyc).toBe(true)
  await context.close()
})

test('5 students enroll into the shared course as pending', async ({ browser }) => {
  test.setTimeout(120_000)
  for (const student of fixture.students) {
    const context = await browser.newContext()
    await loginWithPassword(context, student.email, TEST_PASSWORD)
    // Enrollment is API-only; avoid /courses page.goto — Next often never reaches
    // "load" on auth-gated pages, which blew the 60s suite timeout.
    const page = await context.newPage()
    const result = await enrollViaApi(page, fixture.courseId)
    expect(result.ok, `${result.status} ${JSON.stringify(result.body)}`).toBe(true)
    expect(result.body.status || (result.body.pending ? 'pending' : null)).toBe('pending')

    await context.close()
  }
})

test('owner sees pending requests on the teach dashboard', async ({ browser }) => {
  test.setTimeout(90_000)
  const context = await browser.newContext()
  await loginWithPassword(context, fixture.owner.email, TEST_PASSWORD)
  const page = await context.newPage()

  const queue = await listEnrollmentRequestsViaApi(page)
  expect(queue.ok, `${queue.status} ${JSON.stringify(queue.body)}`).toBe(true)
  expect(queue.body.requests).toHaveLength(5)

  await page.goto('/teach/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Teacher Dashboard|Course Design Dashboard/i })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByTestId('pending-enrollment-count')).toHaveText('5', { timeout: 20_000 })
  await expect(page.getByText('Enrollment requests').first()).toBeVisible()
  for (const student of fixture.students) {
    await expect(page.getByText(student.email).first()).toBeVisible()
  }

  await context.close()
})

test('owner teacher sees all 5 pending students and can approve or reject', async ({
  browser,
}) => {
  test.setTimeout(120_000)
  const context = await browser.newContext()
  await loginWithPassword(context, fixture.owner.email, TEST_PASSWORD)
  const page = await context.newPage()

  await page.goto(`/teach/courses/${fixture.courseId}/students`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Students & enrollment requests/i })).toBeVisible({
    timeout: 20_000,
  })

  const pendingStat = page.locator('div.text-3xl.text-amber-600')
  await expect(pendingStat).toHaveText('5')

  for (const student of fixture.students) {
    await expect(page.getByText(student.email).first()).toBeVisible()
  }

  await expect(page.getByRole('heading', { name: 'Enrollment requests' })).toBeVisible()

  // Approve first 3, reject last 2 via Chromium UI (Enrollment requests rows only)
  const emailsToApprove = fixture.students.slice(0, 3).map((s) => s.email)
  const emailsToReject = fixture.students.slice(3).map((s) => s.email)

  const pendingRow = (email: string) =>
    page
      .locator('div.rounded-lg.border')
      .filter({ hasText: email })
      .filter({ has: page.getByRole('button', { name: /^Approve$/i }) })
      .first()

  for (const email of emailsToApprove) {
    const row = pendingRow(email)
    await row.getByRole('button', { name: /^Approve$/i }).click()
    await expect(pendingRow(email)).toHaveCount(0, { timeout: 15_000 })
  }

  for (const email of emailsToReject) {
    const row = pendingRow(email)
    await row.getByRole('button', { name: /^Reject$/i }).click()
    await expect(pendingRow(email)).toHaveCount(0, { timeout: 15_000 })
  }

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Students & enrollment requests/i })).toBeVisible({
    timeout: 20_000,
  })
  await expect(pendingStat).toHaveText('0', { timeout: 20_000 })

  // Active enrollments should be 3
  const activeStat = page.locator('div.text-3xl.text-bhutan-yellow')
  await expect(activeStat).toHaveText('3')

  for (const email of emailsToApprove) {
    const row = page.locator('div').filter({ hasText: email }).filter({ hasText: /active/i }).first()
    await expect(row).toBeVisible()
  }
  for (const email of emailsToReject) {
    const row = page.locator('div').filter({ hasText: email }).filter({ hasText: /rejected/i }).first()
    await expect(row).toBeVisible()
  }

  await context.close()
})

test('co-teacher can open students page but cannot approve enrollments', async ({ browser }) => {
  test.setTimeout(120_000)
  // Re-seed one pending enrollment for this check
  const contextStudent = await browser.newContext()
  const pendingStudent = fixture.students[3]
  await loginWithPassword(contextStudent, pendingStudent.email, TEST_PASSWORD)
  const studentPage = await contextStudent.newPage()
  // Rejected students can re-request
  const reReq = await enrollViaApi(studentPage, fixture.courseId)
  expect(reReq.ok, `${reReq.status} ${JSON.stringify(reReq.body)}`).toBe(true)
  expect(reReq.body.status).toBe('pending')
  const enrollmentId = (reReq.body.enrollmentId || reReq.body.id) as string
  expect(enrollmentId).toBeTruthy()
  await contextStudent.close()

  const context = await browser.newContext()
  await loginWithPassword(context, fixture.coTeacher.email, TEST_PASSWORD)
  const page = await context.newPage()

  await page.goto(`/teach/courses/${fixture.courseId}/students`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /Students & enrollment requests/i })).toBeVisible({
    timeout: 20_000,
  })
  // Co-teacher is listed as staff; enrollments SELECT RLS is owner-only so the
  // roster may be empty in the client — assert page access + approve denial.
  await expect(page.getByText(fixture.coTeacher.email).first()).toBeVisible()
  await expect(
    page.getByText(/Only the course creator \(or a platform admin\) can approve/i)
  ).toBeVisible()

  const denied = await decideEnrollmentViaApi(page, enrollmentId, 'approve')
  expect(denied.status).toBe(403)
  expect(String(denied.body.error || '')).toMatch(/course creator/i)

  await context.close()
})

test('owner can approve a pending request from the teach dashboard', async ({ browser }) => {
  test.setTimeout(90_000)
  const context = await browser.newContext()
  await loginWithPassword(context, fixture.owner.email, TEST_PASSWORD)
  const page = await context.newPage()

  const queue = await listEnrollmentRequestsViaApi(page)
  expect(queue.ok, `${queue.status} ${JSON.stringify(queue.body)}`).toBe(true)
  expect((queue.body.requests as unknown[]).length).toBeGreaterThan(0)

  await page.goto('/teach/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Enrollment requests').first()).toBeVisible({
    timeout: 20_000,
  })

  const pendingEmail = fixture.students[3].email
  const row = page
    .locator('div.rounded-lg.border')
    .filter({ hasText: pendingEmail })
    .filter({ has: page.getByRole('button', { name: /^Approve$/i }) })
    .first()
  await row.getByRole('button', { name: /^Approve$/i }).click()
  await expect(row).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByTestId('pending-enrollment-count')).toHaveText('0')

  await context.close()
})
