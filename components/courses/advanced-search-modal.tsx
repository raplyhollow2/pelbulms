'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  SlidersHorizontal,
  X,
  DollarSign,
  Clock,
  Star,
  Users,
  BookOpen,
  TrendingUp,
  CheckCircle,
} from 'lucide-react'

interface SearchFilters {
  searchTerm: string
  categories: string[]
  levels: string[]
  priceRange: [number, number]
  rating: number
  duration: number
  language: string
  hasSubtitle: boolean
  hasCertificate: boolean
  sortBy: 'popular' | 'newest' | 'rating' | 'price-low' | 'price-high'
}

interface AdvancedSearchModalProps {
  availableCategories?: string[]
  availableLevels?: string[]
  availableLanguages?: string[]
  onSearch: (filters: SearchFilters) => void
  initialFilters?: Partial<SearchFilters>
  trigger?: React.ReactNode
}

const defaultFilters: SearchFilters = {
  searchTerm: '',
  categories: [],
  levels: [],
  priceRange: [0, 500],
  rating: 0,
  duration: 0,
  language: 'en',
  hasSubtitle: false,
  hasCertificate: false,
  sortBy: 'popular',
}

export function AdvancedSearchModal({
  availableCategories = [],
  availableLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
  availableLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh'],
  onSearch,
  initialFilters = {},
  trigger,
}: AdvancedSearchModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    ...defaultFilters,
    ...initialFilters,
  })

  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const toggleCategory = (category: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }))
  }

  const toggleLevel = (level: string) => {
    setFilters((prev) => ({
      ...prev,
      levels: prev.levels.includes(level)
        ? prev.levels.filter((l) => l !== level)
        : [...prev.levels, level],
    }))
  }

  const handleSearch = () => {
    onSearch(filters)
    setIsOpen(false)
  }

  const handleReset = () => {
    setFilters({ ...defaultFilters, ...initialFilters })
  }

  const hasActiveFilters =
    filters.searchTerm ||
    filters.categories.length > 0 ||
    filters.levels.length > 0 ||
    filters.priceRange[0] > 0 ||
    filters.priceRange[1] < 500 ||
    filters.rating > 0 ||
    filters.duration > 0 ||
    filters.hasSubtitle ||
    filters.hasCertificate

  const activeFilterCount =
    (filters.searchTerm ? 1 : 0) +
    filters.categories.length +
    filters.levels.length +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < 500 ? 1 : 0) +
    (filters.rating > 0 ? 1 : 0) +
    (filters.duration > 0 ? 1 : 0) +
    (filters.hasSubtitle ? 1 : 0) +
    (filters.hasCertificate ? 1 : 0)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        {trigger || (
          <Button variant="outline" size="lg" className="glass touch-feedback">
            <SlidersHorizontal className="w-5 h-5 mr-2" />
            Advanced Search
            {activeFilterCount > 0 && (
              <Badge className="ml-2 bg-bhutan-yellow text-black">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Advanced Search
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-muted-foreground"
              >
                Reset All
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            Filter courses by multiple criteria to find exactly what you're looking
            for
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search Term */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Search Term</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search courses by title, description, or tags..."
                value={filters.searchTerm}
                onChange={(e) => updateFilter('searchTerm', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Categories */}
          {availableCategories.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Categories</label>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((category) => (
                  <Badge
                    key={category}
                    variant={filters.categories.includes(category) ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer transition-colors',
                      filters.categories.includes(category)
                        ? 'bg-bhutan-yellow text-black hover:bg-bhutan-orange'
                        : 'hover:bg-bhutan-yellow/20'
                    )}
                    onClick={() => toggleCategory(category)}
                  >
                    {category}
                    {filters.categories.includes(category) && (
                      <X className="w-3 h-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Levels */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Difficulty Level</label>
            <div className="flex flex-wrap gap-2">
              {availableLevels.map((level) => (
                <Badge
                  key={level}
                  variant={filters.levels.includes(level) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-colors',
                    filters.levels.includes(level)
                      ? 'bg-bhutan-yellow text-black hover:bg-bhutan-orange'
                      : 'hover:bg-bhutan-yellow/20'
                  )}
                  onClick={() => toggleLevel(level)}
                >
                  {level}
                  {filters.levels.includes(level) && (
                    <X className="w-3 h-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Price Range
            </label>
            <div className="px-2">
              <Slider
                value={filters.priceRange}
                onValueChange={(value) =>
                  updateFilter('priceRange', value as [number, number])
                }
                max={500}
                step={10}
                className="my-4"
              />
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>${filters.priceRange[0]}</span>
              <span>${filters.priceRange[1]}</span>
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              Minimum Rating
            </label>
            <div className="flex items-center gap-3">
              <Slider
                value={[filters.rating]}
                onValueChange={(value) => updateFilter('rating', value[0])}
                max={5}
                step={0.5}
                className="flex-1"
              />
              <Badge variant="outline" className="min-w-[60px] justify-center">
                {filters.rating > 0 ? `${filters.rating}+` : 'Any'}
              </Badge>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Maximum Duration (hours)
            </label>
            <div className="flex items-center gap-3">
              <Slider
                value={[filters.duration]}
                onValueChange={(value) => updateFilter('duration', value[0])}
                max={100}
                step={5}
                className="flex-1"
              />
              <Badge variant="outline" className="min-w-[60px] justify-center">
                {filters.duration > 0 ? `${filters.duration}h` : 'Any'}
              </Badge>
            </div>
          </div>

          {/* Language */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Language</label>
            <Select
              value={filters.language}
              onValueChange={(value) => updateFilter('language', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Additional Filters */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Additional Filters</label>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-bhutan-yellow/30 transition-colors">
                <Checkbox
                  id="subtitle"
                  checked={filters.hasSubtitle}
                  onCheckedChange={(checked) =>
                    updateFilter('hasSubtitle', checked as boolean)
                  }
                />
                <label
                  htmlFor="subtitle"
                  className="flex-1 text-sm cursor-pointer flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Has Subtitles/Captions</span>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-bhutan-yellow/30 transition-colors">
                <Checkbox
                  id="certificate"
                  checked={filters.hasCertificate}
                  onCheckedChange={(checked) =>
                    updateFilter('hasCertificate', checked as boolean)
                  }
                />
                <label
                  htmlFor="certificate"
                  className="flex-1 text-sm cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Includes Certificate</span>
                </label>
              </div>
            </div>
          </div>

          {/* Sort By */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Sort By
            </label>
            <Select
              value={filters.sortBy}
              onValueChange={(value) =>
                updateFilter('sortBy', value as SearchFilters['sortBy'])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border/50">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-bhutan-yellow hover:bg-bhutan-orange text-black"
              onClick={handleSearch}
            >
              <Search className="w-4 h-4 mr-2" />
              Search Courses
            </Button>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm font-medium mb-2">Active Filters:</div>
              <div className="flex flex-wrap gap-2">
                {filters.searchTerm && (
                  <Badge variant="secondary">
                    Search: "{filters.searchTerm}"
                  </Badge>
                )}
                {filters.categories.map((cat) => (
                  <Badge key={cat} variant="secondary">
                    {cat}
                  </Badge>
                ))}
                {filters.levels.map((level) => (
                  <Badge key={level} variant="secondary">
                    {level}
                  </Badge>
                ))}
                {(filters.priceRange[0] > 0 || filters.priceRange[1] < 500) && (
                  <Badge variant="secondary">
                    ${filters.priceRange[0]} - ${filters.priceRange[1]}
                  </Badge>
                )}
                {filters.rating > 0 && (
                  <Badge variant="secondary">{filters.rating}+ Stars</Badge>
                )}
                {filters.duration > 0 && (
                  <Badge variant="secondary">Max {filters.duration}h</Badge>
                )}
                {filters.hasSubtitle && (
                  <Badge variant="secondary">Subtitles</Badge>
                )}
                {filters.hasCertificate && (
                  <Badge variant="secondary">Certificate</Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}