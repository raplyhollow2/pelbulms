'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Save, Camera, Plus, Trash2, Eye, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadImageDirectToCloudinary } from '@/lib/cloudinary-direct-upload'
import { CertificateEditor } from '@/components/teach/certificate-editor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  defaultCertificateLayout,
  brandLogoSrc,
  layoutFromLegacySettings,
  layoutWithSigners,
  newLayerId,
  signerImageMode,
  signersFromLayout,
  syncSignersFromLayers,
  type CertificateLayout,
  type CertificateSigner,
  type SignerImageMode,
} from '@/lib/certificate-layout'

type CertSettings = {
  brandName: string
  titleLine: string
  accentColor: string
  signatureName: string
  signatureTitle: string
  logoUrl: string
}

type CourseResourcePerson = {
  id: string
  full_name?: string | null
  email?: string | null
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
  const [coursePeople, setCoursePeople] = useState<CourseResourcePerson[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

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

      try {
        const staffRes = await fetch(`/api/teach/staff?courseId=${encodeURIComponent(courseId)}`)
        if (staffRes.ok) {
          const payload = await staffRes.json()
          const onCourse = new Set<string>()
          for (const row of (payload.staff || []) as Array<{ user_id?: string }>) {
            if (row.user_id) onCourse.add(row.user_id)
          }
          if (payload.ownerId) onCourse.add(payload.ownerId)
          const listed = (
            (payload.teachers || []) as Array<{
              id: string
              full_name?: string | null
              email?: string | null
              role?: string
            }>
          )
            .filter((teacher) => teacher.role === 'resource_person' && onCourse.has(teacher.id))
            .map(({ id, full_name, email }) => ({ id, full_name, email }))
          if (
            role === 'resource_person' &&
            onCourse.has(user.id) &&
            !listed.some((person) => person.id === user.id)
          ) {
            listed.unshift({
              id: user.id,
              full_name: (profile as any)?.full_name,
              email: user.email,
            })
          }
          setCoursePeople(listed)
        }
      } catch {
        setCoursePeople([])
      }
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

  const uploadSignature = async (signerId: string, file: File) => {
    setUploading(true)
    try {
      const transparent = await stripNearWhiteBackground(file)
      const { url } = await uploadImageDirectToCloudinary(transparent, {
        folder: `course-media/images/${courseId}/signature`,
      })
      setLayout((prev) => {
        const people = signersFromLayout(prev).map((person) =>
          person.id === signerId ? { ...person, imageUrl: url } : person
        )
        return layoutWithSigners(prev, people, { relayout: false })
      })
      setMessage('Signature image added. Drag it on the canvas, then save.')
    } catch (e: any) {
      setMessage(e?.message || 'Failed to upload signature')
    } finally {
      setUploading(false)
      const input = fileInputs.current[signerId]
      if (input) input.value = ''
    }
  }

  const uploadPortrait = async (signerId: string, file: File) => {
    setUploading(true)
    try {
      const cropped = await cropPortraitCircle(file)
      const { url } = await uploadImageDirectToCloudinary(cropped, {
        folder: `course-media/images/${courseId}/certificate-portraits`,
      })
      if (!url) throw new Error('Cloudinary did not return an image URL')
      setLayout((prev) => {
        const current = signersFromLayout(prev).find((person) => person.id === signerId)
        const people = signersFromLayout(prev).map((person) =>
          person.id === signerId ? { ...person, portraitUrl: url } : person
        )
        const showing = signerImageMode(current || {}) === 'portrait'
        queueMicrotask(() =>
          setMessage(
            showing
              ? 'Profile photo added. Drag it on the canvas, then save.'
              : 'Profile photo saved. Choose Profile photo to show it.'
          )
        )
        return layoutWithSigners(prev, people, { relayout: false })
      })
    } catch (e: any) {
      setMessage(e?.message || 'Failed to upload profile photo')
    } finally {
      setUploading(false)
      const input = fileInputs.current[signerId]
      if (input) input.value = ''
    }
  }

  const useAccountPhoto = async (person: CertificateSigner) => {
    if (!person.userId) return
    setUploading(true)
    setMessage('')
    try {
      const res = await fetch('/api/teach/certificate-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, userId: person.userId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || typeof json.url !== 'string' || !json.url) {
        throw new Error(json.error || 'The account photo was not copied.')
      }
      const url = json.url as string
      setLayout((prev) => {
        const people = signersFromLayout(prev).map((item) =>
          item.id === person.id ? { ...item, portraitUrl: url } : item
        )
        return layoutWithSigners(prev, people, { relayout: false })
      })
      setMessage('Account photo copied. Drag it on the canvas, then save.')
    } catch (e: any) {
      setMessage(e?.message || 'The account photo was not copied.')
    } finally {
      setUploading(false)
    }
  }

  const commitSigners = (
    build: (current: CertificateSigner[]) => CertificateSigner[],
    relayout: boolean
  ) => {
    setLayout((prev) => {
      const nextPeople = build(signersFromLayout(prev))
      const next = layoutWithSigners(prev, nextPeople, { relayout })
      const first = nextPeople[0]
      queueMicrotask(() => {
        setSettings((current) => ({
          ...current,
          signatureName: first?.name || '',
          signatureTitle: first?.title || '',
        }))
      })
      return next
    })
  }

  const studioLayout = {
    ...layout,
    brandName: settings.brandName,
    titleLine: layout.titleLine || settings.titleLine,
    accentColor: layout.accentColor || settings.accentColor,
    signatureName: layout.signatureName || settings.signatureName,
    signatureTitle: layout.signatureTitle || settings.signatureTitle,
  }
  const resourcePersons = signersFromLayout(studioLayout)

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
            signatureName: resourcePersons[0]?.name || '',
            signatureTitle: resourcePersons[0]?.title || '',
            logoUrl: settings.logoUrl || brandLogoSrc(layout.logos) || '',
            layout: {
              ...layout,
              brandName: settings.brandName,
              titleLine: layout.titleLine || settings.titleLine,
              accentColor: layout.accentColor,
              signers: resourcePersons,
              signatureName: resourcePersons[0]?.name || '',
              signatureTitle: resourcePersons[0]?.title || '',
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => router.push(`/teach/courses/${courseId}/edit`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to course
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-2 h-4 w-4" />
            Design preview
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save design
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Certificate studio</h1>
        <p className="text-sm text-muted-foreground">
          Canva-style editor for <strong>{courseTitle}</strong> — drag, resize, and customize with
          digital assets. Start from the Bhutan Official template to match MoLHR-style certificates.
        </p>
      </div>

      <CertificateEditor
        layout={studioLayout}
        onChange={(next) => {
          setLayout((prev) => {
            const resolved = syncSignersFromLayers(typeof next === 'function' ? next(prev) : next)
            queueMicrotask(() => {
              setSettings((current) => ({
                ...current,
                titleLine: resolved.titleLine || current.titleLine,
                accentColor: resolved.accentColor || current.accentColor,
                logoUrl: brandLogoSrc(resolved.logos) || current.logoUrl,
                signatureName: resolved.signatureName || '',
                signatureTitle: resolved.signatureTitle || '',
              }))
            })
            return resolved
          })
        }}
        sampleName="Tshering Pelden"
        sampleCourse={courseTitle || 'Small Business Management'}
        onUploadAsset={uploadAsset}
        uploading={uploading}
        onPreview={() => setPreviewOpen(true)}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[92vh] w-full max-w-[min(1180px,calc(100%-1.5rem))] flex-col gap-3 overflow-hidden sm:max-w-[min(1180px,calc(100%-1.5rem))]">
          <DialogHeader>
            <DialogTitle>Design preview</DialogTitle>
            <DialogDescription>
              Sample certificate for {courseTitle || 'this course'}. Resource persons appear as they
              will on the issued PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <CertificateEditor
              readOnly
              layout={studioLayout}
              onChange={() => {}}
              sampleName="Tshering Pelden"
              sampleCourse={courseTitle || 'Small Business Management'}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Issuance settings</CardTitle>
          <CardDescription>
            Enable certificates and add the resource persons who sign the issued PDF.
          </CardDescription>
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
          <div className="space-y-3 sm:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Label>Resource persons</Label>
                <p className="text-xs text-muted-foreground">
                  Each person shows either a signature or a profile photo with their name.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {coursePeople.length > 0 ? (
                  <select
                    className="min-h-11 rounded-md border bg-background px-3 text-sm"
                    defaultValue=""
                    aria-label="Add a course resource person"
                    onChange={(e) => {
                      const picked = coursePeople.find((person) => person.id === e.target.value)
                      e.target.value = ''
                      if (!picked) return
                      const already = resourcePersons.some((person) => person.userId === picked.id)
                      if (already) {
                        setMessage('That person is already on the certificate.')
                        return
                      }
                      commitSigners(
                        (current) => [
                          ...current,
                          {
                            id: newLayerId('signer'),
                            name: picked.full_name || picked.email || '',
                            title: 'Resource person',
                            imageMode: 'signature',
                            userId: picked.id,
                          },
                        ],
                        true
                      )
                    }}
                  >
                    <option value="">Add from course…</option>
                    {coursePeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name || person.email}
                      </option>
                    ))}
                  </select>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    commitSigners(
                      (current) => [
                        ...current,
                        { id: newLayerId('signer'), name: '', title: 'Resource person', imageMode: 'signature' },
                      ],
                      true
                    )
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add resource person
                </Button>
              </div>
            </div>
            {resourcePersons.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                No resource persons yet. Add one to place a name on the certificate.
              </p>
            ) : (
              resourcePersons.map((person, index) => {
                const mode = signerImageMode(person)
                return (
                  <div key={person.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                    <div>
                      <Label>{index === 0 ? 'Name (primary signer)' : `Name ${index + 1}`}</Label>
                      <Input
                        className="mt-1 min-h-11"
                        value={person.name}
                        onChange={(e) => {
                          const name = e.target.value
                          commitSigners(
                            (current) =>
                              current.map((item) => (item.id === person.id ? { ...item, name } : item)),
                            false
                          )
                        }}
                      />
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input
                        className="mt-1 min-h-11"
                        value={person.title}
                        onChange={(e) => {
                          const title = e.target.value
                          commitSigners(
                            (current) =>
                              current.map((item) =>
                                item.id === person.id ? { ...item, title } : item
                              ),
                            false
                          )
                        }}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Image on the certificate</Label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(['signature', 'portrait'] as SignerImageMode[]).map((choice) => (
                          <Button
                            key={choice}
                            type="button"
                            variant={mode === choice ? 'default' : 'outline'}
                            className="min-h-11"
                            onClick={() =>
                              commitSigners(
                                (current) =>
                                  current.map((item) =>
                                    item.id === person.id ? { ...item, imageMode: choice } : item
                                  ),
                                false
                              )
                            }
                          >
                            {choice === 'signature' ? 'Signature' : 'Profile photo'}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                      {mode === 'signature' ? (
                        <>
                          <input
                            ref={(node) => {
                              fileInputs.current[person.id] = node
                            }}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) void uploadSignature(person.id, file)
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={uploading}
                            onClick={() => fileInputs.current[person.id]?.click()}
                          >
                            <Camera className="mr-2 h-4 w-4" />
                            {person.imageUrl ? 'Replace signature image' : 'Signature image'}
                          </Button>
                        </>
                      ) : (
                        <>
                          {person.portraitUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={person.portraitUrl}
                              alt=""
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : null}
                          <input
                            ref={(node) => {
                              fileInputs.current[person.id] = node
                            }}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) void uploadPortrait(person.id, file)
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={uploading}
                            onClick={() => fileInputs.current[person.id]?.click()}
                          >
                            <UserRound className="mr-2 h-4 w-4" />
                            {person.portraitUrl ? 'Replace profile photo' : 'Profile photo'}
                          </Button>
                          {person.userId && !person.portraitUrl ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11"
                              disabled={uploading}
                              onClick={() => void useAccountPhoto(person)}
                            >
                              Use account photo
                            </Button>
                          ) : null}
                          {person.portraitUrl ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11"
                              onClick={() =>
                                commitSigners(
                                  (current) =>
                                    current.map((item) => {
                                      if (item.id !== person.id) return item
                                      const { portraitUrl: _photo, ...rest } = item
                                      return rest
                                    }),
                                  false
                                )
                              }
                            >
                              Remove photo
                            </Button>
                          ) : null}
                        </>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 text-destructive hover:text-destructive"
                        onClick={() =>
                          commitSigners(
                            (current) => current.filter((item) => item.id !== person.id),
                            true
                          )
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {message && (
            <p className="text-sm text-muted-foreground sm:col-span-2">{message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

async function cropPortraitCircle(file: File): Promise<File> {
  const type = (file.type || '').split(';')[0].trim().toLowerCase()
  if (type !== 'image/jpeg' && type !== 'image/png' && type !== 'image/webp') {
    throw new Error('Use a JPG, PNG, or WEBP photo.')
  }
  const bitmap = await createImageBitmap(file)
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare the photo')
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const dw = bitmap.width * scale
  const dh = bitmap.height * scale
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(bitmap, (size - dw) / 2, (size - dh) / 2, dw, dh)
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((next) => (next ? resolve(next) : reject(new Error('Could not prepare the photo'))), 'image/png')
  )
  return new File([blob], 'portrait.png', { type: 'image/png' })
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
