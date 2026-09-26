import type { SupabaseClient } from '@supabase/supabase-js'
import { DZONGKHAGS, normalizeDzongkhag } from '@/lib/dzongkhags'
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/lib/roles'
import { REPORT_SECTIONS } from '@/lib/reports/catalog'
import type {
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

export async function computeLearnerDemographics(
  db: Db,
  opts: { mode: 'enrolled'; userIds: string[] } | { mode: 'platform' }
): Promise<LearnerDemographicsResult> {
  const profiles =
    opts.mode === 'enrolled' ? await fetchProfiles(db, opts.userIds) : await fetchProfiles(db)
  const learners = opts.mode === 'platform' ? profiles.filter((p) => p.role === 'student') : profiles
  const total = learners.length
  const scopeHint =
    opts.mode === 'platform'
      ? 'Every student account. Each person is counted once.'
      : 'Unique learners enrolled in your courses. Each person is counted once.'

  const genderCounts = countMap(
    GENDER_ORDER.map((g) => ({
      id: g.key,
      label: g.label,
      count: learners.filter((p) => genderKey(p.gender) === g.key).length,
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

  const knownGender = total - (genderCounts.get('not-specified') || 0)
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
      description: `Gender recorded on the profile. ${scopeHint}`,
      total,
      known: knownGender,
      knownLabel: 'With gender',
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

  if (opts.mode === 'platform') {
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
        description: 'Every account on the platform, including staff. Each person is counted once.',
        total: profiles.length,
        known: profiles.length - (roleCounts.get('not-specified') || 0),
        knownLabel: 'With role',
        totalLabel: 'Accounts',
        rows: roleRows,
      })
    )
  }

  const chartRows: Record<string, CountRow[]> = {
    'learner-qualification': qualificationRows,
    'learner-gender': genderRows,
    'learner-dzongkhag': dzongkhagRows,
    'learner-age': ageRows,
  }

  const breakdowns: ReportBreakdown[] = [
    breakdown(
      'learner-qualification',
      'Qualification',
      'Academic background of learners in this report.',
      chartRows['learner-qualification']
    ),
    breakdown('learner-gender', 'Gender', 'Gender of learners in this report.', chartRows['learner-gender']),
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
