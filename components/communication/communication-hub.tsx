// @ts-nocheck - Supabase type inference issues documented in TYPESCRIPT_ISSUES.md
'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MessageSquare,
  Users,
  Send,
  Search,
  Bell,
  Pin,
  Lock,
  Globe,
  FileText,
  Reply,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  TrendingUp,
  Eye,
  Star,
  AlertTriangle,
  Plus,
  Settings,
  MoreVertical,
  Smile,
  Paperclip,
  Image,
  Video,
  Mic,
  Phone,
  UserCircle2,
  Check,
  CheckCheck
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface ForumPost {
  id: string
  title: string
  content: string
  author: {
    id: string
    name: string
    avatar?: string
    role: 'student' | 'instructor' | 'admin'
  }
  category: string
  tags: string[]
  created_at: string
  updated_at: string
  views: number
  replies: number
  likes: number
  is_pinned: boolean
  is_locked: boolean
  is_announcement: boolean
}

interface ForumReply {
  id: string
  post_id: string
  content: string
  author: {
    id: string
    name: string
    avatar?: string
    role: 'student' | 'instructor' | 'admin'
  }
  created_at: string
  updated_at: string
  likes: number
  is_accepted_answer: boolean
  parent_reply_id?: string
}

interface DirectMessage {
  id: string
  conversation_id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  read_at?: string
  status: 'sent' | 'delivered' | 'read'
  attachments?: MessageAttachment[]
}

interface MessageAttachment {
  id: string
  type: 'image' | 'file' | 'video' | 'audio'
  url: string
  name: string
  size: number
}

interface Conversation {
  id: string
  participants: {
    id: string
    name: string
    avatar?: string
    role: 'student' | 'instructor' | 'admin'
    online: boolean
  }[]
  last_message: {
    content: string
    created_at: string
    sender_id: string
  }
  unread_count: number
  created_at: string
  is_group: boolean
  group_name?: string
}

interface Announcement {
  id: string
  title: string
  content: string
  author: {
    id: string
    name: string
    role: 'instructor' | 'admin'
  }
  priority: 'low' | 'medium' | 'high' | 'urgent'
  target_audience: 'all' | 'students' | 'instructors' | 'course_specific'
  course_id?: string
  created_at: string
  expires_at?: string
  attachments?: MessageAttachment[]
}

