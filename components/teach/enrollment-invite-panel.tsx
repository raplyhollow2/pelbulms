'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Mail, Smartphone, Copy, Check } from 'lucide-react'

type Invite = {
  id: string
  code: string
  student_email?: string | null
  student_phone?: string | null
  used_at?: string | null
  created_at: string
}

export function EnrollmentInvitePanel({ courseId }: { courseId: string }) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [invites, setInvites] = useState<Invite[]>([])
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch(`/api/teach/invites?courseId=${courseId}`)
    const data = await res.json()
    if (res.ok) setInvites(data.invites || [])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const create = async () => {
    if (!email.trim() && !phone.trim()) {
      setMessage('Enter an email or mobile number')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/teach/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create code')
      setMessage(data.message || 'Code created')
      setEmail('')
      setPhone('')
      await load()
    } catch (e: any) {
      setMessage(e?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Student enrollment codes</CardTitle>
        <CardDescription>
          Each student gets a unique code. Send it by email or SMS — only that student can enroll.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Student email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@school.bt"
              className="min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mobile</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+975…"
              className="min-h-11"
            />
          </div>
        </div>
        <Button
          type="button"
          className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
          disabled={saving}
          onClick={() => void create()}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
          Generate and send code
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <ul className="space-y-2">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-mono text-base font-semibold tracking-widest">{inv.code}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {inv.student_email || inv.student_phone || 'No contact'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {inv.used_at ? (
                  <Badge>Used</Badge>
                ) : (
                  <Badge variant="secondary">Unused</Badge>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={async () => {
                    await navigator.clipboard.writeText(inv.code)
                    setCopied(inv.id)
                    setTimeout(() => setCopied(null), 1500)
                  }}
                >
                  {copied === inv.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" />
          SMS needs TWILIO_* env vars; email needs RESEND_API_KEY. Codes can always be copied.
        </p>
      </CardContent>
    </Card>
  )
}
