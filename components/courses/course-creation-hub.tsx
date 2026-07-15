'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Wand2,
  FileText,
  Download,
  Plus,
  BookOpen,
  Video,
  Code,
  Image,
  Upload,
  Loader2,
  CheckCircle2,
  Sparkles,
  Globe,
  FileJson,
  Video as Youtube, // Using Video icon instead of non-existent Youtube
  GitBranch
} from 'lucide-react'

interface CourseModule {
  id: string
  title: string
  description: string
  content_type: 'video' | 'text' | 'quiz' | 'assignment' | 'interactive'
  duration?: number
  order: number
}

interface Course {
  id: string
  title: string
  description: string
  category: string
  level: 'beginner' | 'intermediate' | 'advanced'
  price: number
  thumbnail_url?: string
  modules: CourseModule[]
  estimated_duration: number
}

interface CourseTemplate {
  id: string
  name: string
  description: string
  category: string
  modules: Omit<CourseModule, 'id'>[]
  estimated_duration: number
}

export function CourseCreationHub() {
  const [activeTab, setActiveTab] = useState('ai')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCourse, setGeneratedCourse] = useState<Partial<Course>>({})
  const [selectedTemplate, setSelectedTemplate] = useState<CourseTemplate | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importSource, setImportSource] = useState<'youtube' | 'udemy' | 'coursera' | 'other'>('youtube')
  const [manualCourse, setManualCourse] = useState<Partial<Course>>({
    modules: []
  })

  // AI Generation
  const handleAIGeneration = async (prompt: string) => {
    setIsGenerating(true)
    try {
      // Simulate AI generation
      await new Promise(resolve => setTimeout(resolve, 2000))

      const aiCourse: Partial<Course> = {
        title: 'AI Generated: Introduction to Machine Learning',
        description: 'A comprehensive course covering the fundamentals of machine learning, including supervised learning, unsupervised learning, and neural networks.',
        category: 'Technology',
        level: 'beginner',
        price: 49.99,
        estimated_duration: 120,
        modules: [
          {
            id: '1',
            title: 'Introduction to ML',
            description: 'Overview of machine learning concepts and applications',
            content_type: 'video',
            duration: 45,
            order: 1
          },
          {
            id: '2',
            title: 'Supervised Learning',
            description: 'Deep dive into classification and regression algorithms',
            content_type: 'video',
            duration: 60,
            order: 2
          },
          {
            id: '3',
            title: 'Unsupervised Learning',
            description: 'Clustering and dimensionality reduction techniques',
            content_type: 'video',
            duration: 50,
            order: 3
          },
          {
            id: '4',
            title: 'Neural Networks Basics',
            description: 'Introduction to neural networks and deep learning',
            content_type: 'interactive',
            duration: 90,
            order: 4
          },
          {
            id: '5',
            title: 'ML Assessment',
            description: 'Test your knowledge with comprehensive quizzes',
            content_type: 'quiz',
            duration: 30,
            order: 5
          }
        ]
      }

      setGeneratedCourse(aiCourse)
    } catch (error) {
      console.error('AI generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  // Template-based Creation
  const courseTemplates: CourseTemplate[] = [
    {
      id: 'tech-1',
      name: 'Web Development Bootcamp',
      description: 'Complete web development course template',
      category: 'Technology',
      modules: [
        { title: 'HTML & CSS Basics', description: 'Learn the fundamentals', content_type: 'video', duration: 60, order: 1 },
        { title: 'JavaScript Fundamentals', description: 'Core JS concepts', content_type: 'video', duration: 90, order: 2 },
        { title: 'React Framework', description: 'Build modern UIs', content_type: 'video', duration: 120, order: 3 },
        { title: 'Backend Development', description: 'Server-side programming', content_type: 'video', duration: 90, order: 4 },
        { title: 'Final Project', description: 'Build a complete application', content_type: 'assignment', duration: 180, order: 5 }
      ],
      estimated_duration: 180
    },
    {
      id: 'business-1',
      name: 'Digital Marketing Course',
      description: 'Comprehensive digital marketing template',
      category: 'Business',
      modules: [
        { title: 'Marketing Fundamentals', description: 'Core concepts', content_type: 'text', duration: 30, order: 1 },
        { title: 'Social Media Strategy', description: 'Platform-specific strategies', content_type: 'video', duration: 45, order: 2 },
        { title: 'SEO & Content Marketing', description: 'Organic growth tactics', content_type: 'video', duration: 60, order: 3 },
        { title: 'Paid Advertising', description: 'PPC and social ads', content_type: 'interactive', duration: 90, order: 4 },
        { title: 'Analytics & Optimization', description: 'Data-driven decisions', content_type: 'quiz', duration: 30, order: 5 }
      ],
      estimated_duration: 120
    },
    {
      id: 'design-1',
      name: 'UI/UX Design Course',
      description: 'Complete design thinking template',
      category: 'Design',
      modules: [
        { title: 'Design Principles', description: 'Fundamental concepts', content_type: 'video', duration: 45, order: 1 },
        { title: 'User Research', description: 'Understanding users', content_type: 'interactive', duration: 60, order: 2 },
        { title: 'Wireframing', description: 'Creating wireframes', content_type: 'video', duration: 50, order: 3 },
        { title: 'Prototyping', description: 'Interactive prototypes', content_type: 'assignment', duration: 120, order: 4 },
        { title: 'Design Portfolio', description: 'Build your portfolio', content_type: 'assignment', duration: 180, order: 5 }
      ],
      estimated_duration: 150
    }
  ]

  const handleTemplateSelect = (template: CourseTemplate) => {
    setSelectedTemplate(template)
    setManualCourse({
      title: template.name,
      description: template.description,
      category: template.category,
      level: 'beginner',
      price: 0,
      modules: template.modules.map((module, index) => ({
        ...module,
        id: crypto.randomUUID()
      })),
      estimated_duration: template.estimated_duration
    })
  }

  // Import from External Sources
  const handleImport = async () => {
    if (!importUrl) return

    setIsGenerating(true)
    try {
      // Simulate import process
      await new Promise(resolve => setTimeout(resolve, 1500))

      const importedCourse: Partial<Course> = {
        title: 'Imported Course',
        description: 'Course imported from external source',
        category: 'Technology',
        level: 'intermediate',
        price: 0,
        estimated_duration: 60,
        modules: [
          {
            id: '1',
            title: 'Imported Module 1',
            description: 'Content imported from external source',
            content_type: 'video',
            duration: 30,
            order: 1
          }
        ]
      }

      setGeneratedCourse(importedCourse)
      setImportUrl('')
    } catch (error) {
      console.error('Import failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  // Manual Course Builder
  const addModule = () => {
    const newModule: CourseModule = {
      id: crypto.randomUUID(),
      title: 'New Module',
      description: 'Module description',
      content_type: 'video',
      duration: 30,
      order: (manualCourse.modules?.length || 0) + 1
    }

    setManualCourse(prev => ({
      ...prev,
      modules: [...(prev.modules || []), newModule]
    }))
  }

  const updateModule = (moduleId: string, updates: Partial<CourseModule>) => {
    setManualCourse(prev => ({
      ...prev,
      modules: prev.modules?.map(module =>
        module.id === moduleId ? { ...module, ...updates } : module
      ) || []
    }))
  }

  const removeModule = (moduleId: string) => {
    setManualCourse(prev => ({
      ...prev,
      modules: prev.modules?.filter(module => module.id !== moduleId) || []
    }))
  }

  const saveCourse = async (courseData: Partial<Course>) => {
    try {
      // Save to Supabase
      console.log('Saving course:', courseData)
      // Implement actual save logic
    } catch (error) {
      console.error('Save failed:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Course Creation Hub</h2>
        <p className="text-gray-600 dark:text-gray-400">Choose your preferred course creation method</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai">
            <Wand2 className="w-4 h-4 mr-2" />
            AI Generate
          </TabsTrigger>
          <TabsTrigger value="template">
            <FileText className="w-4 h-4 mr-2" />
            Template
          </TabsTrigger>
          <TabsTrigger value="import">
            <Download className="w-4 h-4 mr-2" />
            Import
          </TabsTrigger>
          <TabsTrigger value="manual">
            <Plus className="w-4 h-4 mr-2" />
            Manual
          </TabsTrigger>
        </TabsList>

        {/* AI Generation Tab */}
        <TabsContent value="ai" className="space-y-4">
          <Card className="border-2 border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                AI-Powered Course Generation
              </CardTitle>
              <CardDescription>
                Describe your course idea and let AI create a comprehensive curriculum
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Course Description</label>
                <Textarea
                  placeholder="Describe your course idea, target audience, learning objectives, and any specific topics you want to cover..."
                  className="min-h-32"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Audience</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginners</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="all">All Levels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Course Category</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tech">Technology</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={() => handleAIGeneration('test')}
                disabled={isGenerating}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Course...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate Course
                  </>
                )}
              </Button>

              {generatedCourse.title && (
                <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-900/20">
                  <CheckCircle2 className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-purple-800 dark:text-purple-300">
                    Course generated successfully! Review the content below.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {generatedCourse.title && (
            <Card>
              <CardHeader>
                <CardTitle>{generatedCourse.title}</CardTitle>
                <CardDescription>{generatedCourse.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Badge>{generatedCourse.category}</Badge>
                  <Badge variant="secondary">{generatedCourse.level}</Badge>
                  <Badge variant="outline">{generatedCourse.estimated_duration} mins</Badge>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Generated Modules:</h4>
                  {generatedCourse.modules?.map((module, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <span className="font-medium">{index + 1}.</span>
                      <span>{module.title}</span>
                      <Badge variant="outline" className="ml-auto">{module.content_type}</Badge>
                      <span className="text-sm text-gray-500">{module.duration}m</span>
                    </div>
                  ))}
                </div>
                <Button className="w-full mt-4" onClick={() => saveCourse(generatedCourse)}>
                  Save Generated Course
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Template Tab */}
        <TabsContent value="template" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Course Templates</CardTitle>
              <CardDescription>
                Start with a proven course structure and customize it
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                {courseTemplates.map(template => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Badge>{template.category}</Badge>
                          <Badge variant="outline">{template.modules.length} modules</Badge>
                          <Badge variant="secondary">{template.estimated_duration} mins</Badge>
                        </div>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-1" />
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Customize Template</CardTitle>
                <CardDescription>Edit the template details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Course Title</label>
                  <Input
                    value={manualCourse.title || ''}
                    onChange={(e) => setManualCourse(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={manualCourse.description || ''}
                    onChange={(e) => setManualCourse(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <Button className="w-full" onClick={() => saveCourse(manualCourse)}>
                  Save Course from Template
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Import Course
              </CardTitle>
              <CardDescription>
                Import content from YouTube playlists, Udemy, Coursera, or other platforms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Source Platform</label>
                <Select value={importSource} onValueChange={(value) => setImportSource(value as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">
                      <div className="flex items-center gap-2">
                        <Youtube className="w-4 h-4" />
                        YouTube Playlist
                      </div>
                    </SelectItem>
                    <SelectItem value="udemy">Udemy Course</SelectItem>
                    <SelectItem value="coursera">Coursera Course</SelectItem>
                    <SelectItem value="other">Other Platform</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Course URL</label>
                <Input
                  placeholder="Paste the course or playlist URL here..."
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Tip:</strong> For best results, use public course URLs. The system will automatically
                  extract videos, descriptions, and structure them into modules.
                </p>
              </div>

              <Button
                onClick={handleImport}
                disabled={!importUrl || isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Import Course
                  </>
                )}
              </Button>

              {generatedCourse.title && activeTab === 'import' && (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-300">
                    Course imported successfully! You can now customize it.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Builder Tab */}
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Manual Course Builder
              </CardTitle>
              <CardDescription>
                Build your course from scratch with full control
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Course Title</label>
                <Input
                  placeholder="Enter course title"
                  value={manualCourse.title || ''}
                  onChange={(e) => setManualCourse(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Describe what students will learn"
                  value={manualCourse.description || ''}
                  onChange={(e) => setManualCourse(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={manualCourse.category || ''}
                    onValueChange={(value) => setManualCourse(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Level</label>
                  <Select
                    value={manualCourse.level || ''}
                    onValueChange={(value) => setManualCourse(prev => ({ ...prev, level: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price ($)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={manualCourse.price || ''}
                    onChange={(e) => setManualCourse(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Course Modules</h3>
                <Button onClick={addModule} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Module
                </Button>
              </div>

              <div className="space-y-3">
                {manualCourse.modules?.map((module, index) => (
                  <Card key={module.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-lg">{index + 1}.</span>
                        <Input
                          value={module.title}
                          onChange={(e) => updateModule(module.id, { title: e.target.value })}
                          placeholder="Module title"
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeModule(module.id)}
                        >
                          Remove
                        </Button>
                      </div>
                      <Textarea
                        value={module.description}
                        onChange={(e) => updateModule(module.id, { description: e.target.value })}
                        placeholder="Module description"
                        rows={2}
                      />
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Content Type</label>
                          <Select
                            value={module.content_type}
                            onValueChange={(value) => updateModule(module.id, { content_type: value as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="video">
                                <div className="flex items-center gap-2">
                                  <Video className="w-4 h-4" />
                                  Video
                                </div>
                              </SelectItem>
                              <SelectItem value="text">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Text
                                </div>
                              </SelectItem>
                              <SelectItem value="quiz">
                                <div className="flex items-center gap-2">
                                  <Code className="w-4 h-4" />
                                  Quiz
                                </div>
                              </SelectItem>
                              <SelectItem value="assignment">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-4 h-4" />
                                  Assignment
                                </div>
                              </SelectItem>
                              <SelectItem value="interactive">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-4 h-4" />
                                  Interactive
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32">
                          <label className="text-xs text-gray-500">Duration (min)</label>
                          <Input
                            type="number"
                            value={module.duration}
                            onChange={(e) => updateModule(module.id, { duration: parseInt(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {manualCourse.modules && manualCourse.modules.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Total Modules: {manualCourse.modules.length}</span>
                    <span>
                      Total Duration: {manualCourse.modules.reduce((acc, m) => acc + m.duration, 0)} mins
                    </span>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={() => saveCourse(manualCourse)}
                disabled={!manualCourse.title || !manualCourse.modules?.length}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Save Complete Course
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}