export function CommunicationHub() {
  const [activeTab, setActiveTab] = useState<'forums' | 'messages' | 'announcements'>('forums')
  const [forums, setForums] = useState<ForumPost[]>([])
  const [replies, setReplies] = useState<ForumReply[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [selectedForum, setSelectedForum] = useState<ForumPost | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [newPostContent, setNewPostContent] = useState('')
  const [newReplyContent, setNewReplyContent] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [userRole, setUserRole] = useState<'student' | 'instructor' | 'admin'>('instructor')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchForums()
    fetchConversations()
    fetchAnnouncements()

    // Subscribe to real-time updates
    const channels = [
      supabase.channel('forum_posts'),
      supabase.channel('direct_messages'),
      supabase.channel('announcements')
    ]

    channels.forEach(channel => {
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_posts' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setForums(prev => [payload.new as ForumPost, ...prev])
          }
        })
        .subscribe()
    })

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel))
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchForums = async () => {
    const { data, error } = await supabase
      .from('forum_posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setForums(data as ForumPost[])
    }
  }

  const fetchConversations = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*, participants(conversation_participants(*))')
      .order('updated_at', { ascending: false })

    if (!error && data) {
      setConversations(data as Conversation[])
    }
  }

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setMessages(data as DirectMessage[])
    }
  }

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setAnnouncements(data as Announcement[])
    }
  }

  const createForumPost = async () => {
    if (!newPostContent.trim()) return

    const newPost: Partial<ForumPost> = {
      title: 'New Discussion Post',
      content: newPostContent,
      author: {
        id: 'current-user',
        name: 'Current User',
        role: userRole
      },
      category: 'General',
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      views: 0,
      replies: 0,
      likes: 0,
      is_pinned: false,
      is_locked: false,
      is_announcement: false
    }

    const { error } = await supabase
      .from('forum_posts')
      .insert(newPost)

    if (!error) {
      setNewPostContent('')
      fetchForums()
    }
  }

  const createReply = async (postId: string) => {
    if (!newReplyContent.trim()) return

    const newReply: Partial<ForumReply> = {
      post_id: postId,
      content: newReplyContent,
      author: {
        id: 'current-user',
        name: 'Current User',
        role: userRole
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      likes: 0,
      is_accepted_answer: false
    }

    const { error } = await supabase
      .from('forum_replies')
      .insert(newReply)

    if (!error) {
      setNewReplyContent('')
      // Update reply count
      setForums(prev => prev.map(forum =>
        forum.id === postId
          ? { ...forum, replies: forum.replies + 1 }
          : forum
      ))
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    setIsSending(true)

    const message: Partial<DirectMessage> = {
      conversation_id: selectedConversation.id,
      sender_id: 'current-user',
      receiver_id: selectedConversation.participants.find(p => p.id !== 'current-user')?.id || '',
      content: newMessage,
      created_at: new Date().toISOString(),
      status: 'sent'
    }

    const { error } = await supabase
      .from('direct_messages')
      .insert(message)

    if (!error) {
      setNewMessage('')
      setMessages(prev => [...prev, message as DirectMessage])
    }

    setIsSending(false)
  }

  const createAnnouncement = async () => {
    const announcement: Partial<Announcement> = {
      title: 'New Announcement',
      content: 'Important announcement for all users',
      author: {
        id: 'current-user',
        name: 'Administrator',
        role: 'admin'
      },
      priority: 'medium',
      target_audience: 'all',
      created_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('announcements')
      .insert(announcement)

    if (!error) {
      fetchAnnouncements()
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    return date.toLocaleDateString()
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive'
      case 'high': return 'default'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Communication Hub</h2>
          <p className="text-gray-600 dark:text-gray-400">Forums, messaging, and announcements</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {conversations.length} active conversations
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="forums">
            <MessageSquare className="w-4 h-4 mr-2" />
            Forums
          </TabsTrigger>
          <TabsTrigger value="messages">
            <Send className="w-4 h-4 mr-2" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="announcements">
            <Bell className="w-4 h-4 mr-2" />
            Announcements
          </TabsTrigger>
        </TabsList>

        {/* Forums Tab */}
        <TabsContent value="forums" className="space-y-4">
          {!selectedForum ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Discussion Forums</CardTitle>
                      <CardDescription>Join conversations with your peers</CardDescription>
                    </div>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      New Post
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <Input placeholder="Search discussions..." className="max-w-sm" />
                  </div>

                  <div className="space-y-3">
                    {forums.map(forum => (
                      <div
                        key={forum.id}
                        className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedForum(forum)}
                      >
                        <div className="flex items-start gap-3">
                          <UserCircle2 className="w-10 h-10 text-gray-400" />
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold flex items-center gap-2">
                                  {forum.title}
                                  {forum.is_pinned && <Pin className="w-4 h-4 text-blue-600" />}
                                  {forum.is_locked && <Lock className="w-4 h-4 text-gray-500" />}
                                  {forum.is_announcement && <Bell className="w-4 h-4 text-yellow-600" />}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {forum.content}
                                </p>
                              </div>
                              <Badge variant="outline">{forum.category}</Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {forum.views}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-4 h-4" />
                                {forum.replies}
                              </span>
                              <span className="flex items-center gap-1">
                                <Star className="w-4 h-4" />
                                {forum.likes}
                              </span>
                              <span>{formatTimestamp(forum.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedForum(null)}
                  >
                    ← Back to Forums
                  </Button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Star className="w-4 h-4 mr-1" />
                      Follow
                    </Button>
                    <Button size="sm" variant="outline">
                      <Bell className="w-4 h-4 mr-1" />
                      Notify
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h2 className="text-2xl font-bold mb-2">{selectedForum.title}</h2>
                  <div className="flex items-center gap-3 mb-4">
                    <UserCircle2 className="w-8 h-8 text-gray-400" />
                    <div>
                      <p className="font-medium">{selectedForum.author.name}</p>
                      <p className="text-sm text-gray-500">
                        {selectedForum.author.role} • {formatTimestamp(selectedForum.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="prose dark:prose-invert max-w-none">
                    {selectedForum.content}
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-sm">
                    <Badge variant="outline">{selectedForum.category}</Badge>
                    {selectedForum.tags.map(tag => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Replies ({selectedForum.replies})</h3>
                  {replies.map(reply => (
                    <div key={reply.id} className="p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <UserCircle2 className="w-8 h-8 text-gray-400" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{reply.author.name}</p>
                              <p className="text-sm text-gray-500">
                                {reply.author.role} • {formatTimestamp(reply.created_at)}
                              </p>
                            </div>
                            {reply.is_accepted_answer && (
                              <Badge className="bg-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Accepted Answer
                              </Badge>
                            )}
                          </div>
                          <p className="mt-2">{reply.content}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <Button size="sm" variant="ghost">
                              <Star className="w-4 h-4 mr-1" />
                              {reply.likes}
                            </Button>
                            <Button size="sm" variant="ghost">
                              <Reply className="w-4 h-4 mr-1" />
                              Reply
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Textarea
                    placeholder="Write your reply..."
                    value={newReplyContent}
                    onChange={(e) => setNewReplyContent(e.target.value)}
                    rows={4}
                  />
                  <div className="flex justify-end">
                    <Button onClick={() => createReply(selectedForum.id)}>
                      <Send className="w-4 h-4 mr-2" />
                      Post Reply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4 h-[600px]">
            {/* Conversations List */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Messages</CardTitle>
                <CardDescription>
                  {conversations.filter(c => c.unread_count > 0).length} unread
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {conversations.map(conversation => (
                    <div
                      key={conversation.id}
                      className={`p-3 cursor-pointer transition-colors ${
                        selectedConversation?.id === conversation.id
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => {
                        setSelectedConversation(conversation)
                        fetchMessages(conversation.id)
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <UserCircle2 className="w-10 h-10 text-gray-400" />
                          {conversation.participants.some(p => p.online) && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">
                              {conversation.is_group ? conversation.group_name : conversation.participants.find(p => p.id !== 'current-user')?.name}
                            </p>
                            {conversation.unread_count > 0 && (
                              <Badge className="bg-blue-600">{conversation.unread_count}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">
                            {conversation.last_message.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chat Window */}
            <Card className="md:col-span-2">
              <CardHeader>
                {selectedConversation ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {selectedConversation.is_group ? selectedConversation.group_name : selectedConversation.participants.find(p => p.id !== 'current-user')?.name}
                      </CardTitle>
                      <CardDescription>
                        {selectedConversation.participants.filter(p => p.online).length} online
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Video className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Select a conversation to start messaging</p>
                  </div>
                )}
              </CardHeader>

              {selectedConversation && (
                <>
                  <CardContent className="h-96 overflow-y-auto space-y-3">
                    {messages.map(message => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender_id === 'current-user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            message.sender_id === 'current-user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-xs opacity-70">
                              {formatTimestamp(message.created_at)}
                            </span>
                            {message.sender_id === 'current-user' && (
                              message.read_at ? (
                                <CheckCheck className="w-3 h-3" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </CardContent>

                  <CardContent className="border-t">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost">
                        <Paperclip className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Image className="w-4 h-4" />
                      </Button>
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        className="flex-1"
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || isSending}
                        size="sm"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Announcements Tab */}
        <TabsContent value="announcements" className="space-y-4">
          {(userRole === 'instructor' || userRole === 'admin') && (
            <Card>
              <CardHeader>
                <CardTitle>Create Announcement</CardTitle>
                <CardDescription>Send important updates to your audience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target Audience</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select audience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="students">Students Only</SelectItem>
                        <SelectItem value="instructors">Instructors Only</SelectItem>
                        <SelectItem value="course">Specific Course</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Priority</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input placeholder="Announcement title" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content</label>
                  <Textarea placeholder="Announcement content..." rows={4} />
                </div>
                <div className="flex justify-end">
                  <Button onClick={createAnnouncement}>
                    <Bell className="w-4 h-4 mr-2" />
                    Send Announcement
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {announcements.map(announcement => (
              <Card key={announcement.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{announcement.title}</CardTitle>
                        <Badge variant={getPriorityColor(announcement.priority) as any}>
                          {announcement.priority}
                        </Badge>
                        {announcement.priority === 'urgent' && (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <UserCircle2 className="w-4 h-4" />
                        {announcement.author.name} • {formatTimestamp(announcement.created_at)}
                      </CardDescription>
                    </div>
                    {(userRole === 'instructor' || userRole === 'admin') && (
                      <Button size="sm" variant="ghost">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{announcement.content}</p>
                  {announcement.attachments && announcement.attachments.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      {announcement.attachments.map(attachment => (
                        <Badge key={attachment.id} variant="outline" className="cursor-pointer">
                          <Paperclip className="w-3 h-3 mr-1" />
                          {attachment.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}