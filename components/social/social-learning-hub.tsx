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
  HelpCircle,
  Calendar,
  Search,
  TrendingUp,
  Clock,
  Pin,
  Star,
  ThumbsUp,
  MessageCircle,
  Send,
  Bell,
  UserPlus,
  CheckCircle,
  Hash,
  Flame,
  Award,
  BookOpen,
  Target,
  Lightbulb,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ForumPost {
  id: string
  title: string
  content: string
  author: {
    id: string
    full_name: string
    avatar_url?: string
    role: 'student' | 'instructor' | 'admin'
  }
  category: string
  replies_count: number
  views_count: number
  likes_count: number
  is_pinned: boolean
  created_at: string
  last_activity: string
  tags: string[]
}

interface StudyGroup {
  id: string
  name: string
  description: string
  course_id: string
  course_title: string
  members_count: number
  max_members: number
  is_public: boolean
  created_by: string
  created_at: string
  next_meeting?: string
  avatar_url?: string
}

interface PeerRequest {
  id: string
  from_user: {
    id: string
    full_name: string
    avatar_url?: string
    completed_courses: number
    current_streak: number
  }
  course_id: string
  course_title: string
  topic: string
  message: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

interface Discussion {
  id: string
  title: string
  participants: number
  messages_count: number
  course_id: string
  course_title: string
  last_message: string
  last_message_time: string
  is_active: boolean
}

export function SocialLearningHub() {
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([
    {
      id: '1',
      title: 'Best practices for learning React hooks?',
      content: 'I\'m struggling to understand useEffect and its dependencies. Any tips?',
      author: { id: '1', full_name: 'Sarah Chen', role: 'student' },
      category: 'Help',
      replies_count: 12,
      views_count: 234,
      likes_count: 45,
      is_pinned: true,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      last_activity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      tags: ['react', 'hooks', 'help'],
    },
    {
      id: '2',
      title: 'Study group for TypeScript course',
      content: 'Looking for people to form a study group for the advanced TypeScript course.',
      author: { id: '2', full_name: 'Mike Johnson', role: 'student' },
      category: 'Study Groups',
      replies_count: 8,
      views_count: 156,
      likes_count: 23,
      is_pinned: false,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      tags: ['typescript', 'study-group', 'collaboration'],
    },
  ])

  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([
    {
      id: '1',
      name: 'React Mastery Squad',
      description: 'Weekly sessions to master React concepts together',
      course_id: '1',
      course_title: 'React for Beginners',
      members_count: 8,
      max_members: 12,
      is_public: true,
      created_by: 'user1',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      next_meeting: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      name: 'TypeScript Enthusiasts',
      description: 'Dive deep into TypeScript advanced features',
      course_id: '2',
      course_title: 'TypeScript Masterclass',
      members_count: 5,
      max_members: 10,
      is_public: true,
      created_by: 'user2',
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      next_meeting: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ])

  const [peerRequests, setPeerRequests] = useState<PeerRequest[]>([
    {
      id: '1',
      from_user: {
        id: '3',
        full_name: 'Emma Williams',
        avatar_url: undefined,
        completed_courses: 5,
        current_streak: 12,
      },
      course_id: '1',
      course_title: 'React for Beginners',
      topic: 'State Management',
      message: 'Hey! I see you\'re also learning React. Would you like to study state management together?',
      status: 'pending',
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ])

  const [discussions, setDiscussions] = useState<Discussion[]>([
    {
      id: '1',
      title: 'React Hooks Discussion',
      participants: 5,
      messages_count: 23,
      course_id: '1',
      course_title: 'React for Beginners',
      last_message: 'The dependency array is crucial...',
      last_message_time: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      is_active: true,
    },
  ])

  const [searchQuery, setSearchQuery] = useState('')
  const [newPostContent, setNewPostContent] = useState('')

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'instructor': return 'bg-purple-600'
      case 'admin': return 'bg-red-600'
      default: return 'bg-blue-600'
    }
  }

  const filteredPosts = forumPosts.filter(post =>
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Social Learning Hub</h2>
          <p className="text-muted-foreground">Connect, collaborate, and learn together</p>
        </div>
        <Button className="bg-bhutan-yellow hover:bg-bhutan-orange text-black">
          <UserPlus className="w-4 h-4 mr-2" />
          Find Study Partners
        </Button>
      </div>

      {/* Social Tabs */}
      <Tabs defaultValue="forums" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="forums">Discussion Forums</TabsTrigger>
          <TabsTrigger value="groups">Study Groups</TabsTrigger>
          <TabsTrigger value="peers">Peer Help</TabsTrigger>
          <TabsTrigger value="live">Live Discussions</TabsTrigger>
        </TabsList>

        {/* Discussion Forums Tab */}
        <TabsContent value="forums" className="space-y-4">
          {/* Search and Create Post */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search discussions, topics, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button className="bg-bhutan-yellow hover:bg-bhutan-orange text-black">
              <MessageSquare className="w-4 h-4 mr-2" />
              New Discussion
            </Button>
          </div>

          {/* Forum Posts */}
          <div className="space-y-3">
            {filteredPosts.map((post) => (
              <Card key={post.id} className="glass hover:shadow-lg transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-12 h-12 border-2 border-bhutan-yellow/30">
                      <AvatarImage src={post.author.avatar_url} />
                      <AvatarFallback className="bg-bhutan-yellow/20 text-black font-bold">
                        {getInitials(post.author.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {post.is_pinned && <Pin className="w-4 h-4 text-bhutan-yellow" />}
                            <h4 className="font-semibold hover:text-bhutan-yellow transition-colors">
                              {post.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <span>{post.author.full_name}</span>
                            <Badge className={getRoleColor(post.author.role)} variant="outline">
                              {post.author.role}
                            </Badge>
                            <span>•</span>
                            <span>{formatDate(post.created_at)}</span>
                          </div>
                        </div>
                        <Badge className="bg-bhutan-yellow text-black">
                          {post.category}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {post.content}
                      </p>

                      <div className="flex items-center gap-4 mb-3">
                        {post.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            <Hash className="w-3 h-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.replies_count} replies</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4" />
                          <span>{post.likes_count} likes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{post.views_count} views</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatDate(post.last_activity)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Study Groups Tab */}
        <TabsContent value="groups" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Active Study Groups</h3>
              <p className="text-sm text-muted-foreground">
                Join groups to learn together with peers
              </p>
            </div>
            <Button className="bg-bhutan-yellow hover:bg-bhutan-orange text-black">
              <Users className="w-4 h-4 mr-2" />
              Create Group
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studyGroups.map((group) => (
              <Card key={group.id} className="glass hover:shadow-lg transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center">
                      <Users className="w-8 h-8 text-bhutan-yellow" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg mb-1">{group.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{group.description}</p>
                      <Badge variant="outline">{group.course_title}</Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{group.members_count}/{group.max_members} members</span>
                      </div>
                      <Progress value={(group.members_count / group.max_members) * 100} className="w-24 h-2" />
                    </div>

                    {group.next_meeting && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>Next meeting: {formatDate(group.next_meeting)}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {group.is_public ? (
                        <Badge variant="outline" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          Public Group
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <Lock className="w-3 h-3 mr-1" />
                          Private Group
                        </Badge>
                      )}
                      <Badge className="bg-green-600 text-xs">
                        Active
                      </Badge>
                    </div>

                    <Button className="w-full bg-bhutan-yellow hover:bg-bhutan-orange text-black">
                      Join Group
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Peer Help Tab */}
        <TabsContent value="peers" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Peer Help Requests</h3>
              <p className="text-sm text-muted-foreground">
                Connect with fellow students for collaborative learning
              </p>
            </div>
            <Button className="bg-bhutan-yellow hover:bg-bhutan-orange text-black">
              <HelpCircle className="w-4 h-4 mr-2" />
              Request Help
            </Button>
          </div>

          <div className="space-y-3">
            {peerRequests.map((request) => (
              <Card key={request.id} className="glass">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={request.from_user.avatar_url} />
                      <AvatarFallback className="bg-bhutan-yellow/20 text-black font-bold">
                        {getInitials(request.from_user.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{request.from_user.full_name}</h4>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <div className="flex items-center gap-1">
                              <Award className="w-3 h-3" />
                              <span>{request.from_user.completed_courses} courses</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              <span>{request.from_user.current_streak} day streak</span>
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-blue-600">{request.status}</Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{request.course_title}</Badge>
                          <span className="text-sm font-medium">{request.topic}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{request.message}</p>
                      </div>

                      {request.status === 'pending' && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Accept
                          </Button>
                          <Button size="sm" variant="outline">
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Peer Help Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-green-600/20 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">12</p>
                    <p className="text-sm text-muted-foreground">Help Provided</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">8</p>
                    <p className="text-sm text-muted-foreground">Study Partners</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-purple-600/20 flex items-center justify-center">
                    <Lightbulb className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">15</p>
                    <p className="text-sm text-muted-foreground">Questions Answered</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Live Discussions Tab */}
        <TabsContent value="live" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Active Discussions</h3>
              <p className="text-sm text-muted-foreground">
                Real-time collaboration with fellow learners
              </p>
            </div>
            <Button className="bg-bhutan-yellow hover:bg-bhutan-orange text-black">
              <MessageSquare className="w-4 h-4 mr-2" />
              Start Discussion
            </Button>
          </div>

          <div className="space-y-3">
            {discussions.map((discussion) => (
              <Card key={discussion.id} className="glass hover:shadow-lg transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-lg bg-bhutan-yellow/20 flex items-center justify-center">
                        <MessageCircle className="w-6 h-6 text-bhutan-yellow" />
                      </div>
                      {discussion.is_active && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-600 rounded-full border-2 border-background" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-semibold">{discussion.title}</h4>
                        <Badge className="bg-green-600 text-xs">Live</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Badge variant="outline">{discussion.course_title}</Badge>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{discussion.participants}</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          <span>{discussion.messages_count}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {discussion.last_message}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-2">
                        {formatDate(discussion.last_message_time)}
                      </p>
                      <Button size="sm" className="bg-bhutan-yellow hover:bg-bhutan-orange text-black">
                        Join
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Discussion Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass-strong border-bhutan-yellow/30">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bhutan-yellow/20 flex items-center justify-center">
                    <Target className="w-8 h-8 text-bhutan-yellow" />
                  </div>
                  <h4 className="font-semibold mb-2">Topic-Based Rooms</h4>
                  <p className="text-sm text-muted-foreground">
                    Join discussion rooms for specific topics and courses
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-strong border-bhutan-yellow/30">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <Bell className="w-8 h-8 text-blue-600" />
                  </div>
                  <h4 className="font-semibold mb-2">Real-time Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Get notified when peers respond to your questions
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}