'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Loader2,
  AlertCircle,
  Upload,
  CheckCircle2,
  IdCard,
  UserRound,
  Building2,
  GraduationCap,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { RegistrationPolicy } from '@/lib/platform-settings'

const DZONGKHAGS = [
  'Bumthang', 'Chukha', 'Dagana', 'Gasa', 'Haa', 'Lhuentse', 'Mongar', 'Paro',
  'Pema Gatshel', 'Punakha', 'Samdrup Jongkhar', 'Samtse', 'Sarpang', 'Thimphu',
  'Trashigang', 'Trashiyangtse', 'Trongsa', 'Tsirang', 'Wangdue Phodrang', 'Zhemgang',
]

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student / Learner' },
  { value: 'instructor', label: 'Teacher / Instructor' },
  { value: 'resource_person', label: 'Resource Person' },
]

const HEAR_ABOUT = [
  'School / institute',
  'Teacher',
  'Social media',
  'Friend / family',
  'Government programme',
  'Other',
]

const DEFAULT_POLICY: RegistrationPolicy = {
  require_identity_documents: true,
  require_qualification: false,
  require_student_id: false,
  require_emergency_contact: false,
  require_tos_consent: false,
  collect_hear_about_us: false,
}

type StepId = 'personal' | 'identity' | 'institution' | 'academic'
type Institution = { id: string; name: string; slug: string; display_name?: string }

function buildSteps(policy: RegistrationPolicy) {
  const steps: { id: StepId; title: string; icon: typeof UserRound }[] = [
    { id: 'personal', title: 'Personal', icon: UserRound },
  ]
  if (policy.require_identity_documents) {
    steps.push({ id: 'identity', title: 'Identity', icon: IdCard })
  }
  steps.push({ id: 'institution', title: 'Institution', icon: Building2 })
  if (policy.require_qualification) {
    steps.push({ id: 'academic', title: 'Academic', icon: GraduationCap })
  }
  return steps
}

