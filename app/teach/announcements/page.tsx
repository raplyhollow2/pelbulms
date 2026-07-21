'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Plus, Trash2, Loader2, Save, Megaphone, Bell, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Announcement = Database['public']['Tables']['announcements']['Row'] & {
  courses: { title: string }
  profiles: { full_name: string }
}

export default function TeacherAnnouncementsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState<Course[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)

  const [formData, setFormData] = useState({
    course_id: '',
    title: '',
    content: '',
    priority: 'normal',
    is_published: false,
    expires_at: ''
  })

  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchAnnouncementsData()
  }, [])

  const fetchAnnouncementsData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Fetch instructor's courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('instructor_id', user.id)
        .order('title', { ascending: true })

      if (coursesData) {
        setCourses(coursesData)
      }

      // Fetch announcements
      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('*, courses(title)')
        .in('course_id', (coursesData as any)?.map((c: any) => c.id) || [])
        .order('created_at', { ascending: false })

      if (announcementsData) {
        setAnnouncements(announcementsData as Announcement[])
      }

    } catch (error) {
      console.error('Error fetching announcements data:', error)
      alert('Failed to load announcements data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAnnouncement = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('Please enter both title and content')
      return
    }

    try {
      setSaving(true)

      const { data: { user } } = await supabase.auth.getUser()

      const supabaseInsert = supabase as any
      const insertPayload: any = {
        author_id: user?.id,
        created_by: user?.id,
        course_id: formData.course_id || null,
        title: formData.title,
        content: formData.content,
        priority: formData.priority,
        is_published: (formData as any).is_published,
        publish_at: new Date().toISOString(),
        expires_at: (formData as any).expires_at || null,
      }

      const { error } = await supabaseInsert.from('announcements').insert(insertPayload)

      if (error) throw error

      // Notify enrolled students when publishing to a course
      if ((formData as any).is_published && formData.course_id) {
        try {
          await fetch('/api/announcements/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseId: formData.course_id,
              title: formData.title,
              message: formData.content.slice(0, 200),
            }),
          })
        } catch (notifyErr) {
          console.warn('Announcement notify failed:', notifyErr)
        }
      }

      alert('Announcement created successfully!')
      setShowCreateForm(false)
      setFormData({
        course_id: '',
        title: '',
        content: '',
        priority: 'normal',
        is_published: false,
        expires_at: ''
      } as any)
      fetchAnnouncementsData()

    } catch (error) {
      console.error('Error creating announcement:', error)
      alert('Failed to create announcement. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (error) throw error

      setAnnouncements(announcements.filter((a: any) => a.id !== id))
      alert('Announcement deleted successfully!')
    } catch (error) {
      console.error('Error deleting announcement:', error)
      alert('Failed to delete announcement. Please try again.')
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'low': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Loading announcements...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/teach/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Announcements</h1>
              <p className="text-muted-foreground">Communicate with your students</p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-bhutan-yellow hover:bg-bhutan-orange"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Announcement
          </Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="glass-strong">
            <CardHeader>
              <CardTitle>Create Announcement</CardTitle>
              <CardDescription>Send an announcement to your students</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="course">Target Course (Optional)</Label>
                <Select
                  value={formData.course_id}
                  onValueChange={(value) => setFormData({ ...formData, course_id: value } as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All courses (global announcement)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All courses (global announcement)</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value } as any)}
                  placeholder="Important course update..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value } as any)}
                  placeholder="Your announcement content..."
                  rows={5}
                  className="mt-1 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value } as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="expires">Expiration Date</Label>
                  <Input
                    id="expires"
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value } as any)}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="published"
                    checked={(formData as any).is_published}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked } as any)}
                  />
                  <Label htmlFor="published">Publish immediately</Label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleCreateAnnouncement}
                  disabled={saving}
                  className="bg-bhutan-yellow hover:bg-bhutan-orange"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Create Announcement
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Announcements */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Your Announcements</CardTitle>
            <CardDescription>Manage your course announcements</CardDescription>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No announcements yet. Create your first announcement to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="p-4 border rounded-lg hover:border-bhutan-yellow/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{announcement.title}</h3>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getPriorityColor(announcement.priority)}`}
                          >
                            {announcement.priority}
                          </Badge>
                          {!(announcement as any).is_global && (
                            <Badge variant="secondary" className="text-xs">Draft</Badge>
                          )}
                        </div>
                        {announcement.courses && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Course: {announcement.courses.title}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {announcement.content}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(announcement.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
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