'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, UserPlus, Trash2 } from 'lucide-react'

type StaffRow = {
  id: string
  user_id: string
  role: string
  profiles?: { full_name?: string | null; email?: string | null; avatar_url?: string | null } | null
}

export function CourseStaffPanel({ courseId }: { courseId: string }) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    const res = await fetch(`/api/teach/staff?courseId=${courseId}`)
    const data = await res.json()
    if (res.ok) setStaff(data.staff || [])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const add = async () => {
    if (!email.trim()) return
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/teach/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, email: email.trim(), role: 'co_teacher' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add facilitator')
      setEmail('')
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
          Invite other professors who jointly teach this course. They can edit content and view the roster.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Colleague email"
            className="min-h-11"
          />
          <Button
            type="button"
            className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            disabled={saving}
            onClick={() => void add()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Invite
          </Button>
        </div>
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
