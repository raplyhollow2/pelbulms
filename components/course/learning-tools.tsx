'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Clock, Flame, BrainCircuit, RotateCw, Play, Pause, Check } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface LearningToolsProps {
  courseId: string
  lessonId: string
  userId?: string
}

export function LearningTools({ courseId, lessonId, userId }: LearningToolsProps) {
  // Pomodoro State
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60) // 25 minutes in seconds
  const [pomodoroActive, setPomodoroActive] = useState(false)
  const [pomodoroMode, setPomodoroMode] = useState<'focus' | 'short-break' | 'long-break'>('focus')
  const pomodoroRef = useRef<NodeJS.Timeout | null>(null)

  // Study Streak
  const [studyStreak, setStudyStreak] = useState(14)

  // Flashcard State
  const [flashcards, setFlashcards] = useState([
    { id: 1, front: 'What are Server Components?', back: 'Components that render on the server, reducing JavaScript sent to the client', reviewed: false },
    { id: 2, front: 'What is the App Router?', back: 'The new routing system in Next.js 13+ that uses file-based routing with layouts', reviewed: false },
    { id: 3, front: 'What are Server Actions?', back: 'Functions that run on the server and can be called from client components', reviewed: false },
  ])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)

  // Pomodoro Logic
  useEffect(() => {
    if (pomodoroActive && pomodoroTime > 0) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTime(prev => prev - 1)
      }, 1000)
    } else if (pomodoroTime === 0) {
      // Timer completed
      setPomodoroActive(false)
      handlePomodoroComplete()
    }

    return () => {
      if (pomodoroRef.current) {
        clearInterval(pomodoroRef.current)
      }
    }
  }, [pomodoroActive, pomodoroTime])

  const handlePomodoroComplete = () => {
    // Play sound or show notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pomodoro Timer Complete!', {
        body: pomodoroMode === 'focus' ? 'Time for a break!' : 'Ready to focus again?',
        icon: '/favicon.ico'
      })
    }

    // Auto switch modes
    if (pomodoroMode === 'focus') {
      setPomodoroMode('short-break')
      setPomodoroTime(5 * 60) // 5 minutes
    } else {
      setPomodoroMode('focus')
      setPomodoroTime(25 * 60) // 25 minutes
    }
  }

  const togglePomodoro = () => {
    setPomodoroActive(!pomodoroActive)
  }

  const resetPomodoro = () => {
    setPomodoroActive(false)
    setPomodoroTime(pomodoroMode === 'focus' ? 25 * 60 : pomodoroMode === 'short-break' ? 5 * 60 : 15 * 60)
  }

  const setPomodoroModeAndReset = (mode: 'focus' | 'short-break' | 'long-break') => {
    setPomodoroMode(mode)
    setPomodoroActive(false)
    const times = { 'focus': 25 * 60, 'short-break': 5 * 60, 'long-break': 15 * 60 }
    setPomodoroTime(times[mode])
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getProgressPercentage = () => {
    const totalTimes = { 'focus': 25 * 60, 'short-break': 5 * 60, 'long-break': 15 * 60 }
    const totalTime = totalTimes[pomodoroMode]
    return ((totalTime - pomodoroTime) / totalTime) * 100
  }

  // Flashcard Logic
  const handleCardFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleNextCard = () => {
    setIsFlipped(false)
    setCurrentCardIndex((prev) => (prev + 1) % flashcards.length)
  }

  const handleMarkReviewed = () => {
    setFlashcards(flashcards.map(card =>
      card.id === flashcards[currentCardIndex].id
        ? { ...card, reviewed: true }
        : card
    ))
    setReviewedCount(prev => prev + 1)
    handleNextCard()
  }

  return (
    <div className="space-y-6">
      {/* Pomodoro Timer & Study Streak */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pomodoro Timer */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-bhutan-yellow" />
              Pomodoro Timer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Timer Display */}
            <div className="text-center">
              <div className="relative w-48 h-48 mx-auto">
                {/* Circular Progress */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-secondary"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 88}`}
                    strokeDashoffset={`${2 * Math.PI * 88 * (1 - getProgressPercentage() / 100)}`}
                    className="text-bhutan-yellow transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{formatTime(pomodoroTime)}</span>
                  <Badge variant="secondary" className="mt-2">
                    {pomodoroMode === 'focus' ? '🎯 Focus' : pomodoroMode === 'short-break' ? '☕ Short Break' : '🌴 Long Break'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2 justify-center">
              <Button
                onClick={togglePomodoro}
                size="lg"
                className="bg-bhutan-yellow hover:bg-bhutan-orange"
              >
                {pomodoroActive ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </>
                )}
              </Button>
              <Button
                onClick={resetPomodoro}
                size="lg"
                variant="outline"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
            </div>

            {/* Mode Selection */}
            <div className="flex gap-2 justify-center">
              <Button
                size="sm"
                variant={pomodoroMode === 'focus' ? 'default' : 'outline'}
                onClick={() => setPomodoroModeAndReset('focus')}
              >
                Focus (25m)
              </Button>
              <Button
                size="sm"
                variant={pomodoroMode === 'short-break' ? 'default' : 'outline'}
                onClick={() => setPomodoroModeAndReset('short-break')}
              >
                Short Break (5m)
              </Button>
              <Button
                size="sm"
                variant={pomodoroMode === 'long-break' ? 'default' : 'outline'}
                onClick={() => setPomodoroModeAndReset('long-break')}
              >
                Long Break (15m)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Study Streak */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Study Streak
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-6xl font-bold text-orange-500 mb-2">
                🔥 {studyStreak}
              </div>
              <p className="text-sm text-muted-foreground">Day streak</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>This week</span>
                <span className="font-semibold">12 sessions</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Total study time</span>
                <span className="font-semibold">18.5 hours</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Lessons completed</span>
                <span className="font-semibold">24 lessons</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center">
                Keep up the great work! You're on fire! 🔥
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Recall Flashcards */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-bhutan-yellow" />
            Active Recall Flashcards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Card {currentCardIndex + 1} of {flashcards.length}
            </div>
            <Badge variant="secondary">
              Reviewed: {reviewedCount}/{flashcards.length}
            </Badge>
          </div>

          {/* Flashcard */}
          <div
            className="relative h-64 cursor-pointer perspective-1000"
            onClick={handleCardFlip}
          >
            <div
              className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
            >
              {/* Front */}
              <div className="absolute w-full h-full backface-hidden">
                <div className="h-full p-6 bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 rounded-lg border-2 border-bhutan-yellow/30 flex items-center justify-center">
                  <p className="text-center text-lg font-medium">
                    {flashcards[currentCardIndex]?.front}
                  </p>
                </div>
              </div>

              {/* Back */}
              <div
                className="absolute w-full h-full backface-hidden"
                style={{ transform: 'rotateY(180deg)' }}
              >
                <div className="h-full p-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg border-2 border-blue-500/30 flex items-center justify-center">
                  <p className="text-center text-base">
                    {flashcards[currentCardIndex]?.back}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2 justify-center">
            <Button onClick={handleNextCard} variant="outline">
              <RotateCw className="w-4 h-4 mr-2" />
              Next Card
            </Button>
            <Button
              onClick={handleMarkReviewed}
              className="bg-green-600 hover:bg-green-700"
              disabled={flashcards[currentCardIndex]?.reviewed}
            >
              <Check className="w-4 h-4 mr-2" />
              Mark as Reviewed
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Click the card to flip • Review cards to test your knowledge
          </p>
        </CardContent>
      </Card>
    </div>
  )
}