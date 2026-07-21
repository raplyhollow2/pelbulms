'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Save, UploadCloud, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadImageDirectToCloudinary } from '@/lib/cloudinary-direct-upload'
import { resolveMediaUrl } from '@/lib/media'

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
  const [message, setMessage] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const load = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
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
    } catch (e: any) {
      alert(e?.message || 'Failed to load')
      router.push('/teach/dashboard')
    } finally {
      setLoading(false)
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
          certificate_settings: settings,
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

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true)
    setMessage('')
    try {
      try {
        const { url } = await uploadImageDirectToCloudinary(file, {
          folder: `course-media/images/${courseId}/certificate`,
        })
        setSettings((prev) => ({ ...prev, logoUrl: url }))
        setMessage('Logo uploaded. Save design to keep it.')
        return
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
      setMessage('Logo uploaded. Save design to keep it.')
    } catch (e: any) {
      setMessage(e?.message || 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <Button variant="ghost" onClick={() => router.push(`/teach/courses/${courseId}/edit`)}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to course
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Certificate design</CardTitle>
            <CardDescription>
              Customize the certificate issued when students complete{' '}
              <strong>{courseTitle}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Offer certificate</Label>
                <p className="text-xs text-muted-foreground">Issue PDF on course completion</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div>
              <Label>Brand name</Label>
              <Input
                className="mt-1"
                value={settings.brandName}
                onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
              />
            </div>
            <div>
              <Label>Certificate title</Label>
              <Input
                className="mt-1"
                value={settings.titleLine}
                onChange={(e) => setSettings({ ...settings, titleLine: e.target.value })}
              />
            </div>
            <div>
              <Label>Accent color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  className="w-14 h-10 p-1"
                  value={settings.accentColor}
                  onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                />
                <Input
                  value={settings.accentColor}
                  onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Signature name</Label>
              <Input
                className="mt-1"
                value={settings.signatureName}
                onChange={(e) => setSettings({ ...settings, signatureName: e.target.value })}
              />
            </div>
            <div>
              <Label>Signature title</Label>
              <Input
                className="mt-1"
                value={settings.signatureTitle}
                onChange={(e) => setSettings({ ...settings, signatureTitle: e.target.value })}
              />
            </div>
            <div>
              <Label>Logo (optional)</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Upload an image or paste a URL
              </p>
              {settings.logoUrl ? (
                <div className="mb-2 flex items-center gap-3 rounded-lg border p-2">
                  <img
                    src={resolveMediaUrl(settings.logoUrl) || settings.logoUrl}
                    alt="Certificate logo"
                    className="h-12 w-12 object-contain rounded bg-muted"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSettings({ ...settings, logoUrl: '' })}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : null}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadLogo(file)
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4 mr-1.5" />
                  )}
                  {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                </Button>
              </div>
              <Input
                className="mt-2"
                value={settings.logoUrl}
                onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                placeholder="Or paste logo URL…"
              />
            </div>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save design
            </Button>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Approximate layout of the issued PDF</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="aspect-[1.414/1] rounded-lg border-2 p-6 flex flex-col items-center justify-between text-center bg-white text-black"
              style={{ borderColor: settings.accentColor }}
            >
              <div>
                {settings.logoUrl ? (
                  <img
                    src={resolveMediaUrl(settings.logoUrl) || settings.logoUrl}
                    alt=""
                    className="h-10 w-auto mx-auto mb-2 object-contain"
                  />
                ) : null}
                <p
                  className="text-xs font-bold tracking-[0.2em]"
                  style={{ color: settings.accentColor }}
                >
                  {settings.brandName || 'PELBU LMS'}
                </p>
                <h2 className="text-2xl font-bold mt-2">{settings.titleLine}</h2>
                <p className="text-sm text-muted-foreground mt-1">This is proudly presented to</p>
              </div>
              <div>
                <p className="text-xl font-semibold border-b pb-1 px-8">Student Name</p>
                <p className="text-sm mt-3">for successfully completing</p>
                <p className="font-semibold mt-1">{courseTitle || 'Course title'}</p>
              </div>
              <div className="w-full flex justify-between text-xs gap-2">
                <div>
                  <p className="font-semibold">Date</p>
                  <p className="text-muted-foreground">Issued</p>
                </div>
                <div>
                  <p className="font-semibold">{settings.signatureName || 'Instructor'}</p>
                  <p className="text-muted-foreground">{settings.signatureTitle}</p>
                </div>
                <div>
                  <p className="font-semibold">CODE</p>
                  <p className="text-muted-foreground">Verify</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
