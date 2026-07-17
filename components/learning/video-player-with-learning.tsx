'use client'

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Clock,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils'
import { UnifiedLearningInterface } from './unified-learning-interface'

interface Section {
  id: string
  title: string
  description: string
  lessons: {
    id: string
    title: string
    description: string
    duration: number
    video_url: string
    is_free: boolean
    completed: boolean
  }[]
}

interface Course {
  id: string
  title: string
  description: string
  category: string
  level: string
  language: string
  duration_minutes: number
  last_updated: string
  requirements?: string[]
  learningObjectives?: string[]
  targetAudience?: string[]
  instructor?: {
    full_name: string
    bio?: string
    avatar_url?: string
  }
}

interface VideoPlayerWithLearningProps {
  courseId: string
  course: Course
  sections: Section[]
  currentLessonId?: string
  announcements?: any[]
  reviews?: any[]
  currentUserId?: string
}

export function VideoPlayerWithLearning({
  courseId,
  course,
  sections,
  currentLessonId,
  announcements,
  reviews,
  currentUserId
}: VideoPlayerWithLearningProps) {
  const [currentLesson, setCurrentLesson] = useState<{
    id: string
    title: string
    description: string
    video_url: string
    duration: number
    completed: boolean
  } | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [volume, setVolume] = useState(1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Find and set current lesson
  useEffect(() => {
    if (currentLessonId) {
      sections.forEach(section => {
        const lesson = section.lessons.find(l => l.id === currentLessonId)
        if (lesson) {
          setCurrentLesson(lesson)
        }
      })
    } else if (sections.length > 0 && sections[0].lessons.length > 0) {
      setCurrentLesson(sections[0].lessons[0])
    }
  }, [currentLessonId, sections])

  // Handle video play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  // Handle mute toggle
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }

  // Handle time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  // Handle loaded metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // Skip backward/forward
  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds))
    }
  }

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Handle playback speed
  const handlePlaybackSpeed = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]
    const currentIndex = speeds.indexOf(playbackSpeed)
    const nextIndex = (currentIndex + 1) % speeds.length
    const newSpeed = speeds[nextIndex]

    setPlaybackSpeed(newSpeed)
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed
    }
  }

  // Navigate to next/previous lesson
  const navigateLesson = (direction: 'prev' | 'next') => {
    if (!currentLesson) return

    let foundCurrent = false
    for (const section of sections) {
      for (const lesson of section.lessons) {
        if (foundCurrent) {
          setCurrentLesson(lesson)
          return
        }
        if (lesson.id === currentLesson.id) {
          foundCurrent = true
          if (direction === 'prev' && section.lessons.indexOf(lesson) > 0) {
            const prevIndex = section.lessons.indexOf(lesson) - 1
            setCurrentLesson(section.lessons[prevIndex])
            return
          }
        }
      }
    }
  }

  // Mark lesson as completed
  const markAsCompleted = () => {
    // TODO: Implement lesson completion logic
    console.log('Lesson completed:', currentLesson?.id)
  }

  return (
    <div ref={containerRef} className="flex flex-col lg:flex-row h-screen bg-background">
      {/* Video Section */}
      <div className={cn(
        'flex flex-col bg-black',
        isFullscreen ? 'fixed inset-0 z-50' : 'lg:w-2/3'
      )}>
        {/* Video Player */}
        <div className="relative flex-1 bg-black flex items-center justify-center">
          {currentLesson?.video_url ? (
            <video
              ref={videoRef}
              src={currentLesson.video_url}
              className="max-w-full max-h-full"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <div className="text-center text-white">
              <p className="text-lg">No video available</p>
              <p className="text-sm text-gray-400 mt-2">Select a lesson to start learning</p>
            </div>
          )}

          {/* Play/Pause Overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            onClick={togglePlay}
          >
            <Button
              size="icon"
              variant="ghost"
              className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-white" />
              ) : (
                <Play className="w-8 h-8 text-white ml-1" />
              )}
            </Button>
          </div>

          {/* Lesson Info Overlay */}
          <div className="absolute top-4 left-4 right-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="bg-black/50 text-white">
                {currentLesson?.title || 'No lesson selected'}
              </Badge>
              {currentLesson?.completed && (
                <Badge className="bg-green-600">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Completed
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Video Controls */}
        <div className="bg-black p-4 space-y-3">
          {/* Progress Bar */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="text-white hover:text-white"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipTime(-10)}
                className="text-white hover:text-white"
                title="Rewind 10s"
              >
                <RotateCw className="w-4 h-4 -scale-x-100" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipTime(10)}
                className="text-white hover:text-white"
                title="Forward 10s"
              >
                <RotateCw className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white hover:text-white"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlaybackSpeed}
                className="text-white hover:text-white text-xs font-mono"
              >
                {playbackSpeed}x
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white hover:text-white"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Navigation */}
          {currentLesson && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateLesson('prev')}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={markAsCompleted}
                className="bg-green-600 text-white border-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Mark Complete
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateLesson('next')}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Learning Interface */}
      <div className={cn(
        'flex-1 bg-background',
        !isFullscreen && 'lg:w-1/3'
      )}>
        <UnifiedLearningInterface
          courseId={courseId}
          course={course}
          sections={sections}
          currentLessonId={currentLesson?.id}
          announcements={announcements}
          reviews={reviews}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  )
}