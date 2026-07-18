'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ClipboardCheck, Check, X, FileText, Phone, MapPin, IdCard } from 'lucide-react'

type Registration = {
  id: string
  user_id: string
  full_name: string
  email: string
  phone_number: string
  cid_number: string
  passport_photo_url: string | null
  cid_photo_url: string | null
  requested_role: string | null
  dzongkhag: string | null
  gewog: string | null
  class: string | null
  registration_status: string
  submitted_at: string
}

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'instructor', label: 'Teacher / Instructor' },
  { value: 'resource_person', label: 'Resource Person' },
  { value: 'admin', label: 'Admin' },
]

function docUrl(path: string | null) {
  if (!path) return null
  return `/api/register/document?path=${encodeURIComponent(path)}`
}

export default function ApprovalsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [roleChoice, setRoleChoice] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/approvals?status=submitted')
      const data = await res.json()
      if (res.status === 403) {
        throw new Error(
          data.message ||
            'You are not an assigned reviewer. Ask a superadmin to assign you on Reviewers.'
        )
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to load')
      setRegistrations(data.registrations || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const act = async (reg: Registration, action: 'approve' | 'reject') => {
    setBusyId(reg.id)
    setError('')
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          registrationId: reg.id,
          userId: reg.user_id,
          assignedRole: roleChoice[reg.id] || reg.requested_role || 'student',
          reviewNotes: notes[reg.id] || null,
          rejectionReason: action === 'reject' ? notes[reg.id] || 'Not approved' : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || 'Action failed')
      setRegistrations((prev) => prev.filter((r) => r.id !== reg.id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-8">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <ClipboardCheck className="h-7 w-7 text-bhutan-orange" /> Pending Approvals
        </h1>
        <p className="text-sm text-muted-foreground">
          Verify each applicant&apos;s identity, confirm their role, then approve or reject.
          Superadmins see all institutes; resource persons see their assigned institutes.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && registrations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="font-medium">No pending registrations</p>
            <p className="text-sm text-muted-foreground">New submissions will appear here.</p>
          </CardContent>
        </Card>
      ) : !error ? (
        <div className="space-y-4">
          {registrations.map((reg) => (
            <Card key={reg.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{reg.full_name}</CardTitle>
                    <CardDescription>{reg.email}</CardDescription>
                  </div>
                  <Badge variant="outline">Requested: {reg.requested_role || 'student'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <span className="flex items-center gap-2"><IdCard className="h-4 w-4 text-muted-foreground" /> CID: {reg.cid_number}</span>
                  <span className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {reg.phone_number}</span>
                  <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {reg.gewog}, {reg.dzongkhag}</span>
                  {reg.class && <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> {reg.class}</span>}
                </div>

                <div className="flex flex-wrap gap-2">
                  {docUrl(reg.passport_photo_url) && (
                    <a href={docUrl(reg.passport_photo_url)!} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm"><FileText className="mr-1 h-4 w-4" /> Passport photo</Button>
                    </a>
                  )}
                  {docUrl(reg.cid_photo_url) && (
                    <a href={docUrl(reg.cid_photo_url)!} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm"><IdCard className="mr-1 h-4 w-4" /> CID photo</Button>
                    </a>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Assign role</label>
                    <Select
                      value={roleChoice[reg.id] || reg.requested_role || 'student'}
                      onValueChange={(v) => setRoleChoice((s) => ({ ...s, [reg.id]: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
                    <Textarea
                      rows={1}
                      value={notes[reg.id] || ''}
                      onChange={(e) => setNotes((s) => ({ ...s, [reg.id]: e.target.value }))}
                      placeholder="Review notes / rejection reason"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    disabled={busyId === reg.id}
                    onClick={() => act(reg, 'approve')}
                    className="flex-1 bg-green-600 text-white hover:bg-green-700"
                  >
                    {busyId === reg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" /> Approve</>}
                  </Button>
                  <Button
                    disabled={busyId === reg.id}
                    variant="outline"
                    onClick={() => act(reg, 'reject')}
                    className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <X className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}
