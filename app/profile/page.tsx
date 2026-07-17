'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  User,
  Mail,
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

export default function ProfilePage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    avatar_url: ''
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
            avatar_url: safeProfile.avatar_url || ''
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

        if (enrollments && enrollments.length > 0) {
          const completedEnrollments = enrollments.filter(
            (e: any) => (e.progress_percentage ?? 0) >= 100 || e.status === 'completed'
          )
          setStats({
            enrolledCourses: enrollments.length,
            completedCourses: completedEnrollments.length,
            certificates: issuedCertificates.length,
            totalProgress: Math.round(
              enrollments.reduce(
                (sum: number, e: any) => sum + (e.progress_percentage || 0),
                0
              ) / enrollments.length
            ),
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

  const handleSubmit = async () => {
    setSaving(true)
    setSuccess(false)

    try {
      const { error } = await supabase
        .from('profiles')
        // @ts-ignore - Supabase types not properly defined
        .update({
          full_name: formData.full_name,
          bio: formData.bio,
          avatar_url: formData.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Error updating profile:', error)
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

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      student: { label: 'Student', color: 'bg-blue-600' },
      instructor: { label: 'Instructor', color: 'bg-purple-600' },
      admin: { label: 'Admin', color: 'bg-red-600' }
    }
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.student
    return <Badge className={config.color}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
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
              <Avatar className="w-20 h-20 sm:w-24 sm:h-24 bg-bhutan-yellow shrink-0">
                <AvatarImage src={formData.avatar_url} alt={formData.full_name} />
                <AvatarFallback className="bg-bhutan-yellow text-black font-semibold text-2xl">
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
                      Change Avatar
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

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  placeholder="Enter your full name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <Input
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Bio</label>
                <Textarea
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
              {profile && getRoleBadge(profile.role)}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
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
                  <BookOpen className="w-5 h-5 text-bhutan-yellow" />
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