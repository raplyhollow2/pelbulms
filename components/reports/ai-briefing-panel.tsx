'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Sparkles } from 'lucide-react'
import type { AiBriefPayload, ReportRange, SnapshotAudience } from '@/lib/reports/types'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

export function AiBriefingPanel({
  range,
  audience,
}: {
  range: ReportRange
  audience?: SnapshotAudience
}) {
  const [brief, setBrief] = useState<AiBriefPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [gatewayOk, setGatewayOk] = useState<boolean | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [allowed, setAllowed] = useState(true)

  const loadCached = async () => {
    try {
      const res = await fetch(`/api/reports/ai-brief?range=${range}`)
      const json = await res.json()
      if (res.ok) {
        setBrief(json.brief)
        setCreatedAt(json.createdAt)
        setGatewayOk(json.gatewayConfigured)
        if (json.allowed === false) setAllowed(false)
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (audience === 'student') {
      setAllowed(false)
      return
    }
    loadCached()
  }, [range, audience])

  const generate = async (force = false) => {
    try {
      setLoading(true)
      const res = await fetch('/api/reports/ai-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range, force, audience }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Briefing failed')
      setBrief(json.brief)
      setCreatedAt(json.createdAt || json.brief?.generatedAt || null)
      toast.success(json.cached ? 'Loaded cached briefing' : 'Briefing generated')
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate briefing')
    } finally {
      setLoading(false)
    }
  }

  if (audience === 'student' || !allowed) {
    return null
  }

  return (
    <Card className="glass-strong border-bhutan-orange/30">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-bhutan-orange" />
            AI decision briefing
          </CardTitle>
          <CardDescription>
            Claude via AI Gateway — grounded in your live snapshot (no PII emails/CIDs).
            {createdAt ? ` · ${new Date(createdAt).toLocaleString()}` : ''}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={loading} onClick={() => generate(false)}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate
          </Button>
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => generate(true)}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {gatewayOk === false ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            AI Gateway is not configured. Set <code className="text-xs">AI_GATEWAY_API_KEY</code> to
            enable Claude briefings.
          </p>
        ) : null}

        {!brief ? (
          <p className="text-sm text-muted-foreground">
            Generate a briefing to get prioritized risks, opportunities, and suggested actions.
          </p>
        ) : (
          <>
            <div>
              <h3 className="text-base font-semibold">{brief.headline}</h3>
              <div className="prose prose-sm dark:prose-invert mt-2 max-w-none text-muted-foreground">
                <ReactMarkdown>{brief.summary}</ReactMarkdown>
              </div>
            </div>
            <div className="space-y-2">
              {brief.priorities?.map((p, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        p.severity === 'critical'
                          ? 'border-red-500/40 text-red-600'
                          : p.severity === 'opportunity'
                            ? 'border-green-500/40 text-green-700'
                            : ''
                      }
                    >
                      {p.severity}
                    </Badge>
                    <span className="font-medium">{p.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{p.rationale}</p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">Suggested: </span>
                    {p.suggestedAction}
                  </p>
                </div>
              ))}
            </div>
            {brief.questionsForTeam?.length ? (
              <div>
                <p className="mb-1 text-sm font-medium">Questions for the team</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {brief.questionsForTeam.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
