'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, UserCheck, X } from 'lucide-react'

type Institution = { id: string; name: string; display_name?: string }
type Candidate = { id: string; full_name: string; email: string; role: string }
type Reviewer = {
  id: string
  user_id: string
  institution_id: string
  profile: Candidate | null
}

export function ReviewersPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedInstitution, setSelectedInstitution] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/reviewers')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setInstitutions(data.institutions || [])
      setCandidates(data.candidates || [])
      setReviewers(data.reviewers || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const mutate = async (action: 'assign' | 'revoke', userId: string, institutionId: string) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, institutionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      if (action === 'assign') {
        setSelectedUser('')
        setSelectedInstitution('')
      }
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const institutionName = (id: string) => {
    const i = institutions.find((x) => x.id === id)
    return i?.display_name || i?.name || 'Unknown'
  }

  const candidateLabel = (id: string) => {
    const c = candidates.find((x) => x.id === id)
    if (!c) return 'Select user'
    return `${c.full_name || c.email} · ${c.role}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Assigned reviewers</h2>
        <p className="text-sm text-muted-foreground">
          Assign who may approve or reject new registrations for each institution. Superadmins and
          resource persons already have access for their institutes.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assign a reviewer</CardTitle>
          <CardDescription>
            Extra assignees beyond superadmin and resource person.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Select value={selectedUser} onValueChange={(v) => setSelectedUser(v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select user">
                {(v: string | null) => (v ? candidateLabel(v) : 'Select user')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name || c.email} · {c.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedInstitution}
            onValueChange={(v) => setSelectedInstitution(v ?? '')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select institution">
                {(v: string | null) => (v ? institutionName(v) : 'Select institution')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {institutions.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.display_name || i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!selectedUser || !selectedInstitution || saving}
            onClick={() => mutate('assign', selectedUser, selectedInstitution)}
            className="bg-bhutan-yellow text-black hover:bg-bhutan-orange"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserCheck className="mr-1 h-4 w-4" /> Assign
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active reviewers ({reviewers.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reviewers.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No extra reviewers assigned yet.
            </p>
          )}
          {reviewers.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {r.profile?.full_name || r.profile?.email || r.user_id}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {institutionName(r.institution_id)}
                  </Badge>
                  {r.profile?.role && (
                    <Badge variant="secondary" className="text-xs">
                      {r.profile.role}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => mutate('revoke', r.user_id, r.institution_id)}
                className="text-destructive hover:text-destructive"
              >
                <X className="mr-1 h-4 w-4" /> Revoke
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
