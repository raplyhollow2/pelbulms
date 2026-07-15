'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Trophy,
  Star,
  Flame,
  Target,
  Zap,
  Medal,
  Award,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle,
  Lock,
  Crown,
  Swords,
  Shield,
  Sparkles,
  Gift,
  Gem,
  Heart,
  Sword,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GamificationStats {
  total_xp: number
  current_level: number
  xp_to_next_level: number
  current_streak: number
  longest_streak: number
  total_achievements: number
  unlocked_achievements: number
  leaderboard_rank: number
  total_users: number
  completed_courses: number
  completed_lessons: number
  total_hours: number
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  xp_reward: number
  unlocked: boolean
  unlocked_at?: string
  progress?: number
  total?: number
  category: 'learning' | 'social' | 'engagement' | 'milestone'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

interface LeaderboardEntry {
  rank: number
  user_id: string
  full_name: string
  avatar_url?: string
  total_xp: number
  level: number
  completed_courses: number
  current_streak: number
}

interface DailyChallenge {
  id: string
  title: string
  description: string
  xp_reward: number
  completed: boolean
  progress: number
  target: number
  expires_at: string
}

export function GamificationDashboard() {
  const [stats, setStats] = useState<GamificationStats>({
    total_xp: 1250,
    current_level: 5,
    xp_to_next_level: 750,
    current_streak: 7,
    longest_streak: 14,
    total_achievements: 24,
    unlocked_achievements: 12,
    leaderboard_rank: 15,
    total_users: 156,
    completed_courses: 3,
    completed_lessons: 47,
    total_hours: 23,
  })

  const [achievements, setAchievements] = useState<Achievement[]>([
    {
      id: 'first_lesson',
      title: 'First Steps',
      description: 'Complete your first lesson',
      icon: '🎯',
      xp_reward: 50,
      unlocked: true,
      category: 'learning',
      rarity: 'common',
    },
    {
      id: 'week_streak',
      title: 'Dedicated Learner',
      description: 'Maintain a 7-day learning streak',
      icon: '🔥',
      xp_reward: 100,
      unlocked: true,
      category: 'engagement',
      rarity: 'rare',
    },
    {
      id: 'first_course',
      title: 'Course Master',
      description: 'Complete your first course',
      icon: '🏆',
      xp_reward: 200,
      unlocked: true,
      category: 'milestone',
      rarity: 'epic',
    },
    {
      id: 'social_butterfly',
      title: 'Social Butterfly',
      description: 'Help 10 fellow students',
      icon: '🦋',
      xp_reward: 150,
      unlocked: false,
      category: 'social',
      rarity: 'rare',
      progress: 7,
      total: 10,
    },
    {
      id: 'speed_learner',
      title: 'Speed Learner',
      description: 'Complete 5 lessons in one day',
      icon: '⚡',
      xp_reward: 75,
      unlocked: true,
      category: 'engagement',
      rarity: 'common',
    },
    {
      id: 'perfect_score',
      title: 'Perfect Score',
      description: 'Get 100% on a quiz',
      icon: '💯',
      xp_reward: 100,
      unlocked: false,
      category: 'learning',
      rarity: 'epic',
    },
    {
      id: 'month_streak',
      title: 'Monthly Master',
      description: 'Maintain a 30-day learning streak',
      icon: '👑',
      xp_reward: 500,
      unlocked: false,
      category: 'engagement',
      rarity: 'legendary',
      progress: 7,
      total: 30,
    },
    {
      id: 'knowledge_seeker',
      title: 'Knowledge Seeker',
      description: 'Enroll in 10 courses',
      icon: '📚',
      xp_reward: 300,
      unlocked: false,
      category: 'milestone',
      rarity: 'rare',
      progress: 5,
      total: 10,
    },
  ])

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([
    { rank: 1, user_id: '1', full_name: 'Sarah Chen', total_xp: 5420, level: 12, completed_courses: 8, current_streak: 21 },
    { rank: 2, user_id: '2', full_name: 'Mike Johnson', total_xp: 4890, level: 11, completed_courses: 7, current_streak: 18 },
    { rank: 3, user_id: '3', full_name: 'Emma Williams', total_xp: 4560, level: 10, completed_courses: 6, current_streak: 15 },
    { rank: 4, user_id: '4', full_name: 'James Brown', total_xp: 4120, level: 9, completed_courses: 6, current_streak: 12 },
    { rank: 5, user_id: '5', full_name: 'Lisa Anderson', total_xp: 3890, level: 9, completed_courses: 5, current_streak: 20 },
  ])

  const [dailyChallenges, setDailyChallenges] = useState<DailyChallenge[]>([
    {
      id: 'daily_1',
      title: 'Daily Learner',
      description: 'Complete 2 lessons today',
      xp_reward: 25,
      completed: true,
      progress: 2,
      target: 2,
      expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'daily_2',
      title: 'Quiz Master',
      description: 'Score 80%+ on a quiz',
      xp_reward: 50,
      completed: false,
      progress: 0,
      target: 1,
      expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'daily_3',
      title: 'Social Helper',
      description: 'Help a fellow student',
      xp_reward: 30,
      completed: false,
      progress: 0,
      target: 1,
      expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    },
  ])

  const getLevelColor = (level: number) => {
    if (level >= 20) return 'from-purple-600 to-pink-600'
    if (level >= 15) return 'from-blue-600 to-cyan-600'
    if (level >= 10) return 'from-green-600 to-emerald-600'
    if (level >= 5) return 'from-yellow-600 to-orange-600'
    return 'from-gray-600 to-slate-600'
  }

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'bg-gray-600'
      case 'rare': return 'bg-blue-600'
      case 'epic': return 'bg-purple-600'
      case 'legendary': return 'bg-yellow-600'
      default: return 'bg-gray-600'
    }
  }

  const getRarityBorder = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'border-gray-600/30'
      case 'rare': return 'border-blue-600/30'
      case 'epic': return 'border-purple-600/30'
      case 'legendary': return 'border-yellow-600/30'
      default: return 'border-gray-600/30'
    }
  }

  const getProgress = () => {
    const xpInCurrentLevel = stats.total_xp - (stats.current_level - 1) * 250
    const xpNeededForLevel = 250
    return (xpInCurrentLevel / xpNeededForLevel) * 100
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="space-y-6">
      {/* Level & XP Overview */}
      <Card className="glass-strong border-bhutan-yellow/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            {/* Level Badge */}
            <div className="relative">
              <div className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br",
                getLevelColor(stats.current_level)
              )}>
                <div className="text-center">
                  <div className="text-3xl">{stats.current_level}</div>
                  <div className="text-xs">LEVEL</div>
                </div>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <Badge className="bg-bhutan-yellow text-black font-bold">
                  XP
                </Badge>
              </div>
            </div>

            {/* Progress Info */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Level {stats.current_level}</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats.total_xp} total XP • {stats.xp_to_next_level} XP to next level
                  </p>
                </div>
                <Badge className="bg-bhutan-yellow text-black">
                  {stats.total_achievements} Achievements
                </Badge>
              </div>
              <Progress value={getProgress()} className="h-3" />
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span>{stats.total_xp} XP</span>
                </div>
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span>Rank #{stats.leaderboard_rank}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>{stats.current_streak} day streak</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Gamification Tabs */}
      <Tabs defaultValue="achievements" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="challenges">Daily Challenges</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
        </TabsList>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <Card
                key={achievement.id}
                className={cn(
                  'glass transition-all hover:shadow-lg',
                  achievement.unlocked ? 'border-green-600/30' : 'opacity-70',
                  getRarityBorder(achievement.rarity)
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{achievement.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold">{achievement.title}</h4>
                        <Badge className={getRarityColor(achievement.rarity)} variant="outline">
                          {achievement.rarity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {achievement.description}
                      </p>

                      {achievement.unlocked ? (
                        <div className="flex items-center justify-between">
                          <Badge className="bg-green-600" variant="outline">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Unlocked
                          </Badge>
                          <Badge className="bg-bhutan-yellow text-black">
                            +{achievement.xp_reward} XP
                          </Badge>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {achievement.progress !== undefined && achievement.total !== undefined && (
                            <>
                              <div className="flex items-center justify-between text-xs">
                                <span>Progress</span>
                                <span>{achievement.progress}/{achievement.total}</span>
                              </div>
                              <Progress
                                value={(achievement.progress / achievement.total) * 100}
                                className="h-1"
                              />
                            </>
                          )}
                          <div className="flex items-center gap-2">
                            <Lock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              +{achievement.xp_reward} XP reward
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Top Learners
              </CardTitle>
              <CardDescription>
                Compete with fellow students and climb the ranks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.user_id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg transition-colors",
                      index === 0 && "bg-yellow-500/10 border border-yellow-500/30",
                      index === 1 && "bg-gray-400/10 border border-gray-400/30",
                      index === 2 && "bg-orange-600/10 border border-orange-600/30",
                      entry.rank === stats.leaderboard_rank && "bg-bhutan-yellow/10 border border-bhutan-yellow/30"
                    )}
                  >
                    {/* Rank Badge */}
                    <div className="flex-shrink-0">
                      {index === 0 ? (
                        <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                          <Crown className="w-5 h-5 text-white" />
                        </div>
                      ) : index === 1 ? (
                        <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center font-bold text-white">
                          2
                        </div>
                      ) : index === 2 ? (
                        <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center font-bold text-white">
                          3
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                          {entry.rank}
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <Avatar className="w-12 h-12 border-2 border-bhutan-yellow/30">
                      <AvatarImage src={entry.avatar_url} />
                      <AvatarFallback className="bg-bhutan-yellow/20 text-black font-bold">
                        {getInitials(entry.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold">{entry.full_name}</h4>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>Level {entry.level}</span>
                        <span>•</span>
                        <span>{entry.completed_courses} courses</span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-500" />
                          <span>{entry.current_streak} day streak</span>
                        </div>
                      </div>
                    </div>

                    {/* XP */}
                    <div className="text-right">
                      <div className="font-bold text-bhutan-yellow">{entry.total_xp} XP</div>
                      <Badge className="bg-bhutan-yellow text-black" variant="outline">
                        Rank #{entry.rank}
                      </Badge>
                    </div>
                  </div>
                ))}

                {/* Your Position */}
                {stats.leaderboard_rank > 5 && (
                  <div className="border-t border-border/50 pt-3">
                    <div className="p-3 rounded-lg bg-bhutan-yellow/10 border border-bhutan-yellow/30">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-bhutan-yellow flex items-center justify-center font-bold text-black">
                          {stats.leaderboard_rank}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">Your Position</div>
                          <div className="text-sm text-muted-foreground">
                            {stats.total_xp} XP • Level {stats.current_level}
                          </div>
                        </div>
                        <Badge className="bg-bhutan-yellow text-black">
                          Rank #{stats.leaderboard_rank} of {stats.total_users}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Challenges Tab */}
        <TabsContent value="challenges" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyChallenges.map((challenge) => (
              <Card key={challenge.id} className="glass">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-bhutan-yellow/20 flex items-center justify-center">
                        <Target className="w-6 h-6 text-bhutan-yellow" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{challenge.title}</h4>
                        <p className="text-sm text-muted-foreground">{challenge.description}</p>
                      </div>
                    </div>
                    <Badge className={challenge.completed ? "bg-green-600" : "bg-bhutan-yellow text-black"}>
                      +{challenge.xp_reward} XP
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span>{challenge.progress}/{challenge.target}</span>
                    </div>
                    <Progress
                      value={(challenge.progress / challenge.target) * 100}
                      className="h-2"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Expires in {getTimeRemaining(challenge.expires_at)}</span>
                      </div>
                      {challenge.completed && (
                        <span className="text-green-600">Completed! 🎉</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="glass-strong border-bhutan-yellow/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">Today's Bonus XP</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete all daily challenges for bonus rewards
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-bhutan-yellow">+75 XP</div>
                  <div className="text-xs text-muted-foreground">Daily Bonus</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* XP Rewards */}
            <Card className="glass">
              <CardContent className="p-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                    <Star className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">XP Multiplier</h4>
                    <p className="text-sm text-muted-foreground">
                      Earn 1.5x XP during weekends
                    </p>
                  </div>
                  <Badge className="bg-yellow-500 text-black w-fit mx-auto">
                    Unlock at Level 10
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Profile Customization */}
            <Card className="glass">
              <CardContent className="p-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Profile Badges</h4>
                    <p className="text-sm text-muted-foreground">
                      Exclusive profile customization
                    </p>
                  </div>
                  <Badge className="bg-purple-500 w-fit mx-auto">
                    Unlock at Level 15
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Course Discounts */}
            <Card className="glass">
              <CardContent className="p-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                    <Gift className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Course Discounts</h4>
                    <p className="text-sm text-muted-foreground">
                      10% off premium courses
                    </p>
                  </div>
                  <Badge className="bg-green-500 w-fit mx-auto">
                    Unlock at Level 20
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Mentor Access */}
            <Card className="glass">
              <CardContent className="p-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Mentor Access</h4>
                    <p className="text-sm text-muted-foreground">
                      Direct access to instructors
                    </p>
                  </div>
                  <Badge className="bg-blue-500 w-fit mx-auto">
                    Unlock at Level 25
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Certificate */}
            <Card className="glass">
              <CardContent className="p-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                    <Medal className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Premium Certificate</h4>
                    <p className="text-sm text-muted-foreground">
                      Verified certificate badges
                    </p>
                  </div>
                  <Badge className="bg-red-500 w-fit mx-auto">
                    Unlock at Level 30
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* VIP Features */}
            <Card className="glass">
              <CardContent className="p-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                    <Crown className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">VIP Status</h4>
                    <p className="text-sm text-muted-foreground">
                      Premium features and early access
                    </p>
                  </div>
                  <Badge className="bg-yellow-500 text-black w-fit mx-auto">
                    Unlock at Level 50
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}