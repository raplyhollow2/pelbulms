'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Save, Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadImageDirectToCloudinary } from '@/lib/cloudinary-direct-upload'
import { CertificateEditor } from '@/components/teach/certificate-editor'
import {
  defaultCertificateLayout,
  layoutFromLegacySettings,
  type CertificateLayout,
} from '@/lib/certificate-layout'

type CertSettings = {
  brandName: string
  titleLine: string
  accentColor: string
  signatureName: string
  signatureTitle: string
  logoUrl: string
}

const DEFAULTS: CertSettings = {
  brandName: 'PELBU LMS',
  titleLine: 'Certificate of Completion',
  accentColor: '#E9B308',
  signatureName: '',
  signatureTitle: 'Instructor',
  logoUrl: '',
}

export default function CertificateDesignPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [courseTitle, setCourseTitle] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [settings, setSettings] = useState<CertSettings>(DEFAULTS)
  const [layout, setLayout] = useState<CertificateLayout>(defaultCertificateLayout())
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const signatureInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const load = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: course, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()
      if (error || !course) throw error || new Error('Course not found')

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      const role = (profile as any)?.role
      const isOwner = (course as any).instructor_id === user.id
      const isStaff = role === 'admin' || role === 'superadmin'
      if (!isOwner && !isStaff) {
        alert('Access denied')
        router.push('/teach/dashboard')
        return
      }

      setCourseTitle((course as any).title || '')
      setEnabled((course as any).certificate_enabled !== false)
      const stored = ((course as any).certificate_settings || {}) as Partial<CertSettings>
      setSettings({
        ...DEFAULTS,
        signatureName: (profile as any)?.full_name || '',
        ...stored,
      })
      setLayout(
        layoutFromLegacySettings({
          ...stored,
          signatureName: stored.signatureName || (profile as any)?.full_name || '',
        } as any)
      )
    } catch (e: any) {
      alert(e?.message || 'Failed to load')
      router.push('/teach/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const uploadAsset = async (file: File): Promise<string> => {
    setUploading(true)
    setMessage('')
    try {
      try {
        const { url } = await uploadImageDirectToCloudinary(file, {
          folder: `course-media/images/${courseId}/certificate`,
        })
        setSettings((prev) => ({ ...prev, logoUrl: url }))
        setMessage('Asset added to canvas. Save design to keep it.')
        return url
      } catch (directErr: any) {
        if (file.size > 8 * 1024 * 1024) throw directErr
      }

      const body = new FormData()
      body.append('file', file)
      body.append('courseId', courseId)
      body.append('kind', 'image')
      const res = await fetch('/api/courses/media', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setSettings((prev) => ({ ...prev, logoUrl: data.url }))
      setMessage('Asset added to canvas. Save design to keep it.')
      return data.url as string
    } catch (e: any) {
      setMessage(e?.message || 'Failed to upload asset')
      return ''
    } finally {
      setUploading(false)
    }
  }

  const uploadSignature = async (file: File) => {
    setUploading(true)
    try {
      const transparent = await stripNearWhiteBackground(file)
      const { url } = await uploadImageDirectToCloudinary(transparent, {
        folder: `course-media/images/${courseId}/signature`,
      })
      // Place as a free-floating image — never bind into the instructor-name layer
      setLayout((prev) => {
        const sig = prev.layers.find((l) => l.type === 'signature')
        const withoutOld = prev.logos.filter((l) => !l.id.startsWith('sig-image'))
        return {
          ...prev,
          signatureUrl: undefined,
          logos: [
            ...withoutOld,
            {
              id: `sig-image-${Date.now()}`,
              src: url,
              x: sig ? sig.x + Math.max(0, (sig.w - 180) / 2) : 470,
              y: sig ? Math.max(40, sig.y - 70) : 520,
              w: 180,
              h: 64,
            },
          ],
        }
      })
      setMessage('Signature image added separately from the instructor name. Drag to place, then save.')
    } catch (e: any) {
      setMessage(e?.message || 'Failed to upload signature')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      const { error } = await (supabase as any)
        .from('courses')
        .update({
          certificate_enabled: enabled,
          certificate_settings: {
            ...settings,
            brandName: settings.brandName,
            titleLine: layout.titleLine || settings.titleLine,
            accentColor: layout.accentColor || settings.accentColor,
            signatureName: settings.signatureName,
            signatureTitle: settings.signatureTitle,
            logoUrl: settings.logoUrl || layout.logos[0]?.src || '',
            layout: {
              ...layout,
              brandName: settings.brandName,
              titleLine: layout.titleLine || settings.titleLine,
              accentColor: layout.accentColor,
              signatureName: settings.signatureName,
              signatureTitle: settings.signatureTitle,
              // Never persist a bound signature image on the name layer
              signatureUrl: undefined,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId)
      if (error) throw error
      setMessage('Certificate design saved.')
    } catch (e: any) {
      setMessage(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto flex justify-center px-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => router.push(`/teach/courses/${courseId}/edit`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to course
        </Button>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-bhutan-yellow text-black hover:bg-bhutan-orange"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save design
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Certificate studio</h1>
        <p className="text-sm text-muted-foreground">
          Canva-style editor for <strong>{courseTitle}</strong> — drag, resize, and customize with
          digital assets. Start from the Bhutan Official template to match MoLHR-style certificates.
        </p>
      </div>

      <CertificateEditor
        layout={{
          ...layout,
          brandName: settings.brandName,
          titleLine: layout.titleLine || settings.titleLine,
          accentColor: layout.accentColor || settings.accentColor,
          signatureName: settings.signatureName,
          signatureTitle: settings.signatureTitle,
        }}
        onChange={(next) => {
          setLayout((prev) => {
            const resolved = typeof next === 'function' ? next(prev) : next
            queueMicrotask(() => {
              setSettings((s) => ({
                ...s,
                titleLine: resolved.titleLine || s.titleLine,
                accentColor: resolved.accentColor || s.accentColor,
                logoUrl: resolved.logos[0]?.src || s.logoUrl,
              }))
            })
            return resolved
          })
        }}
        sampleName="Tshering Pelden"
        sampleCourse={courseTitle || 'Small Business Management'}
        onUploadAsset={uploadAsset}
        uploading={uploading}
      />

      <Card>
        <CardHeader>
          <CardTitle>Issuance settings</CardTitle>
          <CardDescription>Enable certificates and set signer details for issued PDFs.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <Label>Offer certificate</Label>
              <p className="text-xs text-muted-foreground">Issue PDF on course completion</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div>
            <Label>Brand name</Label>
            <Input
              className="mt-1 min-h-11"
              value={settings.brandName}
              onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
            />
          </div>
          <div>
            <Label>Signature name</Label>
            <Input
              className="mt-1 min-h-11"
              value={settings.signatureName}
              onChange={(e) => {
                const signatureName = e.target.value
                setSettings({ ...settings, signatureName })
                setLayout((prev) => ({ ...prev, signatureName }))
              }}
            />
          </div>
          <div>
            <Label>Signature title</Label>
            <Input
              className="mt-1 min-h-11"
              value={settings.signatureTitle}
              onChange={(e) => {
                const signatureTitle = e.target.value
                setSettings({ ...settings, signatureTitle })
                setLayout((prev) => ({ ...prev, signatureTitle }))
              }}
            />
          </div>
          <div>
            <Label>Signature image (camera / file)</Label>
            <input
              ref={signatureInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadSignature(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="mt-1 min-h-11 w-full"
              onClick={() => signatureInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Upload / camera
            </Button>
          </div>
          {message && (
            <p className="text-sm text-muted-foreground sm:col-span-2">{message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

async function stripNearWhiteBackground(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = image.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) d[i + 3] = 0
  }
  ctx.putImageData(image, 0, 0)
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b || file), 'image/png')
  )
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' })
}
