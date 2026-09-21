import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isPresenceLive,
  isPresenceToday,
  presencePathLabel,
  thimphuDayStart,
  type PresenceStatus,
} from '@/lib/presence'

export type PresencePerson = {
  userId: string
  fullName: string
  email: string | null
  avatarUrl: string | null
  role: string
  path: string | null
  pathLabel: string
  status: PresenceStatus
  lastSeenAt: string
  lastInteractiveAt: string
  sessionStartedAt: string
  leftReason: string | null
  live: boolean
}

export type PresenceSnapshot = {
  generatedAt: string
  timezone: 'Asia/Thimphu'
  activeNow: PresencePerson[]
  activeToday: PresencePerson[]
  counts: {
    now: number
    today: number
    nowByRole: Record<string, number>
    todayByRole: Record<string, number>
  }
}

function tally(people: PresencePerson[]) {
  const byRole: Record<string, number> = {}
  for (const p of people) {
    const role = p.role || 'unknown'
    byRole[role] = (byRole[role] || 0) + 1
  }
  return byRole
}

export async function computePresenceSnapshot(
  db: SupabaseClient<any>
): Promise<PresenceSnapshot> {
  const now = Date.now()
  const since = thimphuDayStart(new Date(now)).toISOString()
  const { data, error } = await db
    .from('user_presence')
    .select(
      'user_id, status, last_seen_at, last_interactive_at, session_started_at, path, path_label, left_reason'
    )
    .gte('last_seen_at', since)

  if (error) throw new Error(error.message)

  const rows = (data || []) as {
    user_id: string
    status: PresenceStatus | string | null
    last_seen_at: string
    last_interactive_at: string
    session_started_at: string
    path: string | null
    path_label: string | null
    left_reason: string | null
  }[]

  const todayRows = rows.filter((r) =>
    isPresenceToday(r.last_seen_at, r.session_started_at, new Date(now))
  )
  const ids = [...new Set(todayRows.map((r) => r.user_id))]
  const { data: profiles } = ids.length
    ? await db
        .from('profiles')
        .select('id, full_name, email, avatar_url, role')
        .in('id', ids)
    : { data: [] }

  const profileById = new Map(
    ((profiles || []) as {
      id: string
      full_name: string | null
      email: string | null
      avatar_url: string | null
      role: string | null
    }[]).map((p) => [p.id, p])
  )

  const people: PresencePerson[] = todayRows.map((r) => {
    const profile = profileById.get(r.user_id)
    const live = isPresenceLive(r.status, r.last_seen_at, now)
    const rawStatus = (r.status as PresenceStatus) || 'offline'
    return {
      userId: r.user_id,
      fullName: profile?.full_name || profile?.email || 'Member',
      email: profile?.email || null,
      avatarUrl: profile?.avatar_url || null,
      role: profile?.role || 'unknown',
      path: r.path,
      pathLabel: r.path_label || presencePathLabel(r.path),
      status: live ? (rawStatus === 'idle' ? 'idle' : 'online') : rawStatus,
      lastSeenAt: r.last_seen_at,
      lastInteractiveAt: r.last_interactive_at,
      sessionStartedAt: r.session_started_at,
      leftReason: live ? null : r.left_reason,
      live,
    }
  })

  const activeNow = people
    .filter((p) => p.live)
    .sort((a, b) => b.lastInteractiveAt.localeCompare(a.lastInteractiveAt))
  const activeToday = [...people].sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1
    return b.lastSeenAt.localeCompare(a.lastSeenAt)
  })

  return {
    generatedAt: new Date(now).toISOString(),
    timezone: 'Asia/Thimphu',
    activeNow,
    activeToday,
    counts: {
      now: activeNow.length,
      today: activeToday.length,
      nowByRole: tally(activeNow),
      todayByRole: tally(activeToday),
    },
  }
}
