'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users,
  MessageSquare,
  Send,
  Bell,
  Pin,
  Clock,
  Check,
  Hash,
  UserPlus,
  Settings,
  Megaphone,
  Radio,
  Activity,
  Zap,
  Globe,
  Lock,
  Eye,
  EyeOff,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface RealtimeUser {
  id: string
  full_name: string
  avatar_url?: string
  status: 'online' | 'away' | 'offline'
  current_activity?: string
  last_seen: string
  role: 'student' | 'instructor' | 'admin'
}

interface ChannelMessage {
  id: string
  channel_id: string
  user_id: string
  user: RealtimeUser
  content: string
  type: 'text' | 'system' | 'announcement'
  created_at: string
  is_pinned: boolean
  reply_to?: string
  reactions?: {
    emoji: string
    count: number
    users: string[]
  }[]
}

interface Channel {
  id: string
  name: string
  description: string
  type: 'course' | 'study_group' | 'general' | 'announcements'
  course_id?: string
  course_title?: string
  is_public: boolean
  members_count: number
  unread_count: number
  last_message?: ChannelMessage
  is_pinned: boolean
}

interface TypingIndicator {
  user_id: string
  user_name: string
  channel_id: string
  timestamp: string
}

interface PresenceIndicator {
  user_id: string
  status: 'online' | 'away' | 'offline'
  last_seen: string
}

