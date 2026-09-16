/**
 * Instrumentation gaps that limit report fidelity.
 * Surfaced in System Pulse so developers and superadmins can prioritize telemetry.
 */

export type InstrumentationGapSeverity = 'blocker' | 'partial' | 'nice-to-have'

export interface InstrumentationGap {
  id: string
  area: string
  severity: InstrumentationGapSeverity
  blocksReports: string[]
  recommendation: string
  status: 'missing' | 'stubbed' | 'partial'
}

export const INSTRUMENTATION_GAPS: InstrumentationGap[] = [
  {
    id: 'payments-ledger',
    area: 'Commerce',
    severity: 'blocker',
    blocksReports: ['Revenue by course/institution', 'Checkout abandon'],
    recommendation:
      'Persist Stripe Checkout Session / PaymentIntent outcomes in a payments table (amount, currency, course_id, user_id, status, created_at).',
    status: 'missing',
  },
  {
    id: 'api-error-telemetry',
    area: 'Reliability',
    severity: 'blocker',
    blocksReports: ['API & route error budget', 'p95 latency'],
    recommendation:
      'Log structured request metrics (route, status, duration_ms) to a platform_events table or ship Vercel runtime logs into a queryable store.',
    status: 'missing',
  },
  {
    id: 'auth-funnel-events',
    area: 'Auth',
    severity: 'partial',
    blocksReports: ['Auth funnel telemetry', 'Trust & Safety Pulse'],
    recommendation:
      'Record login_failed, kyc_blocked, role_elevated events with user_id (nullable) and reason codes.',
    status: 'missing',
  },
  {
    id: 'rbac-denial-log',
    area: 'Security',
    severity: 'partial',
    blocksReports: ['RBAC denial map'],
    recommendation:
      'When withRBAC returns 403, append path + role + user_id to an audit_events table.',
    status: 'missing',
  },
  {
    id: 'web-vitals',
    area: 'Performance',
    severity: 'nice-to-have',
    blocksReports: ['Client performance', 'Hotspot heatmap'],
    recommendation:
      'Collect LCP/INP/CLS per route via next/web-vitals and post to /api/telemetry.',
    status: 'missing',
  },
  {
    id: 'page-view-events',
    area: 'Product analytics',
    severity: 'partial',
    blocksReports: ['Dead UI detection', 'Feature flag / dead UI'],
    recommendation:
      'Emit page_view events for teach/learn/admin routes; retire unused mock hubs once confirmed cold.',
    status: 'missing',
  },
  {
    id: 'attendance',
    area: 'Live learning',
    severity: 'nice-to-have',
    blocksReports: ['Online attendance'],
    recommendation:
      'Either wire live_attendance in the app or remove legacy schema to avoid false expectations.',
    status: 'stubbed',
  },
  {
    id: 'ai-usage-metering',
    area: 'AI',
    severity: 'partial',
    blocksReports: ['AI usage & cost'],
    recommendation:
      'Log provider, model, tokens, latency, and error per /api/ai/* call; join with ai_provider_keys.',
    status: 'partial',
  },
  {
    id: 'notification-delivery',
    area: 'Messaging',
    severity: 'partial',
    blocksReports: ['Background job health', 'Message students who outcomes'],
    recommendation:
      'Track notification send status (queued/sent/failed) for announcements and interventions.',
    status: 'partial',
  },
  {
    id: 'media-integrity',
    area: 'Storage',
    severity: 'nice-to-have',
    blocksReports: ['Storage / media breakage'],
    recommendation:
      'Periodic job to verify Cloudinary public IDs referenced by lessons still resolve.',
    status: 'missing',
  },
  {
    id: 'lesson-ux-heatmap',
    area: 'Learning analytics',
    severity: 'nice-to-have',
    blocksReports: ['Lesson UX heatmap', 'Rage / dead click friction'],
    recommendation:
      'Emit client interaction events (rage_click, dead_click, scroll_depth) on lesson pages into analytics_events; until then use the behavioral friction matrix (finish/dwell/stuck/quiz).',
    status: 'missing',
  },
]

export function instrumentationGapsAsReportRows() {
  return INSTRUMENTATION_GAPS.map((g) => ({
    id: g.id,
    cells: {
      area: g.area,
      severity: g.severity,
      status: g.status,
      blocks: g.blocksReports.join('; '),
      recommendation: g.recommendation,
    },
  }))
}
