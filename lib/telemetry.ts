type ErrorContext = Record<string, unknown>

function sentryParts(dsn: string) {
  try {
    const url = new URL(dsn)
    const key = url.username
    const projectId = url.pathname.replace(/^\//, '')
    if (!key || !projectId) return null
    return { key, projectId, store: `${url.protocol}//${url.host}/api/${projectId}/store/` }
  } catch {
    return null
  }
}

/** Structured server log, plus Sentry when a DSN is configured. */
export function reportServerError(error: unknown, context?: ErrorContext) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  console.error(
    JSON.stringify({
      source: 'pelbu',
      message,
      stack,
      ...context,
      at: new Date().toISOString(),
    })
  )

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  const parts = sentryParts(dsn)
  if (!parts) return

  const eventId = crypto.randomUUID().replace(/-/g, '')
  void fetch(parts.store, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parts.key}, sentry_client=pelbu/1.0`,
    },
    body: JSON.stringify({
      event_id: eventId,
      message,
      level: 'error',
      platform: 'node',
      exception: stack
        ? { values: [{ type: 'Error', value: message, stacktrace: { frames: [] } }] }
        : undefined,
      extra: context,
      timestamp: Date.now() / 1000,
    }),
  }).catch(() => undefined)
}
