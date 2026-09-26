'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { ModelPicker } from '@/components/ai/model-picker'
import {
  DEFAULT_AI_MODEL_DEFAULTS,
  type AiModelDefaults,
  type ModelFamily,
} from '@/lib/ai/models'
import { toast } from 'sonner'

export function AiModelDefaultsForm() {
  const [defaults, setDefaults] = useState<AiModelDefaults>(DEFAULT_AI_MODEL_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/ai/models')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Could not load model defaults')
        if (!cancelled && json.defaults) setDefaults(json.defaults)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not load model defaults')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const save = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/admin/ai/models', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaults),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not save defaults')
      setDefaults(json.defaults)
      toast.success('Model defaults saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save defaults')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-border/60 bg-card p-5">
      <h2 className="text-sm font-semibold">Model defaults</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Reports start on the reading model. Course structure starts on the planning model. People can
        still switch Claude, ChatGPT, or Gemini on each run.
      </p>
      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading defaults
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">Report reading and Word brief</span>
            <ModelPicker
              value={defaults.report}
              onChange={(family: ModelFamily) => setDefaults((prev) => ({ ...prev, report: family }))}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">Course structure</span>
            <ModelPicker
              value={defaults['course-structure']}
              onChange={(family: ModelFamily) =>
                setDefaults((prev) => ({ ...prev, 'course-structure': family }))
              }
            />
          </label>
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save defaults
          </Button>
        </div>
      )}
    </section>
  )
}
