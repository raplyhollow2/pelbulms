'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Star,
  Users,
  Clock,
  DollarSign,
  BookOpen,
  Award,
  CheckCircle,
  XCircle,
  X,
  Plus,
  TrendingUp,
  GraduationCap,
} from 'lucide-react'
import { cn as cnUtils } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']

interface CourseForComparison extends Course {
  profiles?: {
    full_name?: string
    avatar_url?: string
  } | null
  students_count?: number
  rating?: number
  modules_count?: number
  lessons_count?: number
  has_certificate?: boolean
  has_subtitles?: boolean
  last_updated?: string
}

interface CourseComparisonProps {
  courses: CourseForComparison[]
  maxCompare?: number
  trigger?: React.ReactNode
}

export function CourseComparison({
  courses,
  maxCompare = 3,
  trigger,
}: CourseComparisonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourses((prev) => {
      if (prev.includes(courseId)) {
        return prev.filter((id) => id !== courseId)
      } else if (prev.length < maxCompare) {
        return [...prev, courseId]
      }
      return prev
    })
  }

  const comparisonCourses = courses.filter((c) =>
    selectedCourses.includes(c.id)
  )

  const getLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-600'
      case 'intermediate':
        return 'bg-blue-600'
      case 'advanced':
        return 'bg-purple-600'
      case 'expert':
        return 'bg-red-600'
      default:
        return 'bg-gray-600'
    }
  }

  const getLevelScore = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner':
        return 1
      case 'intermediate':
        return 2
      case 'advanced':
        return 3
      case 'expert':
        return 4
      default:
        return 0
    }
  }

  const renderValue = (
    value: string | number | boolean | undefined | null,
    fallback: string | React.ReactNode = 'N/A'
  ) => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-muted-foreground">{fallback}</span>
    }

    if (typeof value === 'boolean') {
      return value ? (
        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
      ) : (
        <XCircle className="w-5 h-5 text-red-600 mx-auto" />
      )
    }

    if (typeof value === 'number') {
      return value.toLocaleString()
    }

    return value
  }

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })
  }

  const ComparisonTable = () => {
    if (comparisonCourses.length === 0) {
      return (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No courses selected</h3>
          <p className="text-muted-foreground mb-4">
            Select up to {maxCompare} courses to compare their features side by side
          </p>
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Feature</TableHead>
              {comparisonCourses.map((course) => (
                <TableHead key={course.id} className="min-w-[200px] text-center">
                  <div className="space-y-2">
                    <div className="font-semibold text-base">{course.title}</div>
                    {course.thumbnail_url && (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="w-full h-24 object-cover rounded"
                      />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Price */}
            <TableRow>
              <TableCell className="font-medium">Price</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  <div className="text-lg font-bold text-bhutan-yellow">
                    ${course.price === 0 ? 'Free' : course.price}
                  </div>
                </TableCell>
              ))}
            </TableRow>

            {/* Rating */}
            <TableRow>
              <TableCell className="font-medium">Rating</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">
                      {renderValue(course.rating, 'New')}
                    </span>
                  </div>
                </TableCell>
              ))}
            </TableRow>

            {/* Students */}
            <TableRow>
              <TableCell className="font-medium">Students</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{renderValue(course.students_count)}</span>
                  </div>
                </TableCell>
              ))}
            </TableRow>

            {/* Duration */}
            <TableRow>
              <TableCell className="font-medium">Duration</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{formatDuration(course.duration_minutes)}</span>
                  </div>
                </TableCell>
              ))}
            </TableRow>

            {/* Level */}
            <TableRow>
              <TableCell className="font-medium">Difficulty</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  <Badge className={getLevelColor(course.level)}>
                    {course.level}
                  </Badge>
                </TableCell>
              ))}
            </TableRow>

            {/* Category */}
            <TableRow>
              <TableCell className="font-medium">Category</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  <Badge variant="outline">{course.category}</Badge>
                </TableCell>
              ))}
            </TableRow>

            {/* Instructor */}
            <TableRow>
              <TableCell className="font-medium">Instructor</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  {renderValue(course.profiles?.full_name)}
                </TableCell>
              ))}
            </TableRow>

            {/* Modules */}
            <TableRow>
              <TableCell className="font-medium">Modules</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <span>{renderValue(course.modules_count)}</span>
                  </div>
                </TableCell>
              ))}
            </TableRow>

            {/* Certificate */}
            <TableRow>
              <TableCell className="font-medium">Certificate</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  {renderValue(course.has_certificate)}
                </TableCell>
              ))}
            </TableRow>

            {/* Subtitles */}
            <TableRow>
              <TableCell className="font-medium">Subtitles</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  {renderValue(course.has_subtitles)}
                </TableCell>
              ))}
            </TableRow>

            {/* Language */}
            <TableRow>
              <TableCell className="font-medium">Language</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  {renderValue(course.language?.toUpperCase() || 'EN')}
                </TableCell>
              ))}
            </TableRow>

            {/* Last Updated */}
            <TableRow>
              <TableCell className="font-medium">Last Updated</TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  {renderValue(formatDate(course.last_updated))}
                </TableCell>
              ))}
            </TableRow>

            {/* Learning Objectives */}
            <TableRow>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Learning Objectives
                </div>
              </TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  {course.learning_objectives && course.learning_objectives.length > 0 ? (
                    <ul className="text-sm space-y-1 text-left">
                      {course.learning_objectives.slice(0, 3).map((objective, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{objective}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">No objectives listed</span>
                  )}
                </TableCell>
              ))}
            </TableRow>

            {/* Action Buttons */}
            <TableRow>
              <TableCell></TableCell>
              {comparisonCourses.map((course) => (
                <TableCell key={course.id} className="text-center">
                  <Button
                    className="w-full bg-bhutan-yellow hover:bg-bhutan-orange text-black"
                    size="sm"
                    onClick={() => (window.location.href = `/courses/${course.id}`)}
                  >
                    View Course
                  </Button>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        {trigger || (
          <Button variant="outline" className="glass touch-feedback">
            <GraduationCap className="w-5 h-5 mr-2" />
            Compare Courses
            {selectedCourses.length > 0 && (
              <Badge className="ml-2 bg-bhutan-yellow text-black">
                {selectedCourses.length}
              </Badge>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Compare Courses
            </div>
            {selectedCourses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCourses([])}
                className="text-muted-foreground"
              >
                Clear Selection
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {selectedCourses.length > 0
              ? `Comparing ${selectedCourses.length} course${selectedCourses.length > 1 ? 's' : ''}`
              : `Select up to ${maxCompare} courses to compare side by side`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Course Selection */}
          <div>
            <h3 className="text-sm font-medium mb-3">Select Courses to Compare</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
              {courses.map((course) => {
                const isSelected = selectedCourses.includes(course.id)
                const isDisabled =
                  !isSelected && selectedCourses.length >= maxCompare

                return (
                  <div
                    key={course.id}
                    className={cnUtils(
                      'p-3 rounded-lg border transition-all cursor-pointer',
                      isSelected
                        ? 'border-bhutan-yellow bg-bhutan-yellow/10'
                        : 'border-border/50 hover:border-bhutan-yellow/30',
                      isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => !isDisabled && toggleCourseSelection(course.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm line-clamp-2">
                          {course.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {course.category}
                          </Badge>
                          <Badge className={`text-xs ${getLevelColor(course.level)}`}>
                            {course.level}
                          </Badge>
                        </div>
                        <div className="text-sm font-semibold text-bhutan-yellow mt-1">
                          ${course.price === 0 ? 'Free' : course.price}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Comparison Table */}
          <div className="border-t border-border/50 pt-4">
            <ComparisonTable />
          </div>

          {/* Best Value Highlight */}
          {comparisonCourses.length >= 2 && (
            <div className="bg-bhutan-yellow/10 border border-bhutan-yellow/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-bhutan-yellow flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold mb-1">Best Value Recommendation</h4>
                  <p className="text-sm text-muted-foreground">
                    Based on rating, price, and content depth, we recommend{' '}
                    <span className="font-semibold text-bhutan-yellow">
                      {
                        comparisonCourses.reduce((best, current) => {
                          const currentScore =
                            (current.rating || 0) * 10 -
                            (current.price || 0) / 10 +
                            (current.modules_count || 0) * 2
                          const bestScore =
                            (best.rating || 0) * 10 -
                            (best.price || 0) / 10 +
                            (best.modules_count || 0) * 2
                          return currentScore > bestScore ? current : best
                        }).title
                      }
                    </span>
                    . It offers the best combination of quality, content, and
                    value for money.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}