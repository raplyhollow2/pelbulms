'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, ThumbsUp, MessageCircle, Pin } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface Announcement {
  id: string
  title: string
  content: string
  instructor_name: string
  instructor_avatar?: string
  created_at: string
  is_pinned: boolean
  likes_count: number
  replies_count: number
  user_liked?: boolean
}

interface AnnouncementsListProps {
  courseId: string
  userId?: string
}

export function AnnouncementsList({ courseId, userId }: AnnouncementsListProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnnouncements()
  }, [courseId])

  const loadAnnouncements = async () => {
    try {
      const response = await fetch(`/api/announcements?courseId=${courseId}`)
      if (response.ok) {
        const data = await response.json()
        setAnnouncements(data.announcements || [])
      }
    } catch (error) {
      console.error('Error loading announcements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async (announcementId: string) => {
    if (!userId) return

    try {
      const response = await fetch(`/api/announcements/${announcementId}/like`, {
        method: 'POST'
      })

      if (response.ok) {
        setAnnouncements(announcements.map(announcement =>
          announcement.id === announcementId
            ? {
                ...announcement,
                likes_count: announcement.user_liked
                  ? announcement.likes_count - 1
                  : announcement.likes_count + 1,
                user_liked: !announcement.user_liked
              }
            : announcement
        ))
      }
    } catch (error) {
      console.error('Error liking announcement:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const parseContent = (content: string) => {
    // Simple markdown parsing
    return content
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-secondary/50 p-3 rounded-lg my-2 overflow-x-auto"><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="bg-secondary/30 px-1.5 py-0.5 rounded text-sm">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />')
  }

  if (loading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p>Loading announcements...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Announcements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          {announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No announcements yet</p>
              <p className="text-xs mt-1">Check back later for updates from your instructor</p>
            </div>
          ) : (
            <div className="space-y-4 pr-4">
              {announcements.map((announcement, index) => (
                <div key={announcement.id}>
                  <div
                    className={`p-4 rounded-lg border transition-colors ${
                      announcement.is_pinned
                        ? 'bg-bhutan-yellow/10 border-bhutan-yellow/30'
                        : 'bg-secondary/20 border-border/40'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 bg-bhutan-yellow">
                          <AvatarFallback className="bg-bhutan-yellow text-black font-semibold">
                            {announcement.instructor_name?.split(' ').map(n => n[0]).join('') || 'I'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">
                              {announcement.instructor_name || 'Instructor'}
                            </h4>
                            {announcement.is_pinned && (
                              <Pin className="w-3 h-3 text-bhutan-yellow" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(announcement.created_at)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Announcement
                      </Badge>
                    </div>

                    {/* Title */}
                    <h5 className="font-semibold text-base mb-2">
                      {announcement.title}
                    </h5>

                    {/* Content */}
                    <div
                      className="text-sm text-muted-foreground prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: parseContent(announcement.content) }}
                    />

                    {/* Interactive Footer */}
                    <Separator className="my-3" />
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike(announcement.id)}
                        className={`flex items-center gap-2 ${
                          announcement.user_liked ? 'text-bhutan-yellow' : 'text-muted-foreground'
                        }`}
                      >
                        <ThumbsUp className={`w-4 h-4 ${announcement.user_liked ? 'fill-current' : ''}`} />
                        <span className="text-sm">{announcement.likes_count || 0}</span>
                      </Button>

                      <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-sm">{announcement.replies_count || 0}</span>
                      </Button>
                    </div>
                  </div>

                  {index < announcements.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}