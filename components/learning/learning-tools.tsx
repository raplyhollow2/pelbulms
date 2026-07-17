'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  Pause,
  RotateCw,
  Flame,
  Clock,
  Calendar as CalendarIcon,
  Download,
  Brain,
  RefreshCw,
  Award,
  Target,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils'

interface LearningToolsProps {
  courseId?: string
  lessonId?: string
}

interface Flashcard {
  id: string
  front: string
  back: string
  difficulty: 'easy' | 'medium' | 'hard'
  reviewCount: number
  nextReview?: string
}

interface StudySession {
  date: string
  startTime: string
  endTime: string
  duration: number
  focusLevel: number
}

export function LearningTools({ courseId, lessonId }: LearningToolsProps) {
  const [activeTab, setActiveTab] = useState<'pomodoro' | 'scheduler' | 'flashcards'>('pomodoro')

  // Pomodoro State
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60) // 25 minutes in seconds
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroMode, setPomodoroMode] = useState<'focus' | 'short-break' | 'long-break'>('focus')
  const [pomodoroStreak, setPomodoroStreak] = useState(14)
  const [pomodoroHistory, setPomodoroHistory] = useState<StudySession[]>([])

  // Flashcards State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([
    {
      id: '1',
      front: 'What is the difference between Server and Client Components?',
      back: 'Server Components render on the server and can access databases directly. Client Components render in the browser and can use React hooks.',
      difficulty: 'medium',
      reviewCount: 3,
      nextReview: new Date(Date.now() + 86400000).toISOString()
    },
    {
      id: '2',
      front: 'What hook is used for client-side navigation?',
      back: 'useRouter hook from next/navigation is used for client-side navigation in Next.js App Router.',
      difficulty: 'easy',
      reviewCount: 7,
      nextReview: new Date(Date.now() + 172800000).toISOString()
    },
    {
      id: '3',
      front: 'How do you optimize images in Next.js?',
      back: 'Use the next/image component which automatically optimizes images, serves them in modern formats, and uses lazy loading.',
      difficulty: 'hard',
      reviewCount: 1,
      nextReview: new Date(Date.now() + 43200000).toISOString()
    }
  ])
  const [currentFlashcard, setCurrentFlashcard] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [flashcardResult, setFlashcardResult] = useState<'correct' | 'review' | null>(null)

  const pomodoroTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Pomodoro timer effect
  useEffect(() => {
    if (pomodoroRunning && pomodoroTime > 0) {
      pomodoroTimerRef.current = setInterval(() => {
        setPomodoroTime(prev => {
          if (prev <= 1) {
            handlePomodoroComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (pomodoroTimerRef.current) {
        clearInterval(pomodoroTimerRef.current)
      }
    }

    return () => {
      if (pomodoroTimerRef.current) {
        clearInterval(pomodoroTimerRef.current)
      }
    }
  }, [pomodoroRunning, pomodoroTime])

  // Format pomodoro time
  const formatPomodoroTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Handle pomodoro complete
  const handlePomodoroComplete = () => {
    setPomodoroRunning(false)

    if (pomodoroMode === 'focus') {
      setPomodoroStreak(prev => prev + 1)

      // Auto-switch to break
      if (pomodoroStreak % 4 === 0) {
        setPomodoroMode('long-break')
        setPomodoroTime(15 * 60) // 15 minutes
      } else {
        setPomodoroMode('short-break')
        setPomodoroTime(5 * 60) // 5 minutes
      }

      // Record completed session
      const session: StudySession = {
        date: new Date().toISOString(),
        startTime: new Date(Date.now() - (25 * 60 * 1000)).toISOString(),
        endTime: new Date().toISOString(),
        duration: 25 * 60,
        focusLevel: 8
      }
      setPomodoroHistory(prev => [session, ...prev])
    } else {
      // Break complete, reset to focus mode
      setPomodoroMode('focus')
      setPomodoroTime(25 * 60)
    }
  }

  // Handle pomodoro controls
  const handlePomodoroStart = () => {
    setPomodoroRunning(true)
  }

  const handlePomodoroPause = () => {
    setPomodoroRunning(false)
  }

  const handlePomodoroReset = () => {
    setPomodoroRunning(false)
    setPomodoroTime(pomodoroMode === 'focus' ? 25 * 60 : pomodoroMode === 'short-break' ? 5 * 60 : 15 * 60)
  }

  const handlePomodoroModeChange = (mode: 'focus' | 'short-break' | 'long-break') => {
    setPomodoroRunning(false)
    setPomodoroMode(mode)

    switch (mode) {
      case 'focus':
        setPomodoroTime(25 * 60)
        break
      case 'short-break':
        setPomodoroTime(5 * 60)
        break
      case 'long-break':
        setPomodoroTime(15 * 60)
        break
    }
  }

  // Flashcard handlers
  const handleFlashcardFlip = () => {
    setFlipped(!flipped)
  }

  const handleFlashcardNext = () => {
    setFlipped(false)
    setFlashcardResult(null)
    setCurrentFlashcard(prev => (prev + 1) % flashcards.length)
  }

  const handleFlashcardResult = (result: 'correct' | 'review') => {
    setFlashcardResult(result)

    // Update flashcard review stats
    setFlashcards(prev => prev.map((card, index) =>
      index === currentFlashcard
        ? {
            ...card,
            reviewCount: card.reviewCount + 1,
            nextReview: new Date(Date.now() + (result === 'correct' ? 86400000 : 3600000)).toISOString()
          }
        : card
    ))

    // Auto-advance after delay
    setTimeout(() => {
      handleFlashcardNext()
    }, 1500)
  }

  // Get difficulty color
  const getDifficultyColor = (difficulty: Flashcard['difficulty']) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-700 border-green-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30'
      case 'hard': return 'bg-red-500/20 text-red-700 border-red-500/30'
    }
  }

  // Calculate pomodoro progress
  const pomodoroProgress = pomodoroMode === 'focus'
    ? ((25 * 60 - pomodoroTime) / (25 * 60)) * 100
    : pomodoroMode === 'short-break'
      ? ((5 * 60 - pomodoroTime) / (5 * 60)) * 100
      : ((15 * 60 - pomodoroTime) / (15 * 60)) * 100

  return (
    <div className="h-full">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-3 h-auto gap-1 p-1">
          {/* keep labels short-friendly via text-xs on small screens if needed */}
          <TabsTrigger value="pomodoro" className>
            <Clock className="w-4 h-4 mr-2" />
            Pomodoro
          </TabsTrigger>
          <TabsTrigger value="scheduler" className>
            <CalendarIcon className="w-4 h-4 mr-2" />
            Scheduler
          </TabsTrigger>
          <TabsTrigger value="flashcards" className>
            <Brain className="w-4 h-4 mr-2" />
            Flashcards
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 mt-4">
          {/* Pomodoro Timer */}
          <TabsContent value="pomodoro" className="h-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              {/* Timer Card */}
              <Card className="glass-strong flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-bhutan-yellow" />
                      Pomodoro Timer
                    </div>
                    <Badge variant="secondary" className="animate-pulse">
                      {pomodoroStreak} day streak! 🔥
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center space-y-6">
                  {/* Circular Timer Display */}
                  <div className="relative w-48 h-48 mx-auto">
                    <svg className="transform -rotate-90 w-48 h-48">
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-secondary"
                      />
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 88}
                        strokeDashoffset={2 * Math.PI * 88 * (1 - pomodoroProgress / 100)}
                        className={cn(
                          "transition-all duration-1000",
                          pomodoroMode === 'focus' && "text-bhutan-yellow",
                          pomodoroMode === 'short-break' && "text-green-600",
                          pomodoroMode === 'long-break' && "text-blue-600"
                        )}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl font-bold font-mono">
                          {formatPomodoroTime(pomodoroTime)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {pomodoroRunning ? 'Focusing...' : pomodoroTime === 0 ? 'Complete!' : 'Ready'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant={pomodoroMode === 'focus' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePomodoroModeChange('focus')}
                      className={cn(
                        "flex-1",
                        pomodoroMode === 'focus' && "bg-bhutan-yellow hover:bg-bhutan-orange"
                      )}
                    >
                      Focus
                    </Button>
                    <Button
                      variant={pomodoroMode === 'short-break' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePomodoroModeChange('short-break')}
                      className="flex-1"
                    >
                      Break
                    </Button>
                    <Button
                      variant={pomodoroMode === 'long-break' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePomodoroModeChange('long-break')}
                      className="flex-1"
                    >
                      Long
                    </Button>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handlePomodoroReset}
                    >
                      <RotateCw className="w-5 h-5" />
                    </Button>

                    {!pomodoroRunning ? (
                      <Button
                        size="lg"
                        onClick={handlePomodoroStart}
                        className="bg-bhutan-yellow hover:bg-bhutan-orange"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        Start
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        onClick={handlePomodoroPause}
                        className="bg-bhutan-yellow hover:bg-bhutan-orange"
                      >
                        <Pause className="w-5 h-5 mr-2" />
                        Pause
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Stats Card */}
              <Card className="glass-strong">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-bhutan-orange" />
                    Study Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-primary/5">
                        <p className="text-3xl font-bold text-bhutan-yellow">{pomodoroStreak}</p>
                        <p className="text-xs text-muted-foreground">Day Streak</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-primary/5">
                        <p className="text-3xl font-bold text-bhutan-orange">
                          {pomodoroHistory.reduce((acc, session) => acc + Math.floor(session.duration / 60), 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Minutes</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <h3 className="font-semibold mb-3">Recent Sessions</h3>
                      <div className="space-y-2">
                        {pomodoroHistory.slice(0, 3).map((session, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {new Date(session.date).toLocaleDateString()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {Math.floor(session.duration / 60)}m
                            </Badge>
                          </div>
                        ))}
                        {pomodoroHistory.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No sessions yet. Start your first pomodoro!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Study Scheduler */}
          <TabsContent value="scheduler" className="h-full">
            <Card className="glass-strong h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-bhutan-red" />
                    Study Scheduler
                  </div>
                  <Button variant="outline" size="sm" className>
                    <Download className="w-4 h-4 mr-2" />
                    Export Calendar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full">
                <div className="max-w-md mx-auto">
                  <Calendar
                    mode="single"
                    className="rounded-lg border"
                    classNames={{
                      months: "flex flex-col space-y-4 sm:mx-4",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                    }}
                  />
                  <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      📅 Click on dates to plan your study sessions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Flashcards */}
          <TabsContent value="flashcards" className="h-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Flashcard Display */}
              <Card className="glass-strong lg:col-span-2 flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-600" />
                      Active Recall Flashcards
                    </div>
                    <Badge variant="secondary">
                      {currentFlashcard + 1} / {flashcards.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center">
                  {flashcardResult ? (
                    <div className="text-center">
                      {flashcardResult === 'correct' && (
                        <div className="space-y-3">
                          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" />
                          <p className="text-lg font-semibold text-green-600">Correct!</p>
                          <p className="text-sm text-muted-foreground">
                            You'll see this card again in a day
                          </p>
                        </div>
                      )}
                      {flashcardResult === 'review' && (
                        <div className="space-y-3">
                          <RefreshCw className="w-16 h-16 text-yellow-600 mx-auto" />
                          <p className="text-lg font-semibold text-yellow-600">Needs Review</p>
                          <p className="text-sm text-muted-foreground">
                            You'll see this card again soon
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "relative w-full min-h-[300px] bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-8 cursor-pointer transition-transform duration-300",
                        "hover:scale-[1.02]"
                      )}
                      onClick={handleFlashcardFlip}
                    >
                      <div className="text-center">
                        <h3 className="text-xl font-semibold mb-4">
                          {flipped ? flashcards[currentFlashcard].back : flashcards[currentFlashcard].front}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-4">
                          {flipped ? 'Answer' : 'Question'} • Click to flip
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {!flashcardResult && (
                    <div className="flex items-center justify-center gap-4 mt-6">
                      {flipped && (
                        <>
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => handleFlashcardResult('correct')}
                            className="flex-1"
                          >
                            <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                            Got it!
                          </Button>
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => handleFlashcardResult('review')}
                            className="flex-1"
                          >
                            <RefreshCw className="w-5 h-5 mr-2 text-yellow-600" />
                            Review
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="lg"
                        onClick={handleFlashcardNext}
                      >
                        Skip →
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Flashcard List */}
              <Card className="glass-strong">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-bhutan-orange" />
                    Card Stack
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {flashcards.map((card, index) => (
                      <div
                        key={card.id}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-all",
                          "hover:bg-accent/50",
                          index === currentFlashcard && "border-primary bg-primary/10"
                        )}
                        onClick={() => {
                          setCurrentFlashcard(index)
                          setFlipped(false)
                          setFlashcardResult(null)
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={cn("text-xs", getDifficultyColor(card.difficulty))}>
                            {card.difficulty}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Reviewed {card.reviewCount}x
                          </span>
                        </div>
                        <p className="text-sm font-medium line-clamp-1">
                          {card.front}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}