export function RealtimeHub() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [onlineUsers, setOnlineUsers] = useState<RealtimeUser[]>([])
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [userStatus, setUserStatus] = useState<'online' | 'away' | 'offline'>('online')

  const supabase = createClient()

  useEffect(() => {
    // Initialize mock data
    setChannels([
      {
        id: '1',
        name: 'General Discussion',
        description: 'Platform-wide discussions and announcements',
        type: 'general',
        is_public: true,
        members_count: 156,
        unread_count: 3,
        last_message: {
          id: 'msg1',
          channel_id: '1',
          user_id: 'user1',
          user: {
            id: 'user1',
            full_name: 'Sarah Chen',
            avatar_url: undefined,
            status: 'online',
            last_seen: new Date().toISOString(),
            role: 'instructor',
          },
          content: 'Welcome to the new learning platform! Feel free to ask questions.',
          type: 'announcement',
          created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          is_pinned: true,
        },
        is_pinned: true,
      },
      {
        id: '2',
        name: 'React Course Help',
        description: 'Get help with React concepts and assignments',
        type: 'course',
        course_id: 'course1',
        course_title: 'React for Beginners',
        is_public: true,
        members_count: 42,
        unread_count: 0,
        last_message: {
          id: 'msg2',
          channel_id: '2',
          user_id: 'user2',
          user: {
            id: 'user2',
            full_name: 'Mike Johnson',
            avatar_url: undefined,
            status: 'online',
            last_seen: new Date().toISOString(),
            role: 'student',
          },
          content: 'Can someone explain useEffect dependencies?',
          type: 'text',
          created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          is_pinned: false,
        },
        is_pinned: false,
      },
    ])

    setOnlineUsers([
      {
        id: '1',
        full_name: 'Sarah Chen',
        status: 'online',
        current_activity: 'Teaching React Course',
        last_seen: new Date().toISOString(),
        role: 'instructor',
      },
      {
        id: '2',
        full_name: 'Mike Johnson',
        status: 'online',
        current_activity: 'Learning TypeScript',
        last_seen: new Date().toISOString(),
        role: 'student',
      },
      {
        id: '3',
        full_name: 'Emma Williams',
        status: 'away',
        last_seen: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        role: 'student',
      },
    ])

    setMessages([
      {
        id: 'msg1',
        channel_id: '1',
        user_id: 'user1',
        user: {
          id: 'user1',
          full_name: 'Sarah Chen',
          status: 'online',
          last_seen: new Date().toISOString(),
          role: 'instructor',
        },
        content: 'Welcome to the new learning platform! Feel free to ask questions.',
        type: 'announcement',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        is_pinned: true,
      },
      {
        id: 'msg2',
        channel_id: '1',
        user_id: 'user2',
        user: {
          id: 'user2',
          full_name: 'Mike Johnson',
          status: 'online',
          last_seen: new Date().toISOString(),
          role: 'student',
        },
        content: 'Thanks! This platform looks amazing.',
        type: 'text',
        created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        is_pinned: false,
      },
    ])

    // Simulate connection
    setTimeout(() => setIsConnected(true), 1000)

    // Simulate typing indicators
    const typingInterval = setInterval(() => {
      const randomUser = onlineUsers[Math.floor(Math.random() * onlineUsers.length)]
      if (randomUser && randomUser.status === 'online' && currentChannel) {
        setTypingUsers([
          {
            user_id: randomUser.id,
            user_name: randomUser.full_name,
            channel_id: currentChannel.id,
            timestamp: new Date().toISOString(),
          },
        ])
        setTimeout(() => setTypingUsers([]), 3000)
      }
    }, 8000)

    return () => clearInterval(typingInterval)
  }, [currentChannel, onlineUsers])

  const handleSendMessage = () => {
    if (!newMessage.trim() || !currentChannel) return

    const message: ChannelMessage = {
      id: `msg${Date.now()}`,
      channel_id: currentChannel.id,
      user_id: 'current-user',
      user: {
        id: 'current-user',
        full_name: 'You',
        status: 'online',
        last_seen: new Date().toISOString(),
        role: 'student',
      },
      content: newMessage,
      type: 'text',
      created_at: new Date().toISOString(),
      is_pinned: false,
    }

    setMessages([...messages, message])
    setNewMessage('')
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getStatusColor = (status: RealtimeUser['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'offline': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getRoleColor = (role: RealtimeUser['role']) => {
    switch (role) {
      case 'instructor': return 'bg-purple-600'
      case 'admin': return 'bg-red-600'
      default: return 'bg-blue-600'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className={cn(
        "glass border-2",
        isConnected ? "border-green-600/30" : "border-red-600/30"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-3 h-3 rounded-full",
                isConnected ? "bg-green-500" : "bg-red-500"
              )} />
              <div>
                <p className="font-semibold">Real-time Status</p>
                <p className="text-sm text-muted-foreground">
                  {isConnected ? 'Connected to real-time services' : 'Connecting...'}
                </p>
              </div>
            </div>
            <Badge className={cn(
              isConnected ? "bg-green-600" : "bg-yellow-600"
            )}>
              {isConnected ? 'Live' : 'Connecting'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Main Real-time Tabs */}
      <Tabs defaultValue="channels" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="presence">Online Users</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Channel List */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="w-5 h-5" />
                  Available Channels
                </CardTitle>
                <CardDescription>Join channels to collaborate with peers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className={cn(
                      "p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md",
                      currentChannel?.id === channel.id
                        ? "border-bhutan-yellow/50 bg-bhutan-yellow/10"
                        : "border-border/50"
                    )}
                    onClick={() => setCurrentChannel(channel)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {channel.type === 'announcements' ? (
                          <Megaphone className="w-5 h-5 text-bhutan-yellow" />
                        ) : (
                          <Hash className="w-5 h-5 text-bhutan-yellow" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold">{channel.name}</h4>
                          {channel.is_pinned && (
                            <Pin className="w-4 h-4 text-bhutan-yellow" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {channel.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{channel.members_count}</span>
                          </div>
                          {channel.unread_count > 0 && (
                            <Badge className="bg-bhutan-yellow text-black">
                              {channel.unread_count} new
                            </Badge>
                          )}
                          {!channel.is_public && (
                            <Badge variant="outline" className="text-xs">
                              <Lock className="w-3 h-3 mr-1" />
                              Private
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Channel Info */}
            {currentChannel && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hash className="w-5 h-5" />
                    {currentChannel.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {currentChannel.description}
                  </p>

                  {currentChannel.type === 'course' && (
                    <div className="p-3 rounded-lg bg-bhutan-yellow/10 border border-bhutan-yellow/30">
                      <div className="flex items-center gap-2 text-sm">
                        <BookOpen className="w-4 h-4" />
                        <span className="font-medium">Course Channel</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {currentChannel.course_title}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Members</span>
                      <span className="font-medium">{currentChannel.members_count}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Unread messages</span>
                      <span className="font-medium">{currentChannel.unread_count}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1 bg-bhutan-yellow hover:bg-bhutan-orange text-black">
                      <Users className="w-4 h-4 mr-2" />
                      Invite Members
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          {currentChannel ? (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="w-5 h-5" />
                    {currentChannel.name}
                  </div>
                  <Badge className="bg-green-600">
                    {onlineUsers.filter(u => u.status === 'online').length} online
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Typing Indicators */}
                {typingUsers.length > 0 && (
                  <div className="mb-4 p-2 rounded-lg bg-bhutan-yellow/10 border border-bhutan-yellow/30">
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="w-4 h-4 text-bhutan-yellow" />
                      <span>{typingUsers[0].user_name} is typing...</span>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex items-start gap-3",
                        message.type === 'announcement' && "bg-bhutan-yellow/10 p-3 rounded-lg -mx-3 px-3"
                      )}
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={message.user.avatar_url} />
                        <AvatarFallback className={cn(
                          "text-white text-xs font-bold",
                          message.user.role === 'instructor' ? "bg-purple-600" : "bg-blue-600"
                        )}>
                          {getInitials(message.user.full_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{message.user.full_name}</span>
                          {message.is_pinned && (
                            <Pin className="w-3 h-3 text-bhutan-yellow" />
                          )}
                          {message.user.role === 'instructor' && (
                            <Badge className={`${getRoleColor(message.user.role)} text-xs`} variant="outline">
                              Instructor
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(message.created_at)}
                          </span>
                        </div>
                        <p className="text-sm break-words">{message.content}</p>

                        {message.reactions && message.reactions.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            {message.reactions.map((reaction, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-xs cursor-pointer hover:bg-muted"
                              >
                                {reaction.emoji} {reaction.count}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleSendMessage()
                    }}
                    className="flex-1"
                  />
                  <Button
                    className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass">
              <CardContent className="p-12 text-center">
                <Hash className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Select a Channel</h3>
                <p className="text-muted-foreground">
                  Choose a channel from the list to start messaging
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Online Users Tab */}
        <TabsContent value="presence" className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Online Users ({onlineUsers.filter(u => u.status === 'online').length})
              </CardTitle>
              <CardDescription>
                See who's available for real-time collaboration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {onlineUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="bg-bhutan-yellow/20 text-black font-bold">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute -bottom-0 -right-0 w-3 h-3 rounded-full border-2 border-background",
                        getStatusColor(user.status)
                      )} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{user.full_name}</h4>
                        <Badge className={`${getRoleColor(user.role)} text-xs`} variant="outline">
                          {user.role}
                        </Badge>
                      </div>
                      {user.current_activity && (
                        <p className="text-sm text-muted-foreground">
                          {user.current_activity}
                        </p>
                      )}
                    </div>

                    <Button size="sm" variant="outline" className="flex-shrink-0">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Message
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Real-time Notifications
              </CardTitle>
              <CardDescription>
                Stay updated with platform activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-bhutan-yellow/10 border border-bhutan-yellow/30">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-bhutan-yellow flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">New Achievement Unlocked!</h4>
                      <p className="text-sm text-muted-foreground">
                        You earned the "Quick Learner" badge for completing 5 lessons in one day.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">2 minutes ago</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">Study Group Invitation</h4>
                      <p className="text-sm text-muted-foreground">
                        Sarah Chen invited you to join "React Mastery Squad"
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button size="sm" className="bg-blue-600">Accept</Button>
                        <Button size="sm" variant="outline">Decline</Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">Course Completed!</h4>
                      <p className="text-sm text-muted-foreground">
                        Congratulations! You've completed "React for Beginners"
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">1 hour ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}