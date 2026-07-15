'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Bell,
  Mail,
  Palette,
  Lock,
  Video,
  Globe,
  Loader2,
  Save,
  CheckCircle,
  Sparkles,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react'
import { haptic } from '@/lib/utils'

export default function SettingsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const [localSettings, setLocalSettings] = useState({
    // Notification Settings
    email_notifications: true,
    push_notifications: true,
    course_updates: true,
    announcement_notifications: true,
    message_notifications: true,

    // Appearance Settings
    theme: 'system',
    language: 'en',
    timezone: 'UTC',

    // Privacy Settings
    profile_visibility: 'public',
    show_progress: true,
    show_certificates: true,

    // Learning Preferences
    auto_play_video: false,
    video_quality: 'auto',
    playback_speed: 1.00,
    subtitle_language: 'en',

    // Email Digest
    digest_frequency: 'weekly'
  })

  useEffect(() => {
    fetchUserSettings()
  }, [])

  const fetchUserSettings = async () => {
    try {
      setLoading(true)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      if (currentUser) {
        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', currentUser.id)
          .single()

        if (settingsData) {
          setSettings(settingsData)
          setLocalSettings(settingsData)
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    haptic()
    setSaving(true)
    setSuccess(false)

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({
          ...localSettings,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (error) throw error

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (key: string, value: boolean) => {
    setLocalSettings({ ...localSettings, [key]: value })
  }

  const handleSelect = (key: string, value: string) => {
    setLocalSettings({ ...localSettings, [key]: value })
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
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences and configuration</p>
        </div>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Choose how you want to be notified about updates and activities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                checked={localSettings.email_notifications}
                onCheckedChange={(checked) => handleToggle('email_notifications', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive push notifications in browser
                </p>
              </div>
              <Switch
                checked={localSettings.push_notifications}
                onCheckedChange={(checked) => handleToggle('push_notifications', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Course Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when your courses are updated
                </p>
              </div>
              <Switch
                checked={localSettings.course_updates}
                onCheckedChange={(checked) => handleToggle('course_updates', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Announcements</Label>
                <p className="text-sm text-muted-foreground">
                  Receive platform announcements and news
                </p>
              </div>
              <Switch
                checked={localSettings.announcement_notifications}
                onCheckedChange={(checked) => handleToggle('announcement_notifications', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Messages</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified for new messages
                </p>
              </div>
              <Switch
                checked={localSettings.message_notifications}
                onCheckedChange={(checked) => handleToggle('message_notifications', checked)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Email Digest Frequency</Label>
              <Select
                value={localSettings.digest_frequency}
                onValueChange={(value) => handleSelect('digest_frequency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Digest</SelectItem>
                  <SelectItem value="weekly">Weekly Digest</SelectItem>
                  <SelectItem value="monthly">Monthly Digest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how the platform looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={localSettings.theme}
                onValueChange={(value) => handleSelect('theme', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={localSettings.language}
                onValueChange={(value) => handleSelect('language', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="dz">Dzongkha</SelectItem>
                  <SelectItem value="ne">Nepali</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={localSettings.timezone}
                onValueChange={(value) => handleSelect('timezone', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Asia/Thimphu">Thimphu (BST)</SelectItem>
                  <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                  <SelectItem value="Asia/Dhaka">Bangladesh (BST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Privacy
            </CardTitle>
            <CardDescription>
              Control your privacy and data visibility
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Profile Visibility</Label>
              <Select
                value={localSettings.profile_visibility}
                onValueChange={(value) => handleSelect('profile_visibility', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="connections">Connections Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Progress</Label>
                <p className="text-sm text-muted-foreground">
                  Allow others to see your course progress
                </p>
              </div>
              <Switch
                checked={localSettings.show_progress}
                onCheckedChange={(checked) => handleToggle('show_progress', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Certificates</Label>
                <p className="text-sm text-muted-foreground">
                  Display your certificates publicly
                </p>
              </div>
              <Switch
                checked={localSettings.show_certificates}
                onCheckedChange={(checked) => handleToggle('show_certificates', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Learning Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Learning Preferences
            </CardTitle>
            <CardDescription>
              Customize your learning experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-play Videos</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically play next video in sequence
                </p>
              </div>
              <Switch
                checked={localSettings.auto_play_video}
                onCheckedChange={(checked) => handleToggle('auto_play_video', checked)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Video Quality</Label>
              <Select
                value={localSettings.video_quality}
                onValueChange={(value) => handleSelect('video_quality', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="1080p">1080p HD</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="480p">480p SD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Playback Speed: {localSettings.playback_speed}x</Label>
              <Select
                value={localSettings.playback_speed.toString()}
                onValueChange={(value) => handleSelect('playback_speed', parseFloat(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x</SelectItem>
                  <SelectItem value="0.75">0.75x</SelectItem>
                  <SelectItem value="1.0">1x (Normal)</SelectItem>
                  <SelectItem value="1.25">1.25x</SelectItem>
                  <SelectItem value="1.5">1.5x</SelectItem>
                  <SelectItem value="2.0">2x</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Subtitle Language</Label>
              <Select
                value={localSettings.subtitle_language}
                onValueChange={(value) => handleSelect('subtitle_language', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="dz">Dzongkha</SelectItem>
                  <SelectItem value="ne">Nepali</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
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
                Save Settings
              </>
            )}
          </Button>
          {success && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Settings saved successfully!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}