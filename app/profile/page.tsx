'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveMediaUrl } from '@/lib/media'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { RoleBadge } from '@/components/auth/role-badge'
import { Separator } from '@/components/ui/separator'
import { canAccessTeaching } from '@/lib/roles'
import { linkedinFromProfile, mergeSocialLinks, normalizeLinkedInUrl } from '@/lib/social-links'
import { DZONGKHAGS, normalizeDzongkhag } from '@/lib/dzongkhags'
import { GENDER_OPTIONS } from '@/lib/profile-fields'
import {
  User,
  Calendar,
  Shield,
  BookOpen,
  Award,
  TrendingUp,
  Camera,
  Loader2,
  Save,
  CheckCircle,
  GraduationCap,
  Download,
  ShieldCheck,
} from 'lucide-react'

function storedText(profile: any, key: string, metaKey?: string) {
  const direct = profile?.[key]
  if (typeof direct === 'string' && direct.trim()) return direct
  const meta = profile?.metadata?.[metaKey || key]
  return typeof meta === 'string' ? meta : ''
}

function documentSrc(path?: string | null) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `/api/register/document?path=${encodeURIComponent(path)}`
}

export default function ProfilePage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingKyc, setUploadingKyc] = useState<'passport' | 'cid' | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    avatar_url: '',
    headline: '',
    location: '',
    website: '',
    linkedin: '',
    phone_number: '',
    date_of_birth: '',
    gender: '',
    gewog: '',
    village: '',
    cid_number: '',
    education_level: '',
    passport_photo_url: '',
    cid_photo_url: '',
    pelsung_number: '',
    class_name: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    parent_guardian_name: '',
    parent_guardian_phone: '',
  })

  const [stats, setStats] = useState({
    enrolledCourses: 0,
    completedCourses: 0,
    certificates: 0,
    totalProgress: 0
  })

  const [certificates, setCertificates] = useState<any[]>([])

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      setLoading(true)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      if (currentUser) {
        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single()

        setProfile(profileData)

        if (profileData) {
          const safeProfile = profileData as any
          setFormData({
            full_name: safeProfile.full_name || '',
            bio: safeProfile.bio || '',
            avatar_url: safeProfile.avatar_url || '',
            headline: safeProfile.headline || '',
            location: normalizeDzongkhag(safeProfile.location) || '',
            website: safeProfile.website || '',
            linkedin: linkedinFromProfile(safeProfile) || '',
            phone_number: storedText(safeProfile, 'phone_number'),
            date_of_birth: safeProfile.date_of_birth ? String(safeProfile.date_of_birth).slice(0, 10) : '',
            gender: GENDER_OPTIONS.some((option) => option.value === safeProfile.gender)
              ? safeProfile.gender
              : '',
            gewog: safeProfile.gewog || '',
            village: safeProfile.village || '',
            cid_number: storedText(safeProfile, 'cid_number'),
            education_level: safeProfile.education_level || '',
            passport_photo_url: safeProfile.passport_photo_url || '',
            cid_photo_url: safeProfile.cid_photo_url || '',
            pelsung_number: storedText(safeProfile, 'pelsung_number'),
            class_name: storedText(safeProfile, 'class_name', 'class'),
            emergency_contact_name: safeProfile.emergency_contact_name || '',
            emergency_contact_phone: safeProfile.emergency_contact_phone || '',
            parent_guardian_name: safeProfile.parent_guardian_name || '',
            parent_guardian_phone: safeProfile.parent_guardian_phone || '',
          })
        }

        // Fetch user stats
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('*, courses(*)')
          .eq('user_id', currentUser.id)

        // Fetch real issued certificates
        let issuedCertificates: any[] = []
        try {
          const res = await fetch('/api/certificates', { cache: 'no-store' })
          if (res.ok) {
            const json = await res.json()
            issuedCertificates = json.certificates || []
          }
        } catch (e) {
          console.log('Certificates fetch error (continuing):', e)
        }
        setCertificates(issuedCertificates)

        if (enrollments) {
          const openEnrollments = enrollments.filter((e: any) => e?.courses?.is_published === true)
          const completedEnrollments = openEnrollments.filter(
            (e: any) => (e.progress_percentage ?? 0) >= 100 || e.status === 'completed'
          )
          setStats({
            enrolledCourses: openEnrollments.length,
            completedCourses: completedEnrollments.length,
            certificates: issuedCertificates.length,
            totalProgress: openEnrollments.length
              ? Math.round(
                  openEnrollments.reduce(
                    (sum: number, e: any) => sum + (e.progress_percentage || 0),
                    0
                  ) / openEnrollments.length
                )
              : 0,
          })
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    setError('')

    try {
      const body = new FormData()
      body.append('file', file)

      const res = await fetch('/api/users/avatar', { method: 'POST', body })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Upload failed')

      setFormData((prev) => ({ ...prev, avatar_url: data.avatar_url }))
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error uploading avatar:', err)
      setError(err?.message || 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleKycUpload = async (field: 'passport' | 'cid', file: File) => {
    setUploadingKyc(field)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('field', field)
      const res = await fetch('/api/register/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const key = field === 'cid' ? 'cid_photo_url' : 'passport_photo_url'
      const save = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: data.path }),
      })
      const saved = await save.json()
      if (!save.ok) throw new Error(saved.error || 'Could not save photo')
      setFormData((prev) => ({ ...prev, [key]: data.path }))
    } catch (err: any) {
      setError(err?.message || 'Failed to upload photo')
    } finally {
      setUploadingKyc(null)
    }
  }

  const canShowLinkedIn = canAccessTeaching(profile?.role)
  const linkedinError =
    canShowLinkedIn && formData.linkedin.trim() && !normalizeLinkedInUrl(formData.linkedin)
      ? 'Enter a LinkedIn profile URL, such as https://www.linkedin.com/in/your-name'
      : ''

  const handleSubmit = async () => {
    setSaving(true)
    setSuccess(false)
    setError('')

    try {
      if (linkedinError) {
        setError(linkedinError)
        return
      }

      const nextSocial = canShowLinkedIn
        ? mergeSocialLinks(profile?.social_links, { linkedin: formData.linkedin })
        : undefined

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.full_name,
          bio: formData.bio,
          avatar_url: formData.avatar_url,
          headline: formData.headline,
          website: formData.website,
          phone_number: formData.phone_number,
          date_of_birth: formData.date_of_birth,
          gender: formData.gender,
          location: formData.location,
          gewog: formData.gewog,
          village: formData.village,
          cid_number: formData.cid_number,
          education_level: formData.education_level,
          passport_photo_url: formData.passport_photo_url,
          cid_photo_url: formData.cid_photo_url,
          pelsung_number: formData.pelsung_number,
          class_name: formData.class_name,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          parent_guardian_name: formData.parent_guardian_name,
          parent_guardian_phone: formData.parent_guardian_phone,
          ...(canShowLinkedIn ? { social_links: nextSocial } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save profile')

      if (canShowLinkedIn) {
        setProfile((prev: any) => ({ ...prev, social_links: nextSocial }))
        const saved = normalizeLinkedInUrl(formData.linkedin) || ''
        setFormData((prev) => ({ ...prev, linkedin: saved }))
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError(err?.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-5 sm:px-5 sm:py-7 md:px-6 md:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">My Profile</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your personal information and preferences
          </p>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your personal information and profile picture
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <Avatar className="w-20 h-20 sm:w-24 sm:h-24 bg-primary shrink-0">
                <AvatarImage src={resolveMediaUrl(formData.avatar_url) || undefined} alt={formData.full_name} />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-2xl">
                  {formData.full_name ? getInitials(formData.full_name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingAvatar ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Change photo
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WEBP or GIF. Max 5MB. Square image recommended.
                </p>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile_name">Full name</Label>
                <Input
                  id="profile_name"
                  className="min-h-11"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile_email">Email</Label>
                <Input
                  id="profile_email"
                  type="email"
                  value={user?.email || profile?.email || ''}
                  disabled
                  className="min-h-11 bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Only a superadmin can change the sign-in email.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile_phone">Mobile number</Label>
                  <Input
                    id="profile_phone"
                    inputMode="tel"
                    className="min-h-11"
                    placeholder="+97517123456"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_dob">Date of birth</Label>
                  <Input
                    id="profile_dob"
                    type="date"
                    className="min-h-11"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_gender">Gender</Label>
                  <Select
                    value={formData.gender || '__none__'}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gender: !value || value === '__none__' ? '' : value })
                    }
                  >
                    <SelectTrigger id="profile_gender" className="min-h-11 w-full">
                      <SelectValue>
                        {(value: string | null) =>
                          GENDER_OPTIONS.find((option) => option.value === value)?.label || 'Not set'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {GENDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_dzongkhag">Dzongkhag</Label>
                  <Select
                    value={formData.location || '__none__'}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        location: !value || value === '__none__' ? '' : value,
                      })
                    }
                  >
                    <SelectTrigger id="profile_dzongkhag" className="min-h-11 w-full">
                      <SelectValue>
                        {(value: string | null) => (!value || value === '__none__' ? 'Not set' : value)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {DZONGKHAGS.map((dzongkhag) => (
                        <SelectItem key={dzongkhag} value={dzongkhag}>
                          {dzongkhag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_gewog">Gewog</Label>
                  <Input
                    id="profile_gewog"
                    className="min-h-11"
                    value={formData.gewog}
                    onChange={(e) => setFormData({ ...formData, gewog: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_village">Village</Label>
                  <Input
                    id="profile_village"
                    className="min-h-11"
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_cid">CID number</Label>
                  <Input
                    id="profile_cid"
                    inputMode="numeric"
                    maxLength={11}
                    className="min-h-11"
                    value={formData.cid_number}
                    onChange={(e) =>
                      setFormData({ ...formData, cid_number: e.target.value.replace(/\D/g, '') })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_staff_id">Student / staff ID</Label>
                  <Input
                    id="profile_staff_id"
                    className="min-h-11"
                    value={formData.pelsung_number}
                    onChange={(e) => setFormData({ ...formData, pelsung_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_class">Class</Label>
                  <Input
                    id="profile_class"
                    className="min-h-11"
                    value={formData.class_name}
                    onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_education">Education level</Label>
                  <Input
                    id="profile_education"
                    className="min-h-11"
                    value={formData.education_level}
                    onChange={(e) => setFormData({ ...formData, education_level: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_emergency_name">Emergency contact</Label>
                  <Input
                    id="profile_emergency_name"
                    className="min-h-11"
                    value={formData.emergency_contact_name}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_emergency_phone">Emergency phone</Label>
                  <Input
                    id="profile_emergency_phone"
                    className="min-h-11"
                    value={formData.emergency_contact_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_guardian">Parent / guardian</Label>
                  <Input
                    id="profile_guardian"
                    className="min-h-11"
                    value={formData.parent_guardian_name}
                    onChange={(e) =>
                      setFormData({ ...formData, parent_guardian_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_guardian_phone">Guardian phone</Label>
                  <Input
                    id="profile_guardian_phone"
                    className="min-h-11"
                    value={formData.parent_guardian_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, parent_guardian_phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ['passport', 'Identity photo', formData.passport_photo_url],
                  ['cid', 'CID photo', formData.cid_photo_url],
                ] as const).map(([field, label, path]) => (
                  <div key={field} className="space-y-2">
                    <Label>{label}</Label>
                    {path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={documentSrc(path)}
                        alt={label}
                        className="h-28 w-full rounded-lg border object-cover"
                      />
                    ) : (
                      <div className="flex h-28 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                        No photo
                      </div>
                    )}
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void handleKycUpload(field, file)
                          e.target.value = ''
                        }}
                      />
                      <span className="inline-flex min-h-11 cursor-pointer items-center rounded-md border px-3 text-sm">
                        {uploadingKyc === field ? 'Uploading…' : path ? 'Replace photo' : 'Upload photo'}
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile_headline">Headline</Label>
                <Input
                  id="profile_headline"
                  className="min-h-11"
                  placeholder="e.g. Lecturer in AI-enhanced pedagogy"
                  value={formData.headline}
                  onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile_website">Website</Label>
                <Input
                  id="profile_website"
                  className="min-h-11"
                  placeholder="https://"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
              {canShowLinkedIn && (
                <div className="space-y-2">
                  <Label htmlFor="profile_linkedin">LinkedIn profile</Label>
                  <Input
                    id="profile_linkedin"
                    className="min-h-11"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://www.linkedin.com/in/your-name"
                    value={formData.linkedin}
                    onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown on your public profile and course pages for learners.
                  </p>
                  {linkedinError && (
                    <p className="text-xs text-destructive">{linkedinError}</p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="profile_bio">Bio</Label>
                <Textarea
                  id="profile_bio"
                  placeholder="Tell us about yourself..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {formData.bio.length}/500 characters
                </p>
              </div>
            </div>

            <Separator />

            {/* Role Badge */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Role</p>
                <p className="text-xs text-muted-foreground">Your account role</p>
              </div>
              {profile && <RoleBadge role={profile.role} size="lg" />}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSubmit}
                disabled={saving || Boolean(linkedinError)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              {success && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Profile updated successfully!</span>
                </div>
              )}
              {user?.id && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    window.location.href = `/u/${user.id}`
                  }}
                >
                  View public profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric'
                    }) : 'N/A'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account ID</p>
                <p className="font-medium mt-1 text-sm">{user?.id?.slice(0, 8)}...</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Learning Statistics Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Learning Statistics
            </CardTitle>
            <CardDescription>
              Track your learning progress and achievements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <p className="text-sm text-muted-foreground">Enrolled</p>
                </div>
                <p className="text-2xl font-bold">{stats.enrolledCourses}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
                <p className="text-2xl font-bold">{stats.completedCourses}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-600" />
                  <p className="text-sm text-muted-foreground">Certificates</p>
                </div>
                <p className="text-2xl font-bold">{stats.certificates}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-muted-foreground">Avg Progress</p>
                </div>
                <p className="text-2xl font-bold">{stats.totalProgress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certificates Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Certificates
            </CardTitle>
            <CardDescription>
              Certificates earned from completed courses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {certificates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Award className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">No certificates yet</p>
                <p className="text-xs text-muted-foreground">
                  Complete a course to earn your first certificate
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {certificates.map((cert: any) => (
                  <div
                    key={cert.id}
                    className="flex flex-col gap-3 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950">
                        <Award className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {cert.courses?.title || cert.metadata?.course_title || 'Course'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Issued
                          {cert.issued_at
                            ? ` · ${new Date(cert.issued_at).toLocaleDateString()}`
                            : ''}
                        </p>
                      </div>
                      <Badge className="shrink-0 bg-green-600">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Earned
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {cert.certificate_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(cert.certificate_url, '_blank')}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          Download
                        </Button>
                      )}
                      {cert.verification_code && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(`/verify/${cert.verification_code}`, '_blank')}
                        >
                          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                          Verify
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}