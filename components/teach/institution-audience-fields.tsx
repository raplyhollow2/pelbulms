'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Loader2 } from 'lucide-react'
import {
  institutionLabel,
  type InstitutionSummary,
} from '@/lib/course-institution-access'

type Props = {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  /** When true, show the institution list even if none selected yet */
  restrictEnabled: boolean
  onRestrictEnabledChange: (enabled: boolean) => void
  crossOrgEnrollmentCount?: number
  className?: string
}

export function InstitutionAudienceFields({
  selectedIds,
  onChange,
  restrictEnabled,
  onRestrictEnabledChange,
  crossOrgEnrollmentCount = 0,
  className,
}: Props) {
  const [institutions, setInstitutions] = useState<InstitutionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/institutions')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to load institutions')
        if (!cancelled) {
          setInstitutions(data.institutions || [])
          setLoadError(null)
        }
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || 'Failed to load institutions')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleId = (id: string, checked: boolean) => {
    if (checked) onChange([...new Set([...selectedIds, id])])
    else onChange(selectedIds.filter((x) => x !== id))
  }

  return (
    <div className={className ?? 'rounded-lg border p-4 space-y-3'}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor="restrict-institutions" className="font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            Restrict to institutions
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Only learners registered under the selected institutions will see this course in the
            catalog. Leave off to publish for everyone.
          </p>
        </div>
        <Switch
          id="restrict-institutions"
          checked={restrictEnabled}
          onCheckedChange={(checked) => {
            onRestrictEnabledChange(checked)
            if (!checked) onChange([])
          }}
        />
      </div>

      {restrictEnabled && (
        <div className="space-y-2 pt-1">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading institutions…
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : institutions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active institutions found. Add institutions in Site administration.
            </p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto rounded-md border bg-muted/20 p-2">
              {institutions.map((inst) => {
                const checked = selectedIds.includes(inst.id)
                return (
                  <li key={inst.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`inst-${inst.id}`}
                      checked={checked}
                      onCheckedChange={(v) => toggleId(inst.id, v === true)}
                    />
                    <Label htmlFor={`inst-${inst.id}`} className="font-normal cursor-pointer text-sm">
                      {institutionLabel(inst)}
                      <span className="ml-1.5 text-xs text-muted-foreground">/{inst.slug}</span>
                    </Label>
                  </li>
                )
              })}
            </ul>
          )}
          {selectedIds.length === 0 && !loading && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Select at least one institution, or turn off restriction to keep the course open to
              all.
            </p>
          )}
          {crossOrgEnrollmentCount > 0 && selectedIds.length > 0 && (
            <Alert>
              <AlertDescription className="text-xs">
                {crossOrgEnrollmentCount} enrolled or pending learner
                {crossOrgEnrollmentCount === 1 ? '' : 's'}{' '}
                {crossOrgEnrollmentCount === 1 ? 'belongs' : 'belong'} to other institutions.
                Restricting hides this course from new learners outside the selection; existing
                enrollments are not removed.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}
