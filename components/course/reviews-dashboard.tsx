'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Star, Filter, Search, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Review {
  id: string
  user_id: string
  user_name: string
  user_avatar?: string
  rating: number
  comment: string
  created_at: string
  helpful_count: number
  not_helpful_count: number
  user_helpful?: boolean
  user_not_helpful?: boolean
}

interface ReviewsDashboardProps {
  courseId: string
  userId?: string
}

export function ReviewsDashboard({ courseId, userId }: ReviewsDashboardProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [filteredReviews, setFilteredReviews] = useState<Review[]>([])
  const [ratingStats, setRatingStats] = useState({
    average: 0,
    total: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRating, setSelectedRating] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('recent')
  const [myRating, setMyRating] = useState(5)
  const [myComment, setMyComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitOk, setSubmitOk] = useState(false)

  useEffect(() => {
    loadReviews()
  }, [courseId])

  useEffect(() => {
    filterAndSortReviews()
  }, [reviews, searchQuery, selectedRating, sortBy])

  const loadReviews = async () => {
    try {
      const response = await fetch(`/api/reviews?courseId=${courseId}`)
      if (response.ok) {
        const data = await response.json()
        setReviews(data.reviews || [])
        setRatingStats(data.stats || ratingStats)
      }
    } catch (error) {
      console.error('Error loading reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortReviews = () => {
    let filtered = [...reviews]

    // Filter by rating
    if (selectedRating !== 'all') {
      const rating = parseInt(selectedRating)
      filtered = filtered.filter(review => review.rating === rating)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(review =>
        review.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.user_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      } else if (sortBy === 'highest') {
        return b.rating - a.rating
      } else if (sortBy === 'lowest') {
        return a.rating - b.rating
      } else if (sortBy === 'helpful') {
        return b.helpful_count - a.helpful_count
      }
      return 0
    })

    setFilteredReviews(filtered)
  }

  const handleSubmitReview = async () => {
    if (!userId) return
    setSubmitting(true)
    setSubmitError('')
    setSubmitOk(false)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          rating: myRating,
          comment: myComment.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit review')
      setSubmitOk(true)
      setMyComment('')
      await loadReviews()
    } catch (e: any) {
      setSubmitError(e?.message || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const handleHelpful = async (reviewId: string, helpful: boolean) => {
    if (!userId) return

    try {
      const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful })
      })

      if (response.ok) {
        setReviews(reviews.map(review =>
          review.id === reviewId
            ? {
                ...review,
                helpful_count: helpful
                  ? review.helpful_count + 1
                  : review.helpful_count,
                not_helpful_count: !helpful
                  ? review.not_helpful_count + 1
                  : review.not_helpful_count,
                user_helpful: helpful,
                user_not_helpful: !helpful
              }
            : review
        ))
      }
    } catch (error) {
      console.error('Error marking review as helpful:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 30) return `${diffDays} days ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }

  const renderStars = (rating: number, size = 'sm') => {
    const stars = []
    const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`${sizeClass} ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      )
    }
    return stars
  }

  const getRatingPercentage = (count: number) => {
    return ratingStats.total > 0 ? (count / ratingStats.total) * 100 : 0
  }

  if (loading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Reviews & Ratings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p>Loading reviews...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5" />
          Reviews & Ratings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Rating Statistics */}
          <div className="space-y-6">
            {/* Overall Rating */}
            <div className="text-center p-6 bg-secondary/20 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-4xl font-bold">{ratingStats.average.toFixed(1)}</span>
                <div className="flex">{renderStars(Math.round(ratingStats.average), 'sm')}</div>
              </div>
              <p className="text-sm text-muted-foreground">
                {ratingStats.total} {ratingStats.total === 1 ? 'rating' : 'ratings'}
              </p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingStats.distribution[star as keyof typeof ratingStats.distribution]
                const percentage = getRatingPercentage(count)

                return (
                  <div key={star} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="font-medium">{star} star</span>
                      </div>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                )
              })}
            </div>

            {/* Rating Breakdown by Star */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Filter by Rating</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedRating === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedRating('all')}
                  className="text-xs"
                >
                  All
                </Button>
                {[5, 4, 3, 2, 1].map((star) => (
                  <Button
                    key={star}
                    variant={selectedRating === star.toString() ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedRating(star.toString())}
                    className="text-xs"
                  >
                    {star}★
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Reviews List */}
          <div className="lg:col-span-2 space-y-4">
            {userId && (
              <div className="rounded-lg border p-4 space-y-3 bg-background/60">
                <h3 className="font-semibold text-sm">Rate this course</h3>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setMyRating(star)}
                      className="p-0.5"
                      aria-label={`${star} stars`}
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= myRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Share your experience (optional)"
                  value={myComment}
                  onChange={(e) => setMyComment(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={handleSubmitReview}
                  disabled={submitting}
                  className="bg-bhutan-yellow text-black hover:bg-bhutan-orange"
                >
                  {submitting ? 'Saving…' : 'Submit review'}
                </Button>
                {submitError && <p className="text-xs text-destructive">{submitError}</p>}
                {submitOk && (
                  <p className="text-xs text-green-600">Thanks — your rating was saved.</p>
                )}
              </div>
            )}

            {/* Search and Filter */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search reviews..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="highest">Highest Rated</SelectItem>
                  <SelectItem value="lowest">Lowest Rated</SelectItem>
                  <SelectItem value="helpful">Most Helpful</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reviews */}
            <ScrollArea className="h-[500px]">
              {filteredReviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Star className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">No reviews found</p>
                </div>
              ) : (
                <div className="space-y-4 pr-4">
                  {filteredReviews.map((review) => (
                    <div
                      key={review.id}
                      className="p-4 bg-secondary/20 rounded-lg border border-border/40"
                    >
                      {/* User Info and Rating */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 bg-bhutan-yellow">
                            <AvatarFallback className="bg-bhutan-yellow text-black font-semibold">
                              {review.user_name?.split(' ').map(n => n[0]).join('') || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold text-sm">{review.user_name}</h4>
                            <div className="flex items-center gap-1 mt-0.5">
                              {renderStars(review.rating)}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(review.created_at)}
                        </span>
                      </div>

                      {/* Review Comment */}
                      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                        {review.comment}
                      </p>

                      {/* Helpful Buttons */}
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleHelpful(review.id, true)}
                          className={`flex items-center gap-1 text-xs ${
                            review.user_helpful ? 'text-green-600' : 'text-muted-foreground'
                          }`}
                        >
                          <ThumbsUp className={`w-3 h-3 ${review.user_helpful ? 'fill-current' : ''}`} />
                          <span>Helpful ({review.helpful_count})</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleHelpful(review.id, false)}
                          className={`flex items-center gap-1 text-xs ${
                            review.user_not_helpful ? 'text-red-600' : 'text-muted-foreground'
                          }`}
                        >
                          <ThumbsDown className={`w-3 h-3 ${review.user_not_helpful ? 'fill-current' : ''}`} />
                          <span>Not Helpful ({review.not_helpful_count})</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}