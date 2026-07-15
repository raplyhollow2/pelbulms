'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { haptic } from '@/lib/utils'

export default function ProfilePage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

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
          setFormData({
            full_name: profileData.full_name || '',
            bio: profileData.bio || '',
            avatar_url: profileData.avatar_url || ''
          })
        }

        // Fetch user stats
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('*, courses(*)')
          .eq('user_id', currentUser.id)

        if (enrollments) {
          const completed = enrollments.filter((e: any) => e.progress === 100).length
          setStats({
            enrolledCourses: enrollments.length,
            completedCourses: completed,
            certificates: completed,
            totalProgress: Math.round(
              enrollments.reduce((sum: number, e: any) => sum + (e.progress || 0), 0) / enrollments.length
            )
          })
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    haptic()
    setSaving(true)
    setSuccess(false)

    try {
      const { error } = await supabase
        .from('profiles')
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
        <div>
          <h1 className="text-3xl font-bold mb-2">My Profile</h1>
          <p className="text-muted-foreground">Manage your personal information and preferences</p>
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
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24 bg-bhutan-yellow">
                <AvatarImage src={formData.avatar_url} alt={formData.full_name} />
                <AvatarFallback className="bg-bhutan-yellow text-black font-semibold text-2xl">
                  {formData.full_name ? getInitials(formData.full_name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Camera className="w-4 h-4" />
                  Change Avatar
                </Button>
                <p className="text-xs text-muted-foreground">
                  Recommended: Square image, at least 200x200px
                </p>
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
      </div>
    </div>
  )
}