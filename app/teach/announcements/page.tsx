// @ts-nocheck — existing Supabase and UI type drift; remove when database types are regenerated.
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
import { ANNOUNCEMENT_EMAIL_VARS, GLOBAL_COURSE_VALUE, isGlobalCourse } from '@/lib/announcements'
import { canAccessAdmin } from '@/lib/roles'

type EmailTemplateOption = {
  key: string
  label: string
  description: string
  variables: string[]
}

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
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([])
  const [canEmailAllStudents, setCanEmailAllStudents] = useState(false)
  const [brief, setBrief] = useState('')
  const [tone, setTone] = useState('professional')
  const [drafting, setDrafting] = useState(false)
  const [draftNote, setDraftNote] = useState('')

  const [formData, setFormData] = useState({
    course_id: GLOBAL_COURSE_VALUE,
    title: '',
    content: '',
    priority: 'normal',
    is_published: false,
    expires_at: '',
    email_template: '',
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

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const role = (profileData as { role?: string } | null)?.role

      let courseQuery = supabase.from('courses').select('*')
      const seesAllCourses = role === 'superadmin' || role === 'resource_person' || canAccessAdmin(role)
      if (!seesAllCourses) {
        courseQuery = courseQuery.eq('instructor_id', user.id)
      }
      const { data: coursesData } = await courseQuery.order('title', { ascending: true })
      let visibleCourses = (coursesData || []) as Course[]

      if (role === 'admin') {
        const capsRes = await fetch('/api/admin/capabilities/me')
        const caps = await capsRes.json().catch(() => ({}))
        if (capsRes.ok && caps.allInstitutions === false) {
          const orgIds = Array.isArray(caps.institutionIds) ? caps.institutionIds : []
          if (!orgIds.length) {
            visibleCourses = []
          } else {
            const { data: links } = await supabase
              .from('course_institutions')
              .select('course_id')
              .in('institution_id', orgIds)
            const allowed = new Set((links || []).map((row: { course_id?: string }) => row.course_id))
            visibleCourses = visibleCourses.filter((course) => allowed.has(course.id))
          }
        }
      }

      setCourses(visibleCourses)

      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('*, courses(title)')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })

      const optionsRes = await fetch('/api/announcements/options')
      if (optionsRes.ok) {
        const options = await optionsRes.json().catch(() => ({}))
        setTemplates(Array.isArray(options.templates) ? options.templates : [])
        setCanEmailAllStudents(options.canEmailAllStudents === true)
      }

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

  const emptyForm = () => ({
    course_id: GLOBAL_COURSE_VALUE,
    title: '',
    content: '',
    priority: 'normal',
    is_published: false,
    expires_at: '',
    email_template: '',
  })

  const draftWithAi = async () => {
    if (!brief.trim()) return
    setDrafting(true)
    setDraftNote('')
    try {
      const res = await fetch('/api/announcements/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          tone,
          courseId: isGlobalCourse(formData.course_id) ? '' : formData.course_id,
          emailTemplate: formData.email_template,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDraftNote(payload.error || 'Could not draft this announcement')
        return
      }
      setFormData((current) => ({
        ...current,
        title: payload.title || current.title,
        content: payload.content || current.content,
      }))
      setDraftNote('Draft inserted. Nothing is saved or sent until you create the announcement.')
    } finally {
      setDrafting(false)
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
      const global = isGlobalCourse(formData.course_id)

      const supabaseInsert = supabase as any
      const insertPayload: any = {
        author_id: user?.id,
        created_by: user?.id,
        course_id: global ? null : formData.course_id,
        is_global: global,
        title: formData.title,
        content: formData.content,
        priority: formData.priority,
        is_published: (formData as any).is_published,
        publish_at: new Date().toISOString(),
        expires_at: (formData as any).expires_at || null,
      }

      const { error } = await supabaseInsert.from('announcements').insert(insertPayload)

      if (error) throw error

      const published = Boolean((formData as any).is_published)
      const templateKey = formData.email_template
      const shouldNotify = published && (!global || (canEmailAllStudents && Boolean(templateKey)))
      let notice = 'Announcement created successfully!'
      if (shouldNotify) {
        try {
          const res = await fetch('/api/announcements/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseId: global ? '' : formData.course_id,
              title: formData.title,
              message: formData.content,
              emailTemplate: templateKey,
            }),
          })
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}))
            notice = payload.error
              ? `Announcement saved. Notification failed: ${payload.error}`
              : 'Announcement saved, but notifications could not be sent.'
          }
        } catch (notifyErr) {
          console.warn('Announcement notify failed:', notifyErr)
          notice = 'Announcement saved, but notifications could not be sent.'
        }
      }

      alert(notice)
      setShowCreateForm(false)
      setFormData(emptyForm() as any)
      setBrief('')
      setTone('professional')
      setDraftNote('')
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

  const selectedTemplate = templates.find((item) => item.key === formData.email_template) || null
  const extraTemplateFields = (selectedTemplate?.variables || []).filter(
    (item) => !ANNOUNCEMENT_EMAIL_VARS.includes(item as (typeof ANNOUNCEMENT_EMAIL_VARS)[number])
  )
  const globalAnnouncement = isGlobalCourse(formData.course_id)
  const emailHelp = !formData.email_template
    ? 'No email will be sent. Turn a template on under Settings → Email templates if it is missing from this list.'
    : globalAnnouncement && !canEmailAllStudents
      ? 'A global announcement stays in the app. Pick a course to email enrolled learners with this template.'
      : globalAnnouncement
        ? 'When Publish immediately is on, this emails every student with this template.'
        : 'When Publish immediately is on, this emails learners enrolled in this course.'

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Announcement
          </Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="bg-card border border-border shadow-sm">
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
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {isGlobalCourse(formData.course_id)
                        ? 'All courses (global announcement)'
                        : courses.find((course) => course.id === formData.course_id)?.title ||
                          'All courses (global announcement)'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GLOBAL_COURSE_VALUE}>All courses (global announcement)</SelectItem>
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

              <div>
                <Label htmlFor="email-template">System email template</Label>
                <Select
                  value={formData.email_template || 'none'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, email_template: value === 'none' ? '' : value } as any)
                  }
                >
                  <SelectTrigger id="email-template" className="w-full">
                    <SelectValue>
                      {selectedTemplate ? selectedTemplate.label : "Don't send email"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Don't send email</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.key} value={template.key}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">{emailHelp}</p>
                {selectedTemplate ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedTemplate.description ? `${selectedTemplate.description} ` : ''}
                    Fields: {selectedTemplate.variables.map((item) => `{{${item}}}`).join(', ') || 'none'}.
                    This send fills {ANNOUNCEMENT_EMAIL_VARS.map((item) => `{{${item}}}`).join(', ')}.
                    {extraTemplateFields.length
                      ? ` ${extraTemplateFields.map((item) => `{{${item}}}`).join(', ')} will be blank.`
                      : ''}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Draft with AI</p>
                <p className="text-xs text-muted-foreground">
                  Fills the title and content above. Nothing is saved or sent until you create the announcement.
                </p>
                <Textarea
                  rows={3}
                  value={brief}
                  placeholder="What should this announcement say?"
                  onChange={(event) => setBrief(event.target.value.slice(0, 2000))}
                />
                <Input
                  value={tone}
                  aria-label="Tone"
                  placeholder="Tone"
                  onChange={(event) => setTone(event.target.value.slice(0, 40))}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving || drafting || !brief.trim()}
                  onClick={() => void draftWithAi()}
                >
                  {drafting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Draft with AI
                </Button>
                {draftNote ? <p className="text-sm text-muted-foreground">{draftNote}</p> : null}
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
                  className="bg-primary hover:bg-primary/90"
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
        <Card className="bg-card border border-border shadow-sm">
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
                    className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
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
                          {!(announcement as any).is_published && (
                            <Badge variant="secondary" className="text-xs">Draft</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Course: {announcement.courses?.title || 'All courses'}
                        </p>
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