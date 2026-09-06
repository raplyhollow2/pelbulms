import type { BrowserContext, Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createChunks, stringToBase64URL } from '@supabase/ssr'
import fs from 'fs'
import path from 'path'

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

function projectRef() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return new URL(url).hostname.split('.')[0]
}

/** Sign in with password and inject Supabase SSR cookies into the browser context. */
export async function loginWithPassword(
  context: BrowserContext,
  email: string,
  password: string
) {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`signIn failed for ${email}: ${error?.message}`)
  }

  // Keep cookie payload small — full session JSON exceeds typical Cookie header
  // limits and causes Next ("socket hang up") under Playwright.
  const s = data.session
  const compact = {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at,
    expires_in: s.expires_in,
    token_type: s.token_type,
    user: {
      id: s.user.id,
      aud: s.user.aud,
      role: s.user.role,
      email: s.user.email,
      app_metadata: s.user.app_metadata ?? {},
      user_metadata: s.user.user_metadata ?? {},
    },
  }
  const sessionValue = JSON.stringify(compact)
  const encoded = `base64-${stringToBase64URL(sessionValue)}`
  const storageKey = `sb-${projectRef()}-auth-token`
  const chunks = createChunks(storageKey, encoded)

  await context.clearCookies()
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
  await context.addCookies(
    chunks.map(({ name, value }) => ({
      name,
      value,
      url: baseURL,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    }))
  )
}

export async function enrollViaApi(page: Page, courseId: string) {
  const res = await page.request.post('/api/enrollments', {
    data: { courseId },
    timeout: 60_000,
    failOnStatusCode: false,
  })
  const text = await res.text()
  let body: Record<string, unknown> = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text.slice(0, 500) }
  }
  return { ok: res.ok(), status: res.status(), body }
}

export async function listEnrollmentRequestsViaApi(page: Page) {
  const res = await page.request.get('/api/teach/enrollment-requests', { timeout: 60_000 })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok(), status: res.status(), body }
}

export async function decideEnrollmentViaApi(
  page: Page,
  enrollmentId: string,
  action: 'approve' | 'reject'
) {
  const res = await page.request.patch('/api/teach/enrollments', {
    data: { enrollmentId, action },
    timeout: 60_000,
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok(), status: res.status(), body }
}
