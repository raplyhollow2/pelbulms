import type { SupabaseClient } from '@supabase/supabase-js'
import { DZONGKHAGS, normalizeDzongkhag } from '@/lib/dzongkhags'
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/lib/roles'
import { REPORT_SECTIONS } from '@/lib/reports/catalog'
import { courseRosterHref, institutionCatalogHref } from '@/lib/reports/action-links'
import type {
  FunnelStep,
  ReportBlock,
  ReportBreakdown,
  ReportId,
  ReportRow,
  ReportSectionPayload,
  ReportSnapshot,
} from '@/lib/reports/types'

type Db = SupabaseClient<any>

const PROFILE_COLUMNS =
  'id, gender, date_of_birth, education_level, location, class_name, gewog, institution_id, role, account_status'

const COUNT_COLUMNS = [
  { key: 'category', label: 'Category' },
  { key: 'count', label: 'Learners' },
  { key: 'share', label: 'Share' },
]

const NOT_SPECIFIED = 'Not specified'
const UNRECOGNIZED = 'Unrecognized'
const OTHER_GEWOGS = 'Other gewogs'
const NO_INSTITUTION = 'No institution'
const GEWOG_LIMIT = 12

const AGE_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: 'under-13', label: 'Under 13', min: 0, max: 12 },
  { key: '13-17', label: '13–17', min: 13, max: 17 },
  { key: '18-24', label: '18–24', min: 18, max: 24 },
  { key: '25-34', label: '25–34', min: 25, max: 34 },
  { key: '35-44', label: '35–44', min: 35, max: 44 },
  { key: '45-54', label: '45–54', min: 45, max: 54 },
  { key: '55-plus', label: '55+', min: 55, max: 120 },
]

const GENDER_ORDER = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
  { key: 'not-specified', label: NOT_SPECIFIED },
] as const

const STATUS_ORDER = [
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'rejected', label: 'Rejected' },
] as const

export interface LearnerDemographicsResult {
  section: ReportSectionPayload
  breakdowns: ReportBreakdown[]
  tables: ReportSnapshot['tables']
}

interface ProfileRow {
  id: string
  gender: string | null
  date_of_birth: string | null
  education_level: string | null
  location: string | null
  class_name: string | null
  gewog: string | null
  institution_id: string | null
  role: string | null
  account_status: string | null
}

interface CountRow {
  id: string
  label: string
  count: number
}

function blankProfile(id: string): ProfileRow {
  return {
    id,
    gender: null,
    date_of_birth: null,
    education_level: null,
    location: null,
    class_name: null,
    gewog: null,
    institution_id: null,
    role: null,
    account_status: null,
  }
}

