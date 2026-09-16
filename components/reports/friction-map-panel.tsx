'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { FrictionHotspot, FrictionMapPayload, FrictionType } from '@/lib/reports/types'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<FrictionType, string> = {
  drop_off: 'Drop-off',
  hesitation: 'Hesitation',
  stuck: 'Stuck',
  assessment: 'Assessment',
}

const TYPE_HINTS: Record<FrictionType, string> = {
  drop_off: 'Abrupt finish-rate plunge — content overload or a broken step.',
  hesitation: 'Long dwell vs cohort — confusing wording or unclear instructions.',
  stuck: 'Learners pause mid-lesson (10–80% progress) without completing.',
  assessment: 'High quiz fail rate on this lesson’s assessments.',
}

function TypeLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(TYPE_LABELS) as FrictionType[]).map((t) => (
        <Badge key={t} variant="outline" className="font-normal">
          {TYPE_LABELS[t]}
        </Badge>
      ))}
    </div>
  )
}

export function FrictionMapPanel({
  frictionMap,
}: {
  frictionMap: FrictionMapPayload
}) {
  const [guideOpen, setGuideOpen] = useState(false)
  const top3 = frictionMap.hotspots.slice(0, 3)

  return (
    <Card className="glass border-bhutan-orange/20">
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="text-base">Lesson friction map</CardTitle>
          <CardDescription>
            Behavioral matrix from progress, dwell, and quiz outcomes — not a click heatmap.
          </CardDescription>
        </div>
        <TypeLegend />
      </CardHeader>
      <CardContent className="space-y-4">
        {top3.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Top 3 to fix first</p>
            {top3.map((h, i) => (
              <HotspotRow key={h.lessonId} hotspot={h} rank={i + 1} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No friction hotspots detected.</p>
        )}

        <button
          type="button"
          onClick={() => setGuideOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-left text-sm hover:bg-muted/40"
        >
          {guideOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-bhutan-orange" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-bhutan-orange" />
          )}
          <span className="font-medium">How to read this friction map</span>
        </button>

        {guideOpen ? (
          <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Map type:</span> This is a{' '}
              <em>behavioral friction matrix</em> (effort vs completion). Pelbu does not yet
              capture UX heatmaps (rage clicks / dead clicks).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-foreground">
                    <th className="py-1.5 pr-3 font-medium">Signal</th>
                    <th className="py-1.5 pr-3 font-medium">Looks like</th>
                    <th className="py-1.5 font-medium">Means</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 pr-3">Drop-off</td>
                    <td className="py-1.5 pr-3">Finish rate well below starts</td>
                    <td className="py-1.5">Cognitive or broken-path friction</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 pr-3">Hesitation</td>
                    <td className="py-1.5 pr-3">Avg minutes ≫ course median</td>
                    <td className="py-1.5">Confused by phrasing / instructions</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 pr-3">Stuck</td>
                    <td className="py-1.5 pr-3">Mid-progress, never completed</td>
                    <td className="py-1.5">Stalled in content or gated step</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3">Assessment</td>
                    <td className="py-1.5 pr-3">High quiz fail rate</td>
                    <td className="py-1.5">Knowledge gap before the quiz</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <span className="text-foreground">Interaction / UX:</span> stuck or activity
                stalls → clarify navigation and clickable actions.
              </li>
              <li>
                <span className="text-foreground">Cognitive:</span> drop-off or hesitation before
                assessments → chunk dense text into micro-lessons.
              </li>
              <li>
                <span className="text-foreground">Assessment design:</span> high fail rates →
                bridge the gap with practice, not a full course rewrite.
              </li>
            </ul>
            <p>
              Isolate the top 3 points (≥20% drop-off or high stuck/dwell), validate with learner
              feedback, and ship direct fixes (broken links, clearer quiz instructions) before
              redesigning the whole curriculum.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function HotspotRow({ hotspot: h, rank }: { hotspot: FrictionHotspot; rank: number }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/50 p-3">
      <div className="min-w-0">
        <p className="font-medium">
          <span className="mr-2 text-bhutan-orange">{rank}.</span>
          {h.lessonTitle}
        </p>
        <p className="text-xs text-muted-foreground">{h.courseTitle}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{TYPE_LABELS[h.frictionType]}</Badge>
          <span className="text-xs text-muted-foreground">
            score {h.frictionScore} · drop-off {h.dropOffPct}% · stuck {h.stuckRate}%
          </span>
        </div>
        <p className={cn('mt-1 text-xs text-muted-foreground')}>{TYPE_HINTS[h.frictionType]}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Link
          href={`/teach/courses/${h.courseId}/edit`}
          className="inline-flex items-center text-xs text-bhutan-orange hover:underline"
        >
          Edit <ExternalLink className="ml-1 h-3 w-3" />
        </Link>
        <Link
          href={`/teach/courses/${h.courseId}/students`}
          className="inline-flex items-center text-xs text-bhutan-orange hover:underline"
        >
          Students <ExternalLink className="ml-1 h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
