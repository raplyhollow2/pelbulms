'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatMailCount, type MailCount } from '@/lib/email/request-lesson-status-email'

export type ModuleAvailabilityValue = {
  availability?: string | null
  publish_at?: string | null
  publish_timezone?: string | null
  notify_on_publish?: boolean | null
  notify_on_unpublish?: boolean | null
  release_lessons?: boolean | null
  is_published?: boolean | null
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function timeZones() {
  try {
    const zones = Intl.supportedValuesOf('timeZone')
    return zones.includes('Asia/Thimphu') ? zones : ['Asia/Thimphu', ...zones]
  } catch {
    return ['UTC', 'Asia/Thimphu']
  }
}

function partsInZone(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  )
  return parts
}

function zoneOffsetMs(date: Date, timeZone: string) {
  const parts = partsInZone(date, timeZone)
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return asUtc - date.getTime()
}

function utcToZonedInput(iso: string, timeZone: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = partsInZone(date, timeZone)
  const hour = parts.hour === '24' ? '00' : parts.hour
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`
}

function zonedInputToUtc(localValue: string, timeZone: string) {
  const [date, time] = localValue.split('T')
  if (!date || !time) return ''
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  let utc = new Date(wall - zoneOffsetMs(new Date(wall), timeZone))
  utc = new Date(wall - zoneOffsetMs(utc, timeZone))
  return utc.toISOString()
}

export function ModuleAvailabilityFields({
  courseId,
  moduleId,
  value,
  onUpdated,
}: {
  courseId: string
  moduleId: string
  value: ModuleAvailabilityValue
  onUpdated: (next: ModuleAvailabilityValue) => void
}) {
  const zones = useMemo(() => timeZones(), [])
  const initialZone = value.publish_timezone || browserTimeZone()
  const [availability, setAvailability] = useState(
    value.availability || (value.is_published ? 'published' : 'draft')
  )
  const [zone, setZone] = useState(initialZone)
  const [when, setWhen] = useState(
    value.publish_at ? utcToZonedInput(value.publish_at, initialZone) : ''
  )
  const starting = value.availability || (value.is_published ? 'published' : 'draft')
  const [notifyOnPublish, setNotifyOnPublish] = useState(
    starting === 'published' ? value.notify_on_publish === true : true
  )
  const [notifyOnUnpublish, setNotifyOnUnpublish] = useState(value.notify_on_unpublish === true)
  const [releaseLessons, setReleaseLessons] = useState(value.release_lessons !== false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mailNote, setMailNote] = useState('')
  const [askEmail, setAskEmail] = useState(false)
  const [resultNote, setResultNote] = useState('')

  const save = async (nextAvailability = availability, emailNow?: boolean) => {
    setSaving(true)
    setError('')
    const notify = typeof emailNow === 'boolean' ? emailNow : notifyOnPublish
    if (typeof emailNow === 'boolean') setNotifyOnPublish(emailNow)
    try {
      const res = await fetch(`/api/courses/${courseId}/modules/${moduleId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availability: nextAvailability,
          publishAt: nextAvailability === 'scheduled' ? zonedInputToUtc(when, zone) : undefined,
          publishTimezone: nextAvailability === 'scheduled' ? zone : undefined,
          notifyOnPublish: notify,
          notifyOnUnpublish,
          releaseLessons,
          emailNow: emailNow === true,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error || 'Could not save module availability')
        return null
      }
      const moduleRow = payload.module as ModuleAvailabilityValue
      setAvailability(moduleRow.availability || nextAvailability)
      onUpdated(moduleRow)
      const mail = payload.mail as MailCount | null
      const note = mail ? formatMailCount(mail) : ''
      if (note) {
        setMailNote(note)
        if (mail && mail.sent > 0) toast.success(note)
        else toast.message(note)
      } else if (nextAvailability !== 'published') setMailNote('')
      return note
    } catch {
      setError('Could not save module availability')
      return null
    } finally {
      setSaving(false)
    }
  }

  const publishAndEmail = async (email: boolean) => {
    setResultNote('')
    const note = await save('published', email)
    if (note === null) {
      setResultNote('Could not publish this module.')
      return
    }
    if (email) setResultNote(note || 'No email was sent.')
    else setAskEmail(false)
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">Availability</p>
        <p className="text-xs text-muted-foreground">
          Draft modules stay hidden. A schedule opens the module at that time, in the timezone you pick.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['draft', 'Draft'],
            ['published', 'Publish now'],
            ['scheduled', 'Schedule'],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={availability === id ? 'default' : 'outline'}
            onClick={() => {
              if (id === 'published') {
                setResultNote('')
                setAskEmail(true)
                return
              }
              setAvailability(id)
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {availability === 'scheduled' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`module-when-${moduleId}`}>Publish date and time</Label>
            <Input
              id={`module-when-${moduleId}`}
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`module-zone-${moduleId}`}>Timezone</Label>
            <select
              id={`module-zone-${moduleId}`}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={zone}
              onChange={(event) => {
                const nextZone = event.target.value
                if (when) {
                  const utc = zonedInputToUtc(when, zone)
                  setWhen(utc ? utcToZonedInput(utc, nextZone) : when)
                }
                setZone(nextZone)
              }}
            >
              {zones.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm">Email enrolled learners when this module is published</Label>
        <Switch checked={notifyOnPublish} onCheckedChange={setNotifyOnPublish} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm">Email enrolled learners if this module is unpublished</Label>
        <Switch checked={notifyOnUnpublish} onCheckedChange={setNotifyOnUnpublish} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm">Publish every lesson when this module goes live</Label>
          <p className="text-xs text-muted-foreground">Does not send a separate email for each lesson.</p>
        </div>
        <Switch checked={releaseLessons} onCheckedChange={setReleaseLessons} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" size="sm" disabled={saving || (availability === 'scheduled' && !when)} onClick={() => void save()}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save availability
      </Button>
      {mailNote ? <p className="text-sm text-muted-foreground">{mailNote}</p> : null}
      <AlertDialog open={askEmail} onOpenChange={setAskEmail}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{resultNote ? 'Email result' : 'Email enrolled students?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {resultNote ||
                (availability === 'published'
                  ? 'This module is already published. Email the students enrolled in this course that it is available.'
                  : 'Publishing this module can email every student enrolled in this course.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {resultNote ? (
              <AlertDialogCancel>Close</AlertDialogCancel>
            ) : (
              <>
                <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                {availability !== 'published' ? (
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void publishAndEmail(false)}>
                    Publish without email
                  </Button>
                ) : null}
                <Button type="button" disabled={saving} onClick={() => void publishAndEmail(true)}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Email students
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
