'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles } from 'lucide-react'
import type { AiBriefPayload, ReportRange, SnapshotAudience } from '@/lib/reports/types'
import { ModelPicker } from '@/components/ai/model-picker'
import { MODEL_FAMILIES, type ModelFamily } from '@/lib/ai/models'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

type Focus = { label: string; detail?: string } | null

type FollowUp = {
  question: string
  answer: string
  citedFigures: { figure: string; value: string }[]
  model?: string
}

export function AiBriefingPanel({
  range,
  audience,
  family,
  onFamilyChange,
  focus,
}: {
  range: ReportRange
  audience?: SnapshotAudience
  family?: ModelFamily
  onFamilyChange?: (family: ModelFamily) => void
  focus?: Focus
}) {
  const [brief, setBrief] = useState<AiBriefPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [asking, setAsking] = useState(false)
  const [gatewayOk, setGatewayOk] = useState<boolean | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [snapshotHash, setSnapshotHash] = useState<string | null>(null)
  const [allowed, setAllowed] = useState(true)
  const [ownFamily, setOwnFamily] = useState<ModelFamily>(family || 'claude')
  const [question, setQuestion] = useState('')
  const [thread, setThread] = useState<FollowUp[]>([])

  const selected = family || ownFamily
  const setSelected = (next: ModelFamily) => {
    setOwnFamily(next)
    onFamilyChange?.(next)
  }

  const loadCached = async (nextFamily: ModelFamily) => {
    try {
      const res = await fetch(`/api/reports/ai-brief?range=${range}&family=${nextFamily}`)
      const json = await res.json()
      if (res.ok) {
        setBrief(json.brief)
        setCreatedAt(json.createdAt)
        setSnapshotHash(json.snapshotHash || null)
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
    let cancelled = false
    ;(async () => {
      if (!family) {
        try {
          const res = await fetch('/api/ai/models')
          const json = await res.json()
          if (!cancelled && json.defaults?.report) setOwnFamily(json.defaults.report)
        } catch {
          /* keep claude */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [audience, family])

  useEffect(() => {
    if (audience === 'student') return
    setThread([])
    void loadCached(selected)
  }, [range, audience, selected])

  useEffect(() => {
    if (!focus?.label) return
    setQuestion(`Explain ${focus.label}${focus.detail ? ` (${focus.detail})` : ''}.`)
  }, [focus])

  const generate = async (force = false) => {
    try {
      setLoading(true)
      const res = await fetch('/api/reports/ai-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range, force, audience, family: selected }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Briefing failed')
      setBrief(json.brief)
      setCreatedAt(json.createdAt || json.brief?.generatedAt || null)
      setSnapshotHash(json.snapshotHash || null)
      if (force) setThread([])
      toast.success(json.cached ? 'Loaded the saved reading' : 'Reading generated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate briefing')
    } finally {
      setLoading(false)
    }
  }

  const ask = async (preset?: string) => {
    const text = (preset || question).trim()
    if (!text) return
    try {
      setAsking(true)
      const res = await fetch('/api/reports/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          range,
          audience,
          family: selected,
          question: text,
          snapshotHash,
          focus,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not answer')
      setThread((prev) => [
        ...prev,
        {
          question: text,
          answer: json.answer,
          citedFigures: json.citedFigures || [],
          model: json.model,
        },
      ])
      setSnapshotHash(json.snapshotHash || snapshotHash)
      setQuestion('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not answer')
    } finally {
      setAsking(false)
    }
  }

  if (audience === 'student' || !allowed) return null

  const modelLabel = brief?.model || MODEL_FAMILIES[selected].label

  return (
    <Card id="report-interpreter" className="glass-strong scroll-mt-24 border-bhutan-orange/30">
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-bhutan-orange" />
            Report reading
          </CardTitle>
          <CardDescription>
            {modelLabel} — grounded in this snapshot. Figures should be checked against the charts.
            {createdAt ? ` · ${new Date(createdAt).toLocaleString()}` : ''}
          </CardDescription>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <ModelPicker value={selected} onChange={setSelected} disabled={loading || asking} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={loading} onClick={() => generate(false)}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {brief ? 'Load reading' : 'Read this report'}
            </Button>
            <Button size="sm" variant="ghost" disabled={loading} onClick={() => generate(true)}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {focus?.label ? (
          <p className="text-xs text-muted-foreground">
            Selected: <span className="font-medium text-foreground">{focus.label}</span>
            {focus.detail ? ` · ${focus.detail}` : ''}
          </p>
        ) : null}
        {gatewayOk === false ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            AI Gateway is not configured. Set <code className="text-xs">AI_GATEWAY_API_KEY</code> to
            enable report readings.
          </p>
        ) : null}

        {!brief ? (
          <p className="text-sm text-muted-foreground">
            Read this report for a narrative tied to the numbers on the page, then ask a follow-up.
          </p>
        ) : (
          <>
            <div>
              <h3 className="text-base font-semibold">{brief.headline}</h3>
              <div className="prose prose-sm dark:prose-invert mt-2 max-w-none text-muted-foreground">
                <ReactMarkdown>{brief.summary}</ReactMarkdown>
              </div>
            </div>
            {brief.sections?.length ? (
              <div className="space-y-2">
                {brief.sections.map((section, index) => (
                  <div key={index} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                    <p className="text-sm font-medium">
                      {section.figure}
                      <span className="ml-2 tabular-nums text-bhutan-orange">{section.value}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{section.reading}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {brief.caveat ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">What this does not show. </span>
                {brief.caveat}
              </p>
            ) : null}
            <div className="space-y-2">
              {brief.priorities?.map((priority, index) => (
                <div key={index} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        priority.severity === 'critical'
                          ? 'border-red-500/40 text-red-600'
                          : priority.severity === 'opportunity'
                            ? 'border-green-500/40 text-green-700'
                            : ''
                      }
                    >
                      {priority.severity}
                    </Badge>
                    <span className="font-medium">{priority.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{priority.rationale}</p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">Suggested: </span>
                    {priority.suggestedAction}
                  </p>
                </div>
              ))}
            </div>
            {brief.questionsForTeam?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {brief.questionsForTeam.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={asking}
                    onClick={() => void ask(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            ) : null}
          </>
        )}

        {thread.map((turn, index) => (
          <div key={index} className="space-y-1 rounded-lg border border-border/50 p-3">
            <p className="text-sm font-medium">{turn.question}</p>
            <p className="text-sm text-muted-foreground">{turn.answer}</p>
            {turn.citedFigures.length ? (
              <p className="text-xs text-muted-foreground">
                {turn.citedFigures.map((item) => `${item.figure}: ${item.value}`).join(' · ')}
              </p>
            ) : null}
          </div>
        ))}

        <div className="space-y-2">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Why did completion drop? Which dzongkhag needs a visit?"
            rows={2}
          />
          <Button type="button" size="sm" disabled={asking || !question.trim()} onClick={() => void ask()}>
            {asking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Ask about this report
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
