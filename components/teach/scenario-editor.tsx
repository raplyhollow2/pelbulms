'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

export function ScenarioEditor({ lessonId }: { lessonId: string }) {
  const [title, setTitle] = useState('Practice scenario')
  const [situation, setSituation] = useState('')
  const [choiceA, setChoiceA] = useState('')
  const [choiceB, setChoiceB] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      const nodes = [
        {
          id: 'start',
          text: situation,
          choices: [
            { label: choiceA, nextId: 'end-a', feedback: 'Noted.' },
            { label: choiceB, nextId: 'end-b', feedback: 'Noted.' },
          ],
        },
        { id: 'end-a', text: `You chose: ${choiceA}`, end: true },
        { id: 'end-b', text: `You chose: ${choiceB}`, end: true },
      ]
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, title, nodes, isPublished: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setMessage('Scenario published. Students will see it in the lesson.')
    } catch (e: any) {
      setMessage(e?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Branching scenario</CardTitle>
        <CardDescription>Put learners in a situation and let them choose what happens next.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input className="min-h-11" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scenario title" />
        <Textarea value={situation} onChange={(e) => setSituation(e.target.value)} placeholder="The situation…" rows={3} />
        <Input className="min-h-11" value={choiceA} onChange={(e) => setChoiceA(e.target.value)} placeholder="Choice A" />
        <Input className="min-h-11" value={choiceB} onChange={(e) => setChoiceB(e.target.value)} placeholder="Choice B" />
        <Button
          type="button"
          className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Publish scenario
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  )
}