function PhotoUpload({
  label,
  hint,
  field,
  value,
  onUploaded,
}: {
  label: string
  hint: string
  field: 'passport' | 'cid'
  value: { path: string; previewUrl: string | null } | null
  onUploaded: (v: { path: string; previewUrl: string | null }) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('field', field)
      const res = await fetch('/api/register/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onUploaded({ path: data.path, previewUrl: data.previewUrl })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-bhutan-yellow hover:bg-muted/50"
      >
        {value?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.previewUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center text-muted-foreground">
            {uploading ? (
              <Loader2 className="h-7 w-7 animate-spin text-bhutan-orange" />
            ) : (
              <Upload className="h-7 w-7" />
            )}
            <span className="text-xs">{hint}</span>
          </div>
        )}
        {value?.path && !uploading && (
          <span className="absolute right-2 top-2 rounded-full bg-green-600 p-1 text-white">
            <CheckCircle2 className="h-4 w-4" />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [policy, setPolicy] = useState<RegistrationPolicy>(DEFAULT_POLICY)
  const [siteName, setSiteName] = useState('Pelbu LMS')
  const [tosAccepted, setTosAccepted] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    phone_number: '+975',
    cid_number: '',
    date_of_birth: '',
    gender: '',
    institution_id: '',
    requested_role: 'student',
    village: '',
    gewog: '',
    dzongkhag: '',
    class: '',
    education_level: '',
    parent_guardian_name: '',
    parent_guardian_phone: '',
    motivation_statement: '',
    pelsung_number: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    hear_about_us: '',
  })
  const [infoNotes, setInfoNotes] = useState<string | null>(null)
  const [isResubmit, setIsResubmit] = useState(false)
  const [passport, setPassport] = useState<{ path: string; previewUrl: string | null } | null>(null)
  const [cid, setCid] = useState<{ path: string; previewUrl: string | null } | null>(null)

  const steps = useMemo(() => buildSteps(policy), [policy])
  const currentId = steps[step]?.id
  const lastIndex = steps.length - 1

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/register')
        if (res.status === 401) {
          router.push('/auth/login')
          return
        }
        const data = await res.json()
        setInstitutions(data.institutions || [])
        if (data.policy) setPolicy({ ...DEFAULT_POLICY, ...data.policy })
        if (data.site_name) setSiteName(data.site_name)
        setForm((f) => ({
          ...f,
          full_name: data.user?.full_name || '',
          institution_id: data.institutions?.[0]?.id || '',
        }))
        if (data.account_status === 'suspended') {
          router.push('/auth/access-denied')
          return
        }
        if (data.account_status === 'active') {
          await supabase.auth.refreshSession()
          router.push('/dashboard')
          return
        }
        const regStatus = data.registration?.registration_status as string | undefined
        if (regStatus === 'approved') {
          await supabase.auth.refreshSession()
          router.push('/dashboard')
          return
        }
        if (regStatus === 'submitted' || regStatus === 'under_review') {
          router.push('/auth/pending-approval')
          return
        }
        if (regStatus === 'additional_info_requested') {
          setInfoNotes(data.registration?.review_notes || 'Please update your details and resubmit.')
        }
        if (regStatus === 'rejected' || data.account_status === 'rejected') {
          setIsResubmit(true)
          setInfoNotes(data.registration?.rejection_reason || data.registration?.review_notes || null)
        }
      } catch {
        setError('Could not load registration form. Please refresh.')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const institutionLabel = (id: string) => {
    const i = institutions.find((x) => x.id === id)
    return i?.display_name || i?.name || 'Select your institution'
  }

  const extrasOnThisStep = currentId === steps[lastIndex]?.id

  const validateStepId = (id: StepId): string | null => {
    if (id === 'personal') {
      if (!form.full_name.trim()) return 'Please enter your full name.'
      if (!/^\+975[0-9]{8}$/.test(form.phone_number))
        return 'Phone must be +975 followed by 8 digits.'
      if (!form.date_of_birth) return 'Please enter your date of birth.'
      if (!form.gender) return 'Please select your gender.'
      return null
    }
    if (id === 'identity') {
      if (!/^[0-9]{11}$/.test(form.cid_number)) return 'CID number must be exactly 11 digits.'
      if (!passport?.path) return 'Please upload your passport-size photo.'
      if (!cid?.path) return 'Please upload a photo of your CID.'
      if (!form.dzongkhag) return 'Please select your dzongkhag.'
      if (!form.gewog.trim()) return 'Please enter your gewog.'
      return null
    }
    if (id === 'institution') {
      if (!form.institution_id) return 'Please select your institution.'
      if (!form.requested_role) return 'Please select your role.'
      if (policy.require_student_id && !form.pelsung_number.trim()) {
        return 'Please enter your student or staff ID.'
      }
      return null
    }
    if (id === 'academic') {
      if (policy.require_qualification && !form.education_level.trim()) {
        return 'Please enter your education level.'
      }
      return null
    }
    return null
  }

  const validateExtras = (): string | null => {
    if (policy.require_emergency_contact) {
      if (!form.emergency_contact_name.trim()) return 'Please enter an emergency contact name.'
      if (!form.emergency_contact_phone.trim()) return 'Please enter an emergency contact phone.'
    }
    if (policy.require_tos_consent && !tosAccepted) {
      return 'Please accept the terms to continue.'
    }
    return null
  }

  const goNext = () => {
    setError('')
    const err = validateStepId(currentId)
    if (err) {
      setError(err)
      return
    }
    if (step === lastIndex) {
      const extraErr = validateExtras()
      if (extraErr) {
        setError(extraErr)
        return
      }
    }
    setStep((s) => Math.min(s + 1, lastIndex))
  }

  const goBack = () => {
    setError('')
    setStep((s) => Math.max(s - 1, 0))
  }

  const handleSubmit = async () => {
    setError('')
    for (let i = 0; i < steps.length; i++) {
      const err = validateStepId(steps[i].id)
      if (err) {
        setStep(i)
        setError(err)
        return
      }
    }
    const extraErr = validateExtras()
    if (extraErr) {
      setError(extraErr)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          passport_photo_url: passport?.path || null,
          cid_photo_url: cid?.path || null,
          tos_accepted: tosAccepted,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      if (data.activated) {
        await supabase.auth.refreshSession()
        router.push('/dashboard')
        return
      }
      router.push('/auth/pending-approval')
    } catch (e: any) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  const extrasBlock = extrasOnThisStep && (
    <div className="grid gap-4">
      {policy.require_emergency_contact && (
        <>
          <div className="space-y-2">
            <Label>Emergency contact name</Label>
            <Input
              value={form.emergency_contact_name}
              onChange={(e) => set('emergency_contact_name', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Emergency contact phone</Label>
            <Input
              value={form.emergency_contact_phone}
              onChange={(e) => set('emergency_contact_phone', e.target.value)}
              placeholder="+975..."
            />
          </div>
        </>
      )}
      {policy.collect_hear_about_us && (
        <div className="space-y-2">
          <Label>How did you hear about us? (optional)</Label>
          <Select
            value={form.hear_about_us}
            onValueChange={(v) => set('hear_about_us', v ?? '')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select">
                {(v: string | null) => v || 'Select'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HEAR_ABOUT.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {policy.require_tos_consent && (
        <label className="flex items-start gap-2.5 text-sm leading-snug">
          <Checkbox
            checked={tosAccepted}
            onCheckedChange={(v) => setTosAccepted(v === true)}
            className="mt-0.5"
          />
          <span>
            I agree to the {siteName} terms of service and privacy policy, and confirm that the
            information I provided is accurate.
          </span>
        </label>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white px-4 py-6 pb-[calc(2rem+env(safe-area-inset-bottom))] dark:from-gray-900 dark:via-gray-900 dark:to-black">
      <div className="mx-auto w-full max-w-lg space-y-5">
        <div className="text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full glass-strong px-5 py-2">
            <BookOpen className="h-6 w-6 text-bhutan-yellow" />
            <span className="bg-gradient-to-r from-bhutan-yellow to-bhutan-orange bg-clip-text text-lg font-bold text-transparent">
              {siteName}
            </span>
          </div>
          <h1 className="text-2xl font-bold">
            {policy.require_identity_documents ? 'Verify your identity' : 'Complete your profile'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {policy.require_identity_documents
              ? 'Bhutan KYC is required before you can request a course. Upload your CID and a passport photo.'
              : 'Tell us who you are and which institution you are joining.'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Step {step + 1} of {steps.length} — tap Next when you are ready.
          </p>
        </div>

        {infoNotes && (
          <div
            role="status"
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-900 dark:text-amber-200"
          >
            {isResubmit ? 'Your previous application was not approved. ' : 'More information requested. '}
            {infoNotes}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => {
            const Icon = s.icon
            const active = i === step
            const done = i < step
            return (
              <div key={s.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                    active && 'border-transparent bg-gradient-to-br from-bhutan-yellow to-bhutan-orange text-black',
                    done && 'border-green-600/40 bg-green-600/15 text-green-700',
                    !active && !done && 'border-border bg-muted/40 text-muted-foreground'
                  )}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={cn(
                    'truncate text-[10px] font-medium',
                    active ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {s.title}
                </span>
              </div>
            )
          })}
        </div>

        {currentId === 'personal' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserRound className="h-5 w-5" /> Personal details
              </CardTitle>
              <CardDescription>Tell us who you are.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label>Full name{policy.require_identity_documents ? ' (as on CID)' : ''}</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone number</Label>
                <Input
                  value={form.phone_number}
                  onChange={(e) => set('phone_number', e.target.value)}
                  placeholder="+97517123456"
                />
              </div>
              <div className="space-y-2">
                <Label>Date of birth</Label>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => set('date_of_birth', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => set('gender', v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select">
                      {(v: string | null) =>
                        v === 'male' ? 'Male' : v === 'female' ? 'Female' : v === 'other' ? 'Other' : 'Select'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {extrasBlock}
            </CardContent>
          </Card>
        )}

        {currentId === 'identity' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <IdCard className="h-5 w-5" /> Identity verification
              </CardTitle>
              <CardDescription>
                CID details, photos, and your home location (dzongkhag / gewog / village).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>CID number (11 digits)</Label>
                <Input
                  value={form.cid_number}
                  inputMode="numeric"
                  maxLength={11}
                  onChange={(e) => set('cid_number', e.target.value.replace(/\D/g, ''))}
                  placeholder="10101000000"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <PhotoUpload
                  label="Passport-size photo"
                  hint="Tap to upload a clear passport photo"
                  field="passport"
                  value={passport}
                  onUploaded={setPassport}
                />
                <PhotoUpload
                  label="CID photo"
                  hint="Tap to upload a photo of your CID"
                  field="cid"
                  value={cid}
                  onUploaded={setCid}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Dzongkhag</Label>
                  <Select value={form.dzongkhag} onValueChange={(v) => set('dzongkhag', v ?? '')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select dzongkhag">
                        {(v: string | null) => v || 'Select dzongkhag'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {DZONGKHAGS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gewog</Label>
                  <Input
                    value={form.gewog}
                    onChange={(e) => set('gewog', e.target.value)}
                    placeholder="Gewog"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Village (optional)</Label>
                  <Input
                    value={form.village}
                    onChange={(e) => set('village', e.target.value)}
                    placeholder="Village"
                  />
                </div>
              </div>
              {extrasBlock}
            </CardContent>
          </Card>
        )}

        {currentId === 'institution' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" /> Institution
              </CardTitle>
              <CardDescription>Choose the institute you are registering under.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label>Institution</Label>
                <Select
                  value={form.institution_id}
                  onValueChange={(v) => set('institution_id', v ?? '')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your institution">
                      {(v: string | null) => (v ? institutionLabel(v) : 'Select your institution')}
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
              </div>
              <div className="space-y-2">
                <Label>I am registering as</Label>
                <Select
                  value={form.requested_role}
                  onValueChange={(v) => set('requested_role', v ?? 'student')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: string | null) =>
                        ROLE_OPTIONS.find((r) => r.value === v)?.label || 'Select role'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {policy.require_student_id && (
                <div className="space-y-2">
                  <Label>Student / staff ID</Label>
                  <Input
                    value={form.pelsung_number}
                    onChange={(e) => set('pelsung_number', e.target.value)}
                    placeholder="Dessung or Pelsung number"
                  />
                </div>
              )}
              {extrasBlock}
            </CardContent>
          </Card>
        )}

        {currentId === 'academic' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="h-5 w-5" /> Academic background
              </CardTitle>
              <CardDescription>
                {policy.require_qualification
                  ? 'Required so reviewers can place you correctly.'
                  : 'Optional, but helps reviewers place you correctly.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label>Class / Grade</Label>
                <Input
                  value={form.class}
                  onChange={(e) => set('class', e.target.value)}
                  placeholder="e.g. Class 10"
                />
              </div>
              <div className="space-y-2">
                <Label>Education level{policy.require_qualification ? '' : ' (optional)'}</Label>
                <Input
                  value={form.education_level}
                  onChange={(e) => set('education_level', e.target.value)}
                  placeholder="e.g. Higher Secondary"
                />
              </div>
              <div className="space-y-2">
                <Label>Parent/Guardian name</Label>
                <Input
                  value={form.parent_guardian_name}
                  onChange={(e) => set('parent_guardian_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Parent/Guardian phone</Label>
                <Input
                  value={form.parent_guardian_phone}
                  onChange={(e) => set('parent_guardian_phone', e.target.value)}
                  placeholder="+975..."
                />
              </div>
              <div className="space-y-2">
                <Label>Why do you want to join? (optional)</Label>
                <Textarea
                  rows={3}
                  value={form.motivation_statement}
                  onChange={(e) => set('motivation_statement', e.target.value)}
                  placeholder="A short motivation statement"
                />
              </div>
              {extrasBlock}
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            {step > 0 && (
              <Button type="button" variant="outline" className="h-12 flex-1 gap-1" onClick={goBack}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {step < lastIndex ? (
              <Button
                type="button"
                onClick={goNext}
                className="h-12 flex-1 gap-1 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="h-12 flex-1 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : policy.require_identity_documents ? (
                  'Submit for review'
                ) : (
                  'Finish and continue'
                )}
              </Button>
            )}
          </div>
          <Button variant="ghost" onClick={handleSignOut} className="h-11 gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
