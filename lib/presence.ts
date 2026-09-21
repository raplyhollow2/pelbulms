/** Bhutan does not observe DST; Active Today is the Thimphu calendar day. */
export const PRESENCE_TIMEZONE = 'Asia/Thimphu'

/** Drop from Active Now if heartbeats stop (covers ~2 missed 45s beats). */
export const PRESENCE_ONLINE_MS = 150_000

/** Visible tab with no pointer/keyboard still counts as connected; badge only. */
export const PRESENCE_IDLE_MS = 120_000

export const PRESENCE_HEARTBEAT_MS = 45_000
export const PRESENCE_HEARTBEAT_HIDDEN_MS = 60_000
/** Client-side coalescing so mount + navigation don't double-write. */
export const PRESENCE_WRITE_THROTTLE_MS = 20_000

export type PresenceStatus = 'online' | 'idle' | 'offline'

export function thimphuDayStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PRESENCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return new Date(`${parts}T00:00:00+06:00`)
}

export function isPresenceLive(
  status: string | null | undefined,
  lastSeenAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!lastSeenAt || status === 'offline') return false
  return now - new Date(lastSeenAt).getTime() <= PRESENCE_ONLINE_MS
}

export function isPresenceToday(
  lastSeenAt: string | null | undefined,
  sessionStartedAt: string | null | undefined,
  now = new Date()
): boolean {
  const start = thimphuDayStart(now).getTime()
  const seen = lastSeenAt ? new Date(lastSeenAt).getTime() : 0
  const session = sessionStartedAt ? new Date(sessionStartedAt).getTime() : 0
  return seen >= start || session >= start
}

export function presencePathLabel(pathname: string | null | undefined): string {
  if (!pathname) return 'LMS'
  if (pathname.startsWith('/learn/') && pathname.includes('/lesson/')) return 'In a lesson'
  if (pathname.startsWith('/learn/')) return 'Learning'
  if (pathname.startsWith('/teach/courses/') && pathname.includes('/students')) {
    return 'Course roster'
  }
  if (pathname.startsWith('/teach/courses/')) return 'Course studio'
  if (pathname.startsWith('/teach')) return 'Teaching'
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (pathname.startsWith('/admin/reports')) return 'Reports'
    if (pathname.startsWith('/admin/users')) return 'Users'
    if (pathname.startsWith('/admin/settings')) return 'Settings'
    return 'Admin'
  }
  if (pathname.startsWith('/dashboard')) return 'Dashboard'
  if (pathname.startsWith('/courses')) return 'Catalog'
  if (pathname.startsWith('/profile')) return 'Profile'
  if (pathname.startsWith('/announcements')) return 'Announcements'
  if (pathname.startsWith('/settings')) return 'Settings'
  if (pathname.startsWith('/media')) return 'Media library'
  return 'LMS'
}

let lastHeartbeat: { at: number; status: string; path: string } | null = null

export async function sendPresenceHeartbeat(opts: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> }
  status: 'online' | 'idle'
  path: string
  interactive: boolean
  force?: boolean
}) {
  const path = opts.path.slice(0, 300)
  const now = Date.now()
  if (
    !opts.force &&
    lastHeartbeat &&
    lastHeartbeat.status === opts.status &&
    lastHeartbeat.path === path &&
    now - lastHeartbeat.at < PRESENCE_WRITE_THROTTLE_MS
  ) {
    return
  }
  lastHeartbeat = { at: now, status: opts.status, path }
  await (opts.supabase as any).rpc('presence_heartbeat', {
    p_status: opts.status,
    p_path: path,
    p_path_label: presencePathLabel(path),
    p_interactive: opts.interactive,
  })
}

export async function sendPresenceLeave(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> },
  reason: string
) {
  await (supabase as any).rpc('presence_leave', { p_reason: reason })
}

/** Same-origin leave for tab close (cookies still present, keepalive survives unload). */
export function beaconPresenceLeave(reason: string) {
  if (typeof fetch === 'undefined') return
  try {
    void fetch('/api/presence/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      keepalive: true,
      credentials: 'same-origin',
    })
  } catch {
    /* unload best-effort */
  }
}