function share(count: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((count / total) * 100)}%`
}

function cleanText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function ageInYears(dob: string | null, today = new Date()): number | null {
  const iso = cleanText(dob).slice(0, 10)
  if (!iso) return null
  const born = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(born.getTime())) return null
  let age = today.getFullYear() - born.getFullYear()
  const month = today.getMonth() - born.getMonth()
  if (month < 0 || (month === 0 && today.getDate() < born.getDate())) age -= 1
  if (age < 0 || age > 120) return null
  return age
}

function ageBandKey(dob: string | null) {
  const age = ageInYears(dob)
  if (age == null) return 'not-specified'
  const band = AGE_BANDS.find((b) => age >= b.min && age <= b.max)
  return band?.key || 'not-specified'
}

function genderKey(value: string | null) {
  const v = cleanText(value).toLowerCase()
  if (v === 'male' || v === 'female' || v === 'other') return v
  return 'not-specified'
}

function dzongkhagKey(value: string | null) {
  const normalized = normalizeDzongkhag(value)
  if (normalized) return normalized
  if (cleanText(value)) return 'unrecognized'
  return 'not-specified'
}

function statusKey(value: string | null) {
  const v = cleanText(value).toLowerCase()
  if (STATUS_ORDER.some((s) => s.key === v)) return v
  return v || 'not-specified'
}

function statusLabel(key: string) {
  const known = STATUS_ORDER.find((s) => s.key === key)
  if (known) return known.label
  if (key === 'not-specified') return NOT_SPECIFIED
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function roleKey(value: string | null) {
  const v = cleanText(value).toLowerCase()
  if ((USER_ROLES as string[]).includes(v)) return v
  return v || 'not-specified'
}

function roleLabel(key: string) {
  if ((USER_ROLES as string[]).includes(key)) return ROLE_LABELS[key as UserRole]
  if (key === 'not-specified') return NOT_SPECIFIED
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function chartLabel(label: string) {
  return label.length > 28 ? `${label.slice(0, 26)}…` : label
}

function groupedText(values: Array<string | null | undefined>): CountRow[] {
  const groups = new Map<string, { label: string; count: number }>()
  for (const raw of values) {
    const text = cleanText(raw)
    const label = !text || text.toLowerCase() === 'not specified' ? NOT_SPECIFIED : text
    const key = label.toLowerCase()
    const existing = groups.get(key)
    if (existing) existing.count += 1
    else groups.set(key, { label, count: 1 })
  }
  return [...groups.entries()]
    .map(([id, row]) => ({ id, label: row.label, count: row.count }))
    .sort((a, b) => {
      if (a.label === NOT_SPECIFIED) return 1
      if (b.label === NOT_SPECIFIED) return -1
      return b.count - a.count || a.label.localeCompare(b.label)
    })
}

function withNotSpecified(rows: CountRow[], total: number) {
  const named = rows.filter((r) => r.label !== NOT_SPECIFIED && r.count > 0)
  const missing = total - named.reduce((sum, r) => sum + r.count, 0)
  if (missing > 0 || named.length === 0) {
    named.push({ id: 'not-specified', label: NOT_SPECIFIED, count: Math.max(0, missing) })
  }
  return named
}

function topGroups(rows: CountRow[], limit: number, otherLabel: string) {
  const named = rows.filter((r) => r.label !== NOT_SPECIFIED && r.count > 0)
  const missing = rows.find((r) => r.label === NOT_SPECIFIED)
  const head = named.slice(0, limit)
  const rest = named.slice(limit)
  const result = [...head]
  const restCount = rest.reduce((sum, r) => sum + r.count, 0)
  if (restCount > 0) {
    result.push({ id: 'other', label: otherLabel, count: restCount })
  }
  if (missing && missing.count > 0) result.push(missing)
  if (result.length === 0) {
    result.push({ id: 'not-specified', label: NOT_SPECIFIED, count: 0 })
  }
  return result
}

function countMap(rows: CountRow[]) {
  return new Map(rows.map((r) => [r.id, r.count]))
}

function rowsFromOrder(
  order: readonly { key: string; label: string }[],
  counts: Map<string, number>,
  extras: CountRow[] = []
): CountRow[] {
  const fixed = order.map((item) => ({
    id: item.key,
    label: item.label,
    count: counts.get(item.key) || 0,
  }))
  const extraRows = extras.filter((r) => r.count > 0 && !order.some((item) => item.key === r.id))
  return [...fixed, ...extraRows]
}

function toTableRows(rows: CountRow[], total: number): ReportRow[] {
  return rows.map((r) => ({
    id: r.id,
    cells: {
      category: r.label,
      count: r.count,
      share: share(r.count, total),
    },
  }))
}

function toSteps(rows: CountRow[]) {
  return rows.map((r) => ({
    key: r.id,
    label: chartLabel(r.label),
    count: r.count,
  }))
}

function countBlock(opts: {
  id: ReportId
  title: string
  description: string
  total: number
  known: number
  knownLabel: string
  rows: CountRow[]
  totalLabel?: string
}): ReportBlock {
  return {
    id: opts.id,
    title: opts.title,
    description: opts.description,
    metrics: [
      { key: 'learners', label: opts.totalLabel || 'Learners', value: opts.total },
      {
        key: 'known',
        label: opts.knownLabel,
        value: share(opts.known, opts.total),
      },
    ],
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'count', label: opts.totalLabel || 'Learners' },
      { key: 'share', label: 'Share' },
    ],
    rows: toTableRows(opts.rows, opts.total),
    emptyMessage: opts.total === 0 ? 'No learners in this scope yet.' : undefined,
  }
}

function breakdown(key: string, title: string, description: string, rows: CountRow[]): ReportBreakdown {
  return { key, title, description, steps: toSteps(rows) }
}

function tableFromBlock(block: ReportBlock): ReportSnapshot['tables'][number] {
  return {
    key: block.id,
    title: block.title,
    columns: block.columns || COUNT_COLUMNS,
    rows: block.rows || [],
  }
}

async function fetchProfiles(db: Db, userIds?: string[]): Promise<ProfileRow[]> {
  if (userIds) {
    const ids = [...new Set(userIds.filter(Boolean))]
    const rows: ProfileRow[] = []
    for (let i = 0; i < ids.length; i += 100) {
      const slice = ids.slice(i, i + 100)
      const { data, error } = await db.from('profiles').select(PROFILE_COLUMNS).in('id', slice)
      if (error) throw new Error(error.message)
      rows.push(...((data || []) as ProfileRow[]))
    }
    const byId = new Map(rows.map((row) => [row.id, row]))
    return ids.map((id) => byId.get(id) || blankProfile(id))
  }

  const rows: ProfileRow[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = (data || []) as ProfileRow[]
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

async function institutionNames(db: Db, ids: string[]) {
  const names = new Map<string, string>()
  const unique = [...new Set(ids.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 100) {
    const slice = unique.slice(i, i + 100)
    const { data, error } = await db
      .from('institutions')
      .select('id, name, display_name')
      .in('id', slice)
    if (error) throw new Error(error.message)
    for (const row of (data || []) as Array<{ id: string; name: string | null; display_name: string | null }>) {
      names.set(row.id, cleanText(row.display_name) || cleanText(row.name) || 'Institution')
    }
  }
  return names
}

export type EnrollmentGenderByCourseResult = {
  block: ReportBlock
  courseSeries: { courseId: string; courseTitle: string; steps: FunnelStep[] }[]
  allSteps: FunnelStep[]
}

/** Enrollment-row gender counts per course (admin/superadmin reports). */
export async function buildEnrollmentGenderByCourse(
  db: Db,
  opts: {
    enrollments: Array<{ user_id?: string | null; course_id?: string | null }>
    courses: Array<{ id: string; title?: string | null }>
  }
): Promise<EnrollmentGenderByCourseResult> {
  const courseTitle = new Map(
    opts.courses.map((course) => [course.id, cleanText(course.title) || 'Course'])
  )
  const userIds = [
    ...new Set(opts.enrollments.map((row) => row.user_id).filter((id): id is string => Boolean(id))),
  ]
  const profiles = await fetchProfiles(db, userIds)
  const genderByUser = new Map(profiles.map((profile) => [profile.id, genderKey(profile.gender)]))

  const countsByCourse = new Map<string, Map<string, number>>()
  for (const enrollment of opts.enrollments) {
    const courseId = enrollment.course_id
    const userId = enrollment.user_id
    if (!courseId || !userId) continue
    if (!courseTitle.has(courseId)) {
      courseTitle.set(courseId, 'Course')
    }
    let bucket = countsByCourse.get(courseId)
    if (!bucket) {
      bucket = new Map(GENDER_ORDER.map((g) => [g.key, 0]))
      countsByCourse.set(courseId, bucket)
    }
    const key = genderByUser.get(userId) || 'not-specified'
    bucket.set(key, (bucket.get(key) || 0) + 1)
  }

  const courseSeries = [...countsByCourse.entries()]
    .map(([courseId, bucket]) => {
      const steps: FunnelStep[] = GENDER_ORDER.map((g) => ({
        key: g.key,
        label: g.label,
        count: bucket.get(g.key) || 0,
      }))
      const total = steps.reduce((sum, step) => sum + step.count, 0)
      return {
        courseId,
        courseTitle: courseTitle.get(courseId) || 'Course',
        steps,
        total,
      }
    })
    .sort((a, b) => b.total - a.total || a.courseTitle.localeCompare(b.courseTitle))

  const allCounts = new Map<string, number>(GENDER_ORDER.map((g) => [g.key, 0]))
  for (const series of courseSeries) {
    for (const step of series.steps) {
      allCounts.set(step.key, (allCounts.get(step.key) || 0) + step.count)
    }
  }
  const allSteps: FunnelStep[] = GENDER_ORDER.map((g) => ({
    key: g.key,
    label: g.label,
    count: allCounts.get(g.key) || 0,
  }))
  const grandTotal = allSteps.reduce((sum, step) => sum + step.count, 0)

  const block: ReportBlock = {
    id: 'learner-gender-by-course',
    title: 'Enrollment by gender (course)',
    description:
      'Enrollment counts by gender for each course. The same learner counts once per course they are enrolled in.',
    metrics: [
      { key: 'courses', label: 'Courses', value: courseSeries.length },
      { key: 'enrollments', label: 'Enrollments', value: grandTotal },
    ],
    columns: [
      { key: 'course', label: 'Course' },
      { key: 'male', label: 'Male' },
      { key: 'female', label: 'Female' },
      { key: 'other', label: 'Other' },
      { key: 'notSpecified', label: 'Not specified' },
      { key: 'total', label: 'Total' },
    ],
    rows: courseSeries.map((series) => {
      const byKey = Object.fromEntries(series.steps.map((step) => [step.key, step.count]))
      return {
        id: series.courseId,
        href: courseRosterHref(series.courseId),
        actionLabel: 'Open roster',
        cells: {
          course: series.courseTitle,
          male: byKey.male || 0,
          female: byKey.female || 0,
          other: byKey.other || 0,
          notSpecified: byKey['not-specified'] || 0,
          total: series.total,
        },
      }
    }),
    emptyMessage: 'No enrollments in this scope yet.',
  }

  return {
    block,
    courseSeries: courseSeries.map(({ courseId, courseTitle: title, steps }) => ({
      courseId,
      courseTitle: title,
      steps,
    })),
    allSteps,
  }
}

export type EnrollmentGenderByOrganizationResult = {
  block: ReportBlock
  institutionSeries: { institutionId: string; institutionName: string; steps: FunnelStep[] }[]
  allSteps: FunnelStep[]
}

const NO_INSTITUTION_ID = 'no-institution'

/** Enrollment-row gender counts by learner home institution (admin/superadmin reports). */
export async function buildEnrollmentGenderByOrganization(
  db: Db,
  opts: {
    enrollments: Array<{ user_id?: string | null; course_id?: string | null }>
    institutions: Array<{ id: string; name?: string | null; slug?: string | null }>
  }
): Promise<EnrollmentGenderByOrganizationResult> {
  const institutionMeta = new Map(
    opts.institutions.map((inst) => [
      inst.id,
      {
        name: cleanText(inst.name) || 'Organization',
        slug: inst.slug || null,
      },
    ])
  )
  const userIds = [
    ...new Set(opts.enrollments.map((row) => row.user_id).filter((id): id is string => Boolean(id))),
  ]
  const profiles = await fetchProfiles(db, userIds)
  const genderByUser = new Map(profiles.map((profile) => [profile.id, genderKey(profile.gender)]))
  const homeOrgByUser = new Map(
    profiles.map((profile) => [profile.id, profile.institution_id || NO_INSTITUTION_ID])
  )

  const countsByOrg = new Map<string, Map<string, number>>()
  for (const enrollment of opts.enrollments) {
    const userId = enrollment.user_id
    if (!userId) continue
    const institutionId = homeOrgByUser.get(userId) || NO_INSTITUTION_ID
    if (!institutionMeta.has(institutionId) && institutionId !== NO_INSTITUTION_ID) {
      institutionMeta.set(institutionId, { name: 'Organization', slug: null })
    }
    let bucket = countsByOrg.get(institutionId)
    if (!bucket) {
      bucket = new Map(GENDER_ORDER.map((g) => [g.key, 0]))
      countsByOrg.set(institutionId, bucket)
    }
    const key = genderByUser.get(userId) || 'not-specified'
    bucket.set(key, (bucket.get(key) || 0) + 1)
  }

  const institutionSeries = [...countsByOrg.entries()]
    .map(([institutionId, bucket]) => {
      const steps: FunnelStep[] = GENDER_ORDER.map((g) => ({
        key: g.key,
        label: g.label,
        count: bucket.get(g.key) || 0,
      }))
      const total = steps.reduce((sum, step) => sum + step.count, 0)
      const name =
        institutionId === NO_INSTITUTION_ID
          ? NO_INSTITUTION
          : institutionMeta.get(institutionId)?.name || 'Organization'
      return {
        institutionId,
        institutionName: name,
        slug: institutionMeta.get(institutionId)?.slug || null,
        steps,
        total,
      }
    })
    .sort((a, b) => {
      if (a.institutionId === NO_INSTITUTION_ID) return 1
      if (b.institutionId === NO_INSTITUTION_ID) return -1
      return b.total - a.total || a.institutionName.localeCompare(b.institutionName)
    })

  const allCounts = new Map<string, number>(GENDER_ORDER.map((g) => [g.key, 0]))
  for (const series of institutionSeries) {
    for (const step of series.steps) {
      allCounts.set(step.key, (allCounts.get(step.key) || 0) + step.count)
    }
  }
  const allSteps: FunnelStep[] = GENDER_ORDER.map((g) => ({
    key: g.key,
    label: g.label,
    count: allCounts.get(g.key) || 0,
  }))
  const grandTotal = allSteps.reduce((sum, step) => sum + step.count, 0)

  const block: ReportBlock = {
    id: 'learner-gender-by-organization',
    title: 'Enrollment by gender (organization)',
    description:
      'Enrollment counts by gender for each learner home organization. The same learner counts once per course they are enrolled in.',
    metrics: [
      { key: 'organizations', label: 'Organizations', value: institutionSeries.length },
      { key: 'enrollments', label: 'Enrollments', value: grandTotal },
    ],
    columns: [
      { key: 'organization', label: 'Organization' },
      { key: 'male', label: 'Male' },
      { key: 'female', label: 'Female' },
      { key: 'other', label: 'Other' },
      { key: 'notSpecified', label: 'Not specified' },
      { key: 'total', label: 'Total' },
    ],
    rows: institutionSeries.map((series) => {
      const byKey = Object.fromEntries(series.steps.map((step) => [step.key, step.count]))
      return {
        id: series.institutionId,
        href:
          series.institutionId === NO_INSTITUTION_ID
            ? undefined
            : institutionCatalogHref(series.slug),
        actionLabel: series.institutionId === NO_INSTITUTION_ID ? undefined : 'Open catalog',
        cells: {
          organization: series.institutionName,
          male: byKey.male || 0,
          female: byKey.female || 0,
          other: byKey.other || 0,
          notSpecified: byKey['not-specified'] || 0,
          total: series.total,
        },
      }
    }),
    emptyMessage: 'No enrollments in this scope yet.',
  }

  return {
    block,
    institutionSeries: institutionSeries.map(({ institutionId, institutionName, steps }) => ({
      institutionId,
      institutionName,
      steps,
    })),
    allSteps,
  }
}

export type RegisteredGenderByOrganizationResult = {
  institutionSeries: { institutionId: string; institutionName: string; steps: FunnelStep[] }[]
  allSteps: FunnelStep[]
}

/** Unique registered accounts by home institution gender (admin/superadmin Gender chart). */
export function buildRegisteredGenderByOrganization(opts: {
  profiles: Array<{ id: string; gender: string | null; institution_id: string | null }>
  institutions: Array<{ id: string; name?: string | null }>
}): RegisteredGenderByOrganizationResult {
  const institutionMeta = new Map(
    opts.institutions.map((inst) => [inst.id, cleanText(inst.name) || 'Organization'])
  )
  const countsByOrg = new Map<string, Map<string, number>>()
  for (const profile of opts.profiles) {
    const institutionId = profile.institution_id || NO_INSTITUTION_ID
    if (!institutionMeta.has(institutionId) && institutionId !== NO_INSTITUTION_ID) {
      institutionMeta.set(institutionId, 'Organization')
    }
    let bucket = countsByOrg.get(institutionId)
    if (!bucket) {
      bucket = new Map(GENDER_ORDER.map((g) => [g.key, 0]))
      countsByOrg.set(institutionId, bucket)
    }
    const key = genderKey(profile.gender)
    bucket.set(key, (bucket.get(key) || 0) + 1)
  }

  const institutionSeries = [...countsByOrg.entries()]
    .map(([institutionId, bucket]) => {
      const steps: FunnelStep[] = GENDER_ORDER.map((g) => ({
        key: g.key,
        label: g.label,
        count: bucket.get(g.key) || 0,
      }))
      const total = steps.reduce((sum, step) => sum + step.count, 0)
      return {
        institutionId,
        institutionName:
          institutionId === NO_INSTITUTION_ID
            ? NO_INSTITUTION
            : institutionMeta.get(institutionId) || 'Organization',
        steps,
        total,
      }
    })
    .sort((a, b) => {
      if (a.institutionId === NO_INSTITUTION_ID) return 1
      if (b.institutionId === NO_INSTITUTION_ID) return -1
      return b.total - a.total || a.institutionName.localeCompare(b.institutionName)
    })

  const allCounts = new Map<string, number>(GENDER_ORDER.map((g) => [g.key, 0]))
  for (const series of institutionSeries) {
    for (const step of series.steps) {
      allCounts.set(step.key, (allCounts.get(step.key) || 0) + step.count)
    }
  }
  const allSteps: FunnelStep[] = GENDER_ORDER.map((g) => ({
    key: g.key,
    label: g.label,
    count: allCounts.get(g.key) || 0,
  }))

  return {
    institutionSeries: institutionSeries.map(({ institutionId, institutionName, steps }) => ({
      institutionId,
      institutionName,
      steps,
    })),
    allSteps,
  }
}

/** Registered accounts by role × gender grid (admin/superadmin). */
export function buildGenderByRole(
  profiles: Array<{ id: string; gender: string | null; role: string | null }>
): ReportBlock {
  const roleKeys = new Map<string, string>()
  for (const role of USER_ROLES) {
    roleKeys.set(role, ROLE_LABELS[role])
  }
  for (const profile of profiles) {
    const key = roleKey(profile.role)
    if (!roleKeys.has(key)) roleKeys.set(key, roleLabel(key))
  }

  const countsByRole = new Map<string, Map<string, number>>()
  for (const [key] of roleKeys) {
    countsByRole.set(key, new Map(GENDER_ORDER.map((g) => [g.key, 0])))
  }
  for (const profile of profiles) {
    const key = roleKey(profile.role)
    let bucket = countsByRole.get(key)
    if (!bucket) {
      bucket = new Map(GENDER_ORDER.map((g) => [g.key, 0]))
      countsByRole.set(key, bucket)
    }
    const gender = genderKey(profile.gender)
    bucket.set(gender, (bucket.get(gender) || 0) + 1)
  }

  const rows = [...countsByRole.entries()]
    .map(([roleId, bucket]) => {
      const male = bucket.get('male') || 0
      const female = bucket.get('female') || 0
      const other = bucket.get('other') || 0
      const notSpecified = bucket.get('not-specified') || 0
      const total = male + female + other + notSpecified
      return {
        id: roleId,
        cells: {
          role: roleKeys.get(roleId) || roleLabel(roleId),
          male,
          female,
          other,
          notSpecified,
          total,
        },
        total,
      }
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || String(a.cells.role).localeCompare(String(b.cells.role)))

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0)

  return {
    id: 'learner-gender-by-role',
    title: 'Gender by role',
    description:
      'Registered accounts by role and gender. Each person is counted once under their current role.',
    metrics: [
      { key: 'roles', label: 'Roles', value: rows.length },
      { key: 'accounts', label: 'Accounts', value: grandTotal },
    ],
    columns: [
      { key: 'role', label: 'Role' },
      { key: 'male', label: 'Male' },
      { key: 'female', label: 'Female' },
      { key: 'other', label: 'Other' },
      { key: 'notSpecified', label: 'Not specified' },
      { key: 'total', label: 'Total' },
    ],
    rows: rows.map(({ id, cells }) => ({ id, cells })),
    emptyMessage: 'No registered accounts in this scope yet.',
  }
}

export async function computeLearnerDemographics(
  db: Db,
  opts:
    | { mode: 'enrolled'; userIds: string[] }
    | { mode: 'platform' }
    | { mode: 'registered'; institutionIds: string[] | null }
): Promise<LearnerDemographicsResult> {
  let profiles: ProfileRow[]
  if (opts.mode === 'enrolled') {
    profiles = await fetchProfiles(db, opts.userIds)
  } else if (opts.mode === 'registered') {
    if (Array.isArray(opts.institutionIds) && opts.institutionIds.length === 0) {
      profiles = []
    } else {
      profiles = await fetchProfiles(db)
      if (opts.institutionIds?.length) {
        const allowed = new Set(opts.institutionIds)
        profiles = profiles.filter((p) => p.institution_id && allowed.has(p.institution_id))
      }
    }
  } else {
    profiles = await fetchProfiles(db)
  }

  // Student-facing demographics (Q/age/dzongkhag/…). Gender chart uses accounts in registered mode.
  const learners =
    opts.mode === 'platform' || opts.mode === 'registered'
      ? profiles.filter((p) => p.role === 'student')
      : profiles
  const genderPopulation = opts.mode === 'registered' ? profiles : learners
  const total = learners.length
  const genderTotal = genderPopulation.length
  const scopeHint =
    opts.mode === 'platform'
      ? 'Every student account. Each person is counted once.'
      : opts.mode === 'registered'
        ? 'Registered accounts in the selected organization. Each person is counted once.'
        : 'Unique learners enrolled in the selected organization. Each person is counted once.'
  const genderScopeHint =
    opts.mode === 'registered'
      ? 'Registered accounts in the selected organization (all roles). Each person is counted once.'
      : scopeHint

  const genderCounts = countMap(
    GENDER_ORDER.map((g) => ({
      id: g.key,
      label: g.label,
      count: genderPopulation.filter((p) => genderKey(p.gender) === g.key).length,
    }))
  )
  const genderRows = rowsFromOrder(GENDER_ORDER, genderCounts)

  const ageCounts = new Map<string, number>()
  for (const band of AGE_BANDS) ageCounts.set(band.key, 0)
  ageCounts.set('not-specified', 0)
  for (const learner of learners) {
    const key = ageBandKey(learner.date_of_birth)
    ageCounts.set(key, (ageCounts.get(key) || 0) + 1)
  }
  const ageRows = rowsFromOrder(
    [...AGE_BANDS.map((b) => ({ key: b.key, label: b.label })), { key: 'not-specified', label: NOT_SPECIFIED }],
    ageCounts
  )

  const dzongkhagCounts = new Map<string, number>()
  for (const name of DZONGKHAGS) dzongkhagCounts.set(name, 0)
  dzongkhagCounts.set('not-specified', 0)
  let unrecognized = 0
  for (const learner of learners) {
    const key = dzongkhagKey(learner.location)
    if (key === 'unrecognized') unrecognized += 1
    else dzongkhagCounts.set(key, (dzongkhagCounts.get(key) || 0) + 1)
  }
  const dzongkhagRows: CountRow[] = [
    ...DZONGKHAGS.map((name) => ({
      id: name,
      label: name,
      count: dzongkhagCounts.get(name) || 0,
    })),
    { id: 'not-specified', label: NOT_SPECIFIED, count: dzongkhagCounts.get('not-specified') || 0 },
  ]
  if (unrecognized > 0) {
    dzongkhagRows.push({ id: 'unrecognized', label: UNRECOGNIZED, count: unrecognized })
  }

  const qualificationRows = withNotSpecified(
    groupedText(learners.map((p) => p.education_level)),
    total
  )
  const classRows = withNotSpecified(
    groupedText(learners.map((p) => p.class_name)),
    total
  )
  const gewogRows = topGroups(groupedText(learners.map((p) => p.gewog)), GEWOG_LIMIT, OTHER_GEWOGS)

  const statusCounts = new Map<string, number>()
  const extraStatuses: CountRow[] = []
  for (const learner of learners) {
    const key = statusKey(learner.account_status)
    statusCounts.set(key, (statusCounts.get(key) || 0) + 1)
  }
  for (const [key, count] of statusCounts) {
    if (!STATUS_ORDER.some((s) => s.key === key)) {
      extraStatuses.push({ id: key, label: statusLabel(key), count })
    }
  }
  const statusRows = rowsFromOrder(STATUS_ORDER, statusCounts, extraStatuses)

  const knownGender = genderTotal - (genderCounts.get('not-specified') || 0)
  const knownAge = total - (ageCounts.get('not-specified') || 0)
  const knownDzongkhag = total - (dzongkhagCounts.get('not-specified') || 0) - unrecognized
  const knownQualification = total - (qualificationRows.find((r) => r.label === NOT_SPECIFIED)?.count || 0)
  const complete = learners.filter(
    (p) =>
      genderKey(p.gender) !== 'not-specified' &&
      ageBandKey(p.date_of_birth) !== 'not-specified' &&
      dzongkhagKey(p.location) !== 'not-specified' &&
      dzongkhagKey(p.location) !== 'unrecognized' &&
      cleanText(p.education_level)
  ).length

  const blocks: ReportBlock[] = [
    countBlock({
      id: 'learner-qualification',
      title: 'Qualification',
      description: `Academic background as entered at registration. ${scopeHint}`,
      total,
      known: knownQualification,
      knownLabel: 'With qualification',
      rows: qualificationRows,
    }),
    countBlock({
      id: 'learner-gender',
      title: 'Gender',
      description: `Gender recorded on the profile. ${genderScopeHint}`,
      total: genderTotal,
      known: knownGender,
      knownLabel: 'With gender',
      totalLabel: opts.mode === 'registered' ? 'Accounts' : 'Learners',
      rows: genderRows,
    }),
    countBlock({
      id: 'learner-dzongkhag',
      title: 'Dzongkhag',
      description: `Home dzongkhag. Dzongkhags with no learners stay listed. ${scopeHint}`,
      total,
      known: knownDzongkhag,
      knownLabel: 'With dzongkhag',
      rows: dzongkhagRows,
    }),
    countBlock({
      id: 'learner-age',
      title: 'Age group',
      description: `Age calculated from date of birth. ${scopeHint}`,
      total,
      known: knownAge,
      knownLabel: 'With date of birth',
      rows: ageRows,
    }),
    countBlock({
      id: 'learner-class',
      title: 'Class / grade',
      description: `Class or grade recorded at registration. ${scopeHint}`,
      total,
      known: total - (classRows.find((r) => r.label === NOT_SPECIFIED)?.count || 0),
      knownLabel: 'With class',
      rows: classRows,
    }),
    countBlock({
      id: 'learner-gewog',
      title: 'Gewog',
      description: `Top gewogs. Remaining gewogs are grouped. ${scopeHint}`,
      total,
      known: total - (gewogRows.find((r) => r.label === NOT_SPECIFIED)?.count || 0),
      knownLabel: 'With gewog',
      rows: gewogRows,
    }),
    countBlock({
      id: 'learner-account-status',
      title: 'Account status',
      description: `Account status of learners in this report. ${scopeHint}`,
      total,
      known: total - (statusCounts.get('not-specified') || 0),
      knownLabel: 'With status',
      rows: statusRows,
    }),
    {
      id: 'learner-completeness',
      title: 'Profile completeness',
      description: `Learners missing gender, date of birth, qualification, or dzongkhag. ${scopeHint}`,
      metrics: [
        { key: 'learners', label: 'Learners', value: total },
        { key: 'complete', label: 'Complete profiles', value: share(complete, total) },
        { key: 'gender', label: 'With gender', value: share(knownGender, total) },
        { key: 'dob', label: 'With date of birth', value: share(knownAge, total) },
        { key: 'qualification', label: 'With qualification', value: share(knownQualification, total) },
        { key: 'dzongkhag', label: 'With dzongkhag', value: share(knownDzongkhag, total) },
      ],
      columns: [
        { key: 'category', label: 'Category' },
        { key: 'count', label: 'Learners' },
        { key: 'share', label: 'Share of learners' },
      ],
      rows: toTableRows(
        [
          { id: 'missing-gender', label: 'Missing gender', count: total - knownGender },
          { id: 'missing-dob', label: 'Missing date of birth', count: total - knownAge },
          {
            id: 'missing-qualification',
            label: 'Missing qualification',
            count: total - knownQualification,
          },
          {
            id: 'missing-dzongkhag',
            label: 'Missing or unrecognized dzongkhag',
            count: total - knownDzongkhag,
          },
          { id: 'complete', label: 'Complete profile', count: complete },
        ],
        total
      ),
      emptyMessage: total === 0 ? 'No learners in this scope yet.' : undefined,
    },
  ]

  if (opts.mode === 'platform' || opts.mode === 'registered') {
    const names = await institutionNames(
      db,
      learners.map((p) => p.institution_id || '').filter(Boolean)
    )
    const institutionRows = withNotSpecified(
      groupedText(
        learners.map((p) => {
          if (!p.institution_id) return NO_INSTITUTION
          return names.get(p.institution_id) || NO_INSTITUTION
        })
      ),
      total
    ).map((row) =>
      row.label === NOT_SPECIFIED ? { ...row, id: 'no-institution', label: NO_INSTITUTION } : row
    )
    if (opts.mode === 'platform') {
      blocks.push(
        countBlock({
          id: 'learner-institution',
          title: 'Institution',
          description: `Student accounts by institution. ${scopeHint}`,
          total,
          known: total - (institutionRows.find((r) => r.label === NO_INSTITUTION)?.count || 0),
          knownLabel: 'With institution',
          rows: institutionRows,
        })
      )
    }

    const roleCounts = new Map<string, number>()
    const extraRoles: CountRow[] = []
    for (const profile of profiles) {
      const key = roleKey(profile.role)
      roleCounts.set(key, (roleCounts.get(key) || 0) + 1)
    }
    for (const [key, count] of roleCounts) {
      if (!(USER_ROLES as string[]).includes(key)) {
        extraRoles.push({ id: key, label: roleLabel(key), count })
      }
    }
    const roleRows = rowsFromOrder(
      USER_ROLES.map((role) => ({ key: role, label: ROLE_LABELS[role] })),
      roleCounts,
      extraRoles
    )
    blocks.push(
      countBlock({
        id: 'learner-role-mix',
        title: 'Role mix',
        description: 'Every account in this scope, including staff. Each person is counted once.',
        total: profiles.length,
        known: profiles.length - (roleCounts.get('not-specified') || 0),
        knownLabel: 'With role',
        totalLabel: 'Accounts',
        rows: roleRows,
      })
    )
  }

  if (opts.mode === 'registered') {
    blocks.push(buildGenderByRole(profiles))
  }

  const chartRows: Record<string, CountRow[]> = {
    'learner-qualification': qualificationRows,
    'learner-gender': genderRows,
    'learner-dzongkhag': dzongkhagRows,
    'learner-age': ageRows,
  }

  let breakdowns: ReportBreakdown[] = [
    breakdown(
      'learner-qualification',
      'Qualification',
      'Academic background of learners in this report.',
      chartRows['learner-qualification']
    ),
    breakdown(
      'learner-gender',
      'Gender',
      opts.mode === 'registered'
        ? 'Registered accounts by gender. Use Organization to focus the chart.'
        : 'Gender of learners in this report.',
      chartRows['learner-gender']
    ),
    breakdown(
      'learner-dzongkhag',
      'Dzongkhag',
      'Home dzongkhag, including dzongkhags with no learners.',
      chartRows['learner-dzongkhag']
    ),
    breakdown(
      'learner-age',
      'Age group',
      'Age calculated from date of birth.',
      chartRows['learner-age']
    ),
  ]

  if (opts.mode === 'registered') {
    const orgNames = await institutionNames(
      db,
      profiles.map((p) => p.institution_id || '').filter(Boolean)
    )
    const registeredByOrg = buildRegisteredGenderByOrganization({
      profiles,
      institutions: [...orgNames.entries()].map(([id, name]) => ({ id, name })),
    })
    breakdowns = breakdowns.map((item) =>
      item.key === 'learner-gender'
        ? {
            ...item,
            steps: registeredByOrg.allSteps,
            institutionSeries: registeredByOrg.institutionSeries,
          }
        : item
    )
  }

  return {
    section: {
      section: 'learner-demographics',
      title: REPORT_SECTIONS['learner-demographics'].title,
      description: REPORT_SECTIONS['learner-demographics'].description,
      blocks,
    },
    breakdowns,
    tables: blocks.map(tableFromBlock),
  }
}
