'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Bell,
  ThumbsUp,
  MessageCircle,
  Calendar,
  Pin,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

interface Announcement {
  id: string
  courseId: string
  instructorId: string
  instructorName: string
  instructorAvatar?: string
  title: string
  content: string
  type: 'announcement' | 'update' | 'urgent' | 'milestone'
  isPinned: boolean
  likes: number
  commentCount: number
  createdAt: string
  updatedAt: string
}

interface CourseAnnouncementsProps {
  announcements: Announcement[]
  currentUserId?: string
  onLikeToggle?: (announcementId: string) => void
  onCommentClick?: (announcementId: string) => void
  markAsRead?: (announcementId: string) => void
}

export function CourseAnnouncements({
  announcements,
  currentUserId,
  onLikeToggle,
  onCommentClick,
  markAsRead
}: CourseAnnouncementsProps) {
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(new Set())
  const [expandedAnnouncements, setExpandedAnnouncements] = useState<Set<string>>(new Set())
  const [likedAnnouncements, setLikedAnnouncements] = useState<Set<string>>(new Set())

  // Sort announcements: pinned first, then by date
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Format date to relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Get announcement type styling
  const getAnnouncementType = (type: Announcement['type']) => {
    switch (type) {
      case 'urgent':
        return 'bg-red-500/20 text-red-700 border-red-500/30'
      case 'update':
        return 'bg-blue-500/20 text-blue-700 border-blue-500/30'
      case 'milestone':
        return 'bg-green-500/20 text-green-700 border-green-500/30'
      default:
        return 'bg-purple-500/20 text-purple-700 border-purple-500/30'
    }
  }

  // Handle like toggle
  const handleLikeToggle = (announcementId: string) => {
    setLikedAnnouncements(prev => {
      const newSet = new Set(prev)
      if (newSet.has(announcementId)) {
        newSet.delete(announcementId)
      } else {
        newSet.add(announcementId)
      }
      return newSet
    })

    if (onLikeToggle) {
      onLikeToggle(announcementId)
    }
  }

  // Handle expand/collapse
  const handleExpandToggle = (announcementId: string) => {
    setExpandedAnnouncements(prev => {
      const newSet = new Set(prev)
      if (newSet.has(announcementId)) {
        newSet.delete(announcementId)
      } else {
        newSet.add(announcementId)
      }
      return newSet
    })
  }

  // Mark as read when viewed
  const handleAnnouncementClick = (announcementId: string) => {
    if (!readAnnouncements.has(announcementId) && markAsRead) {
      setReadAnnouncements(prev => new Set(prev).add(announcementId))
      markAsRead(announcementId)
    }
  }

  if (sortedAnnouncements.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="glass max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Announcements Yet</h3>
              <p className="text-muted-foreground text-sm">
                Check back here for course updates and important news!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Unread count indicator */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-bhutan-yellow" />
            <h2 className="text-lg font-semibold">Course Announcements</h2>
          </div>
          {readAnnouncements.size < sortedAnnouncements.length && (
            <Badge variant="secondary" className="animate-pulse">
              {sortedAnnouncements.length - readAnnouncements.size} new
            </Badge>
          )}
        </div>

        {sortedAnnouncements.map((announcement, index) => {
          const isRead = readAnnouncements.has(announcement.id)
          const isLiked = likedAnnouncements.has(announcement.id)
          const isExpanded = expandedAnnouncements.has(announcement.id)

          return (
            <div key={announcement.id}>
              <Card
                className={cn(
                  "glass hover:shadow-lg transition-all duration-200 cursor-pointer",
                  !isRead && "border-l-4 border-l-primary bg-primary/5"
                )}
                onClick={() => handleAnnouncementClick(announcement.id)}
              >
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="w-10 h-10 border-2 border-primary/20">
                        {announcement.instructorAvatar ? (
                          <img
                            src={announcement.instructorAvatar}
                            alt={announcement.instructorName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <AvatarFallback className="bg-bhutan-yellow text-bhutan-yellow-foreground">
                            {announcement.instructorName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {announcement.isPinned && (
                            <Pin className="w-4 h-4 text-bhutan-yellow" />
                          )}
                          {!isRead && (
                            <Badge variant="default" className="bg-primary animate-pulse">
                              New
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn("text-xs", getAnnouncementType(announcement.type))}
                          >
                            {announcement.type}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-base">{announcement.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{announcement.instructorName}</span>
                          <span>•</span>
                          <Calendar className="w-3 h-3" />
                          <span>{formatRelativeTime(announcement.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleExpandToggle(announcement.id)
                      }}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* Content */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          components={{
                            // Custom code block styling
                            code: ({ node, inline, ...props }) =>
                              inline ? (
                                <code
                                  className="px-1 py-0.5 rounded bg-primary/10 text-primary text-xs"
                                  {...props}
                                />
                              ) : (
                                <code
                                  className="block p-3 rounded-lg bg-primary/10 text-primary text-xs overflow-x-auto"
                                  {...props}
                                />
                              ),
                            // Custom link styling
                            a: ({ node, ...props }) => (
                              <a
                                className="text-bhutan-yellow hover:text-bhutan-orange underline"
                                target="_blank"
                                rel="noopener noreferrer"
                                {...props}
                              />
                            )
                          }}
                        >
                          {announcement.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "flex items-center gap-2",
                          isLiked && "text-bhutan-yellow"
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleLikeToggle(announcement.id)
                        }}
                      >
                        <ThumbsUp
                          className={cn(
                            "w-4 h-4",
                            isLiked && "fill-current"
                          )}
                        />
                        <span className="text-xs">
                          {announcement.likes + (isLiked ? 1 : 0)}
                        </span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onCommentClick) {
                            onCommentClick(announcement.id)
                          }
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-xs">{announcement.commentCount}</span>
                      </Button>
                    </div>

                    {isRead && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Check className="w-3 h-3" />
                        <span>Read</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Separator between announcements */}
              {index < sortedAnnouncements.length - 1 && (
                <Separator className="my-4" />
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}