import { test, expect } from '@playwright/test'
import {
  cleanupTeachingKycFixture,
  seedTeachingKycFixture,
  TEST_PASSWORD,
  type TeachingKycFixture,
} from './helpers/seed'
import { loginWithPassword } from './helpers/auth'

test.describe.configure({ mode: 'serial' })

let fixture: TeachingKycFixture

test.beforeAll(async () => {
  fixture = await seedTeachingKycFixture()
})

test.afterAll(async () => {
  await cleanupTeachingKycFixture(fixture)
})

test('resource person cannot approve an instructor KYC application', async ({ browser }) => {
  test.setTimeout(60_000)
  const context = await browser.newContext()
  await loginWithPassword(context, fixture.resourcePerson.email, TEST_PASSWORD)
  const page = await context.newPage()
  const res = await page.request.post('/api/admin/approvals', {
    data: {
      action: 'approve',
      registrationId: fixture.registrationId,
      assignedRole: 'instructor',
    },
  })
  const body = await res.json().catch(() => ({}))
  expect(res.status()).toBe(400)
  expect(String(body.message || body.error || '')).toMatch(/superadmin/i)
  await context.close()
})

test('superadmin can approve an instructor KYC application', async ({ browser }) => {
  test.setTimeout(60_000)
  const context = await browser.newContext()
  await loginWithPassword(context, fixture.superadmin.email, TEST_PASSWORD)
  const page = await context.newPage()
  const res = await page.request.post('/api/admin/approvals', {
    data: {
      action: 'approve',
      registrationId: fixture.registrationId,
      assignedRole: 'instructor',
    },
  })
  const body = await res.json().catch(() => ({}))
  expect(res.ok(), `${res.status()} ${JSON.stringify(body)}`).toBe(true)
  expect(body.result?.assigned_role || body.result?.assignedRole).toBe('instructor')
  await context.close()
})
