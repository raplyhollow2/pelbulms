'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, UserPlus, Trash2 } from 'lucide-react'

type StaffRow = {
  id: string
  user_id: string
  role: string
  profiles?: { full_name?: string | null; email?: string | null; avatar_url?: string | null } | null
}

type TeacherOption = {
  id: string
  full_name?: string | null
  email?: string | null
  role?: string | null
}

function teacherOptionLabel(teacher: TeacherOption) {
  const name = teacher.full_name || teacher.email || 'Teacher'
  if (teacher.email && teacher.email !== name) return `${name} — ${teacher.email}`
  return name
}

export function CourseStaffPanel({ courseId }: { courseId: string }) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [teacherId, setTeacherId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    const res = await fetch(`/api/teach/staff?courseId=${courseId}`)
    const data = await res.json()
    if (res.ok) {
      setStaff(data.staff || [])
      setTeachers(data.teachers || [])
      setOwnerId(data.ownerId || null)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const assigned = new Set(staff.map((row) => row.user_id))
  if (ownerId) assigned.add(ownerId)
  const available = teachers
    .filter((teacher) => teacher.id && !assigned.has(teacher.id))
    .sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''))

  const instructors = available.filter((teacher) => teacher.role === 'instructor')
  const resourcePeople = available.filter((teacher) => teacher.role === 'resource_person')

  const add = async () => {
    if (!teacherId) return
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/teach/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, userId: teacherId, role: 'co_teacher' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add facilitator')
      setTeacherId('')
      await load()
    } catch (e: any) {
      setMessage(e?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (userId: string) => {
    if (!confirm('Remove this co-facilitator?')) return
    await fetch(`/api/teach/staff?courseId=${courseId}&userId=${userId}`, { method: 'DELETE' })
    await load()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Co-facilitators</CardTitle>
        <CardDescription>
          Choose an instructor or resource person to invite. They can edit content and view the roster.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="co-teacher-select">Instructors and resource people</Label>
            <select
              id="co-teacher-select"
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a person</option>
              {instructors.length > 0 && (
                <optgroup label="Instructors">
                  {instructors.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacherOptionLabel(teacher)}
                    </option>
                  ))}
                </optgroup>
              )}
              {resourcePeople.length > 0 && (
                <optgroup label="Resource people">
                  {resourcePeople.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacherOptionLabel(teacher)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <Button
            type="button"
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving || !teacherId}
            onClick={() => void add()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />}
            Invite
          </Button>
        </div>
        {available.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No other instructors or resource people are available to invite.
          </p>
        )}
        {message && <p className="text-sm text-red-600">{message}</p>}
        <ul className="space-y-2">
          {staff.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={row.profiles?.avatar_url || undefined} />
                  <AvatarFallback>
                    {(row.profiles?.full_name || row.profiles?.email || 'T').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {row.profiles?.full_name || row.profiles?.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{row.profiles?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {row.role.replace('_', ' ')}
                </Badge>
                {row.role !== 'owner' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 min-w-11 text-red-600"
                    onClick={() => void remove(row.user_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
