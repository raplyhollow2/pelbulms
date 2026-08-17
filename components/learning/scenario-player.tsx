'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Node = {
  id: string
  text: string
  choices?: Array<{ label: string; nextId: string; feedback?: string }>
  end?: boolean
}

export function ScenarioPlayer({ lessonId }: { lessonId: string }) {
  const [scenario, setScenario] = useState<{ title: string; nodes: Node[] } | null>(null)
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/scenarios?lessonId=${lessonId}`)
      const data = await res.json()
      const published = (data.scenarios || []).find((s: any) => s.is_published) || data.scenarios?.[0]
      if (published) {
        const nodes = Array.isArray(published.nodes) ? published.nodes : []
        setScenario({ title: published.title, nodes })
        setNodeId(nodes[0]?.id || null)
      }
    })()
  }, [lessonId])

  if (!scenario || !nodeId) return null
  const node = scenario.nodes.find((n) => n.id === nodeId)
  if (!node) return null

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg">{scenario.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{node.text}</p>
        {feedback && <p className="text-xs text-muted-foreground">{feedback}</p>}
        <div className="flex flex-col gap-2">
          {(node.choices || []).map((c) => (
            <Button
              key={c.label}
              type="button"
              variant="outline"
              className="min-h-11 justify-start whitespace-normal text-left"
              onClick={() => {
                setFeedback(c.feedback || '')
                setNodeId(c.nextId)
              }}
            >
              {c.label}
            </Button>
          ))}
        </div>
        {node.end && <p className="text-sm font-medium text-green-700">Scenario complete.</p>}
      </CardContent>
    </Card>
  )
}
