'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Megaphone, Calendar, Bell, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Announcement = Database['public']['Tables']['announcements']['Row'] & {
  courses: { title: string } | null
  profiles: { full_name: string }
}

export default function AnnouncementsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [courseAnnouncements, setCourseAnnouncements] = useState<Record<string, Announcement[]>>({})

  const supabase = createClient()

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Fetch user's enrolled courses
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('user_id', user.id)

      const courseIds = enrollments?.map(e => e.course_id) || []

      // Fetch global announcements (course_id is null)
      const { data: globalAnnouncements } = await supabase
        .from('announcements')
        .select('*, courses(title), profiles(full_name)')
        .is('course_id', null)
        .is('is_published', true)
        .gte('publish_at', new Date().toISOString())
        .or('expires_at.is.null,expires_at.gte.' + new Date().toISOString())
        .order('created_at', { ascending: false })

      // Fetch course-specific announcements
      const { data: courseSpecificAnnouncements } = courseIds.length > 0 ? await supabase
        .from('announcements')
        .select('*, courses(title), profiles(full_name)')
        .in('course_id', courseIds)
        .is('is_published', true)
        .gte('publish_at', new Date().toISOString())
        .or('expires_at.is.null,expires_at.gte.' + new Date().toISOString())
        .order('created_at', { ascending: false }) : { data: [] }

      const allAnnouncements = [
        ...(globalAnnouncements || []),
        ...(courseSpecificAnnouncements || [])
      ]

      // Sort by priority and date
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
      allAnnouncements.sort((a, b) => {
        if (a.priority !== b.priority) {
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      setAnnouncements(allAnnouncements as Announcement[])

      // Group by course
      const grouped = (courseSpecificAnnouncements || []).reduce((acc, announcement) => {
        const courseId = announcement.course_id || 'global'
        if (!acc[courseId]) {
          acc[courseId] = []
        }
        acc[courseId].push(announcement as Announcement)
        return acc
      }, {} as Record<string, Announcement[]>)

      setCourseAnnouncements(grouped)

      // Mark announcements as read
      const unreadAnnouncements = allAnnouncements.filter(a => {
        // Check if user has read this announcement
        return true // Placeholder for read tracking logic
      })

      for (const announcement of unreadAnnouncements) {
        await supabase
          .from('announcement_reads')
          .insert({
            announcement_id: announcement.id,
            user_id: user.id
          })
          .onConflict('announcement_id,user_id')
          .ignore()
      }

    } catch (error) {
      console.error('Error fetching announcements:', error)
      alert('Failed to load announcements. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-red-500 bg-red-50'
      case 'high': return 'border-orange-500 bg-orange-50'
      case 'low': return 'border-blue-500 bg-blue-50'
      default: return 'border-gray-300 bg-gray-50'
    }
  }

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200'
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-200'
      default: return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'high': return <Bell className="w-5 h-5 text-orange-600" />
      default: return null
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
          <div>
            <h1 className="text-3xl font-bold">Announcements</h1>
            <p className="text-muted-foreground">Important updates and notifications</p>
          </div>
          {announcements.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              {announcements.length} {announcements.length === 1 ? 'announcement' : 'announcements'}
            </Badge>
          )}
        </div>

        {/* No Announcements */}
        {announcements.length === 0 && (
          <Card className="glass">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No announcements</h3>
              <p className="text-muted-foreground text-center">
                There are no announcements at the moment. Check back later for updates!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Announcements List */}
        {announcements.length > 0 && (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card
                key={announcement.id}
                className={`glass-strong border-l-4 ${getPriorityColor(announcement.priority)}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getPriorityIcon(announcement.priority)}
                        <CardTitle className="text-xl">{announcement.title}</CardTitle>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getPriorityBadgeColor(announcement.priority)}`}
                        >
                          {announcement.priority}
                        </Badge>
                      </div>
                      {announcement.courses && (
                        <CardDescription className="text-sm">
                          Course: {announcement.courses.title}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-4 whitespace-pre-wrap">{announcement.content}</p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(announcement.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                      {announcement.expires_at && (
                        <span className="flex items-center gap-1">
                          Expires: {new Date(announcement.expires_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      )}
                    </div>
                    {announcement.profiles && (
                      <span>Posted by: {announcement.profiles.full_name}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Group by Course View */}
        {Object.keys(courseAnnouncements).length > 0 && (
          <Card className="glass">
            <CardHeader>
              <CardTitle>Announcements by Course</CardTitle>
              <CardDescription>Course-specific announcements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(courseAnnouncements).map(([courseId, courseAnn]) => (
                  <div key={courseId}>
                    {courseAnn.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold mb-2">
                          {courseAnn[0].courses?.title || 'Global'}
                        </h4>
                        <div className="space-y-2">
                          {courseAnn.map((announcement) => (
                            <div
                              key={announcement.id}
                              className="p-3 border rounded-lg hover:border-bhutan-yellow/50 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <h5 className="font-medium text-sm">{announcement.title}</h5>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getPriorityBadgeColor(announcement.priority)}`}
                                >
                                  {announcement.priority}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {announcement.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}