'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'

type GradingNotice = {
  id: string
  message: string
  action_url: string | null
  metadata?: {
    student_name?: string
    course_title?: string
    activity_title?: string
  } | null
}

export function GradingAlertBanner() {
  const [items, setItems] = useState<GradingNotice[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/notifications?unread=1&limit=20')
        if (!res.ok) return
        const data = await res.json()
        const grading = ((data.notifications || []) as GradingNotice[]).filter(
          (n: any) => n.type === 'submission_pending'
        )
        if (!cancelled) setItems(grading)
      } catch {
        // silent
      }
    }
    load()
    const id = window.setInterval(load, 15000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  if (items.length === 0) return null
  const first = items[0]
  const meta = first.metadata || {}
  const student = meta.student_name
  const course = meta.course_title
  const activity = meta.activity_title
  const href = first.action_url || '/teach/dashboard'

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="font-medium text-amber-950 dark:text-amber-100">
              {items.length === 1 ? 'Work is waiting to be graded' : `${items.length} submissions waiting to be graded`}
            </p>
            <p className="mt-0.5 text-sm text-amber-900/80 dark:text-amber-100/80">
              {student && course && activity
                ? `${student} · ${activity} · ${course}`
                : first.message}
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-400"
        >
          Grade now
        </Link>
      </div>
    </div>
  )
}
