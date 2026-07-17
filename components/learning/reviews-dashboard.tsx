'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Search,
  Filter,
  Calendar,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils'

interface Review {
  id: string
  courseId: string
  userId: string
  userName: string
  userAvatar?: string
  rating: number
  title: string
  content: string
  helpful: number
  notHelpful: number
  createdAt: string
  updatedAt: string
}

interface ReviewsDashboardProps {
  reviews: Review[]
  onHelpfulClick?: (reviewId: string, helpful: boolean) => void
  currentUserId?: string
}

export function ReviewsDashboard({
  reviews,
  onHelpfulClick,
  currentUserId
}: ReviewsDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest'>('recent')
  const [filterRating, setFilterRating] = useState<number | 'all'>('all')
  const [helpfulVotes, setHelpfulVotes] = useState<Set<string>>(new Set())

  // Calculate rating statistics
  const ratingStats = useMemo(() => {
    const totalReviews = reviews.length
    const averageRating = totalReviews > 0
      ? reviews.reduce((acc, review) => acc + review.rating, 0) / totalReviews
      : 0

    const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length,
      percentage: totalReviews > 0
        ? (reviews.filter(r => r.rating === star).length / totalReviews) * 100
        : 0
    }))

    return { totalReviews, averageRating, ratingDistribution }
  }, [reviews])

  // Format date to relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  // Get star color
  const getStarColor = (filled: boolean) => {
    return filled ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'
  }

  // Filter and sort reviews
  const filteredAndSortedReviews = useMemo(() => {
    let filtered = [...reviews]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(review =>
        review.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply rating filter
    if (filterRating !== 'all') {
      filtered = filtered.filter(review => review.rating === filterRating)
    }

    // Apply sorting
    switch (sortBy) {
      case 'highest':
        filtered.sort((a, b) => b.rating - a.rating)
        break
      case 'lowest':
        filtered.sort((a, b) => a.rating - b.rating)
        break
      case 'recent':
      default:
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
    }

    return filtered
  }, [reviews, searchQuery, sortBy, filterRating])

  // Handle helpful vote
  const handleHelpfulClick = (reviewId: string, helpful: boolean) => {
    setHelpfulVotes(prev => {
      const newSet = new Set(prev)
      // Remove any existing vote for this review
      reviews.forEach(review => {
        if (newSet.has(`${review.id}-true`)) newSet.delete(`${review.id}-true`)
        if (newSet.has(`${review.id}-false`)) newSet.delete(`${review.id}-false`)
      })
      // Add new vote
      newSet.add(`${reviewId}-${helpful}`)
      return newSet
    })

    if (onHelpfulClick) {
      onHelpfulClick(reviewId, helpful)
    }
  }

  // Render star rating
  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={cn(
              sizeClass,
              star <= rating && getStarColor(true),
              star > rating && getStarColor(false)
            )}
            fill={star <= rating}
          />
        ))}
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="glass max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Reviews Yet</h3>
              <p className="text-muted-foreground text-sm">
                Be the first to review this course!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Rating Analytics - Left Column */}
      <Card className="glass-strong lg:w-1/3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-bhutan-yellow" />
            Rating Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Rating */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-5xl font-bold">{ratingStats.averageRating.toFixed(1)}</span>
              <div className="text-left">
                {renderStars(Math.round(ratingStats.averageRating))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Based on {ratingStats.totalReviews} reviews
            </p>
          </div>

          {/* Rating Breakdown */}
          <div className="space-y-3">
            {ratingStats.ratingDistribution.map(({ star, count, percentage }) => (
              <div
                key={star}
                className="space-y-1"
              >
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span>{star}</span>
                    <Star className="w-3 h-3 text-yellow-500 fill" />
                  </div>
                  <span className="text-muted-foreground">{count} reviews</span>
                </div>
                <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                  <Progress
                    value={percentage}
                    className="h-full"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {percentage.toFixed(0)}%
                </p>
              </div>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t">
            <Card className="glass p-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-bhutan-yellow">
                  {ratingStats.ratingDistribution[0].percentage.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">5-Star</p>
              </div>
            </Card>
            <Card className="glass p-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-bhutan-orange">
                  {ratingStats.totalReviews}
                </p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List - Right Column */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* Search and Filters */}
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search reviews..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="highest">Highest Rated</SelectItem>
                  <SelectItem value="lowest">Lowest Rated</SelectItem>
                </SelectContent>
              </Select>

              {/* Filter */}
              <Select value={filterRating.toString()} onValueChange={(value) => setFilterRating(value as any)}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="All Stars" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Reviews List */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4">
            {filteredAndSortedReviews.map((review) => {
              const hasVotedHelpful = helpfulVotes.has(`${review.id}-true`)
              const hasVotedNotHelpful = helpfulVotes.has(`${review.id}-false`)

              return (
                <Card key={review.id} className="glass hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="w-10 h-10 border-2 border-primary/20">
                            {review.userAvatar ? (
                              <img
                                src={review.userAvatar}
                                alt={review.userName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <AvatarFallback className="bg-bhutan-yellow text-bhutan-yellow-foreground">
                                {review.userName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm">{review.userName}</h3>
                              {renderStars(review.rating)}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatRelativeTime(review.createdAt)}
                            </p>
                          </div>
                        </div>

                        {review.updatedAt !== review.createdAt && (
                          <Badge variant="secondary" className="text-xs">
                            Edited
                          </Badge>
                        )}
                      </div>

                      {/* Review Title */}
                      <h4 className="font-semibold text-base">{review.title}</h4>

                      {/* Review Content */}
                      <p className="text-sm leading-relaxed text-foreground/80 line-clamp-4">
                        {review.content}
                      </p>

                      {/* Helpfulness */}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Helpful?</span>

                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "flex items-center gap-1",
                              hasVotedHelpful && "text-bhutan-yellow"
                            )}
                            onClick={() => handleHelpfulClick(review.id, true)}
                          >
                            <ThumbsUp className={cn(
                              "w-4 h-4",
                              hasVotedHelpful && "fill-current"
                            )} />
                            <span className="text-xs">
                              {review.helpful + (hasVotedHelpful ? 1 : 0)}
                            </span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "flex items-center gap-1",
                              hasVotedNotHelpful && "text-red-600"
                            )}
                            onClick={() => handleHelpfulClick(review.id, false)}
                          >
                            <ThumbsDown className={cn(
                              "w-4 h-4",
                              hasVotedNotHelpful && "fill-current"
                            )} />
                            <span className="text-xs">
                              {review.notHelpful + (hasVotedNotHelpful ? 1 : 0)}
                            </span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}