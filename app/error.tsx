'use client'
import { Rigbu } from '@/components/brand/rigbu'
import { Button } from '@/components/ui/button'

import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    void fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
      }),
    }).catch(() => undefined)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-start justify-center gap-4 px-6 py-16">
      <Rigbu className="h-16 w-16" />
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        This page could not be loaded. You can try again, or go back to the dashboard.
      </p>
      <div className="flex gap-3">
        <Button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
        >
          Try again
        </Button>
        <a href="/dashboard" className="rounded-md border px-4 py-2 text-sm">
          Dashboard
        </a>
      </div>
    </main>
  )
}
