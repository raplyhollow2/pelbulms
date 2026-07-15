'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  BookOpen,
  Video,
  FileText,
  Code,
  Brain,
  TrendingUp,
  DollarSign,
  Zap,
  Target,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  BarChart3,
  Settings,
  Play,
  Pause,
  RotateCw,
  Download
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AIContentRequest {
  type: 'course' | 'lesson' | 'quiz' | 'assignment' | 'summary' | 'explanation'
  topic: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  targetAudience: string
  length: 'short' | 'medium' | 'long'
  includeExamples: boolean
  includeAssessment: boolean
}

interface AIGeneratedContent {
  id: string
  type: string
  title: string
  content: string
  metadata: {
    wordCount: number
    estimatedReadTime: number
    topics: string[]
    difficulty: string
  }
  generatedAt: string
}

interface AITutorMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  context?: {
    courseId?: string
    lessonId?: string
    topic?: string
  }
}

interface AIAnalytics {
  totalRequests: number
  averageResponseTime: number
  costSavings: number
  userSatisfaction: number
  popularTopics: string[]
  usageByType: Record<string, number>
}

export function AIContentHub() {
  const [activeTab, setActiveTab] = useState<'generate' | 'tutor' | 'analytics'>('generate')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<AIGeneratedContent | null>(null)
  const [contentRequest, setContentRequest] = useState<Partial<AIContentRequest>>({
    type: 'lesson',
    difficulty: 'intermediate',
    length: 'medium',
    includeExamples: true,
    includeAssessment: false
  })
  const [tutorMessages, setTutorMessages] = useState<AITutorMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [analytics, setAnalytics] = useState<AIAnalytics | null>(null)
  const [apiKeyConfigured, setApiKeyConfigured] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAnalytics()
    // Load previous tutor session if exists
    const savedMessages = localStorage.getItem('ai-tutor-messages')
    if (savedMessages) {
      setTutorMessages(JSON.parse(savedMessages))
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [tutorMessages])

  const fetchAnalytics = async () => {
    // Mock analytics data
    setAnalytics({
      totalRequests: 1234,
      averageResponseTime: 2.3,
      costSavings: 4500,
      userSatisfaction: 4.7,
      popularTopics: ['JavaScript', 'React', 'Python', 'Data Science', 'Web Development'],
      usageByType: {
        course: 234,
        lesson: 456,
        quiz: 123,
        assignment: 89,
        summary: 332
      }
    })
  }

  const generateContent = async () => {
    if (!contentRequest.topic) return

    setIsGenerating(true)

    try {
      // Simulate AI content generation
      await new Promise(resolve => setTimeout(resolve, 3000))

      const mockContent: AIGeneratedContent = {
        id: crypto.randomUUID(),
        type: contentRequest.type || 'lesson',
        title: `Understanding ${contentRequest.topic}`,
        content: generateMockContent(contentRequest),
        metadata: {
          wordCount: 850,
          estimatedReadTime: 5,
          topics: [contentRequest.topic, 'Fundamentals', 'Best Practices'],
          difficulty: contentRequest.difficulty || 'intermediate'
        },
        generatedAt: new Date().toISOString()
      }

      setGeneratedContent(mockContent)

      // Update analytics
      setAnalytics(prev => prev ? {
        ...prev,
        totalRequests: prev.totalRequests + 1
      } : null)

    } catch (error) {
      console.error('Content generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const generateMockContent = (request: Partial<AIContentRequest>): string => {
    const topic = request.topic || 'the subject'
    const difficulty = request.difficulty || 'intermediate'

    return `# Understanding ${topic}

## Introduction
${topic} is a fundamental concept in modern technology. This comprehensive guide will help you master the essential concepts and practical applications.

## Core Concepts

### 1. ${difficulty === 'beginner' ? 'Basic' : difficulty === 'intermediate' ? 'Intermediate' : 'Advanced'} Fundamentals
At its core, ${topic} involves understanding the key principles that govern its operation. Let's break down the most important aspects:

- **Key Principle 1**: Understanding the foundation
- **Key Principle 2**: Practical applications
- **Key Principle 3**: Advanced techniques

### 2. Practical Implementation
Here's how ${topic} works in practice:

\`\`\`javascript
// Example implementation
function exampleOf${topic.replace(/\s+/g, '')}() {
  // Core logic here
  return result;
}
\`\`\`

### 3. Best Practices
When working with ${topic}, consider these best practices:

1. Always follow established patterns
2. Test your implementations thoroughly
3. Document your code appropriately
4. Consider performance implications

## Common Challenges

### Challenge 1: Getting Started
Many learners find the initial setup challenging. Here's a step-by-step approach to overcome this:

1. **Setup**: Configure your environment properly
2. **Practice**: Start with simple examples
3. **Build**: Gradually increase complexity

### Challenge 2: Advanced Concepts
As you progress, you'll encounter more complex scenarios. The key is to:
- Break down problems into smaller parts
- Apply foundational concepts systematically
- Learn from community solutions

## Summary

${topic} is an essential skill that opens doors to countless opportunities. By mastering these fundamentals, you'll be well-equipped to tackle real-world challenges.

### Next Steps
- Practice with hands-on projects
- Explore advanced topics
- Join community discussions
- Stay updated with latest developments

${request.includeAssessment ? `
## Quick Assessment

1. What are the three key principles of ${topic}?
2. How would you implement ${topic} in a real project?
3. What are the common challenges when learning ${topic}?

` : ''}`

  }

  const sendTutorMessage = async () => {
    if (!currentMessage.trim()) return

    const userMessage: AITutorMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date().toISOString()
    }

    setTutorMessages(prev => [...prev, userMessage])
    setCurrentMessage('')
    setIsTyping(true)

    // Save to localStorage
    localStorage.setItem('ai-tutor-messages', JSON.stringify([...tutorMessages, userMessage]))

    try {
      // Simulate AI response
      await new Promise(resolve => setTimeout(resolve, 2000))

      const aiResponse: AITutorMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: generateTutorResponse(currentMessage),
        timestamp: new Date().toISOString()
      }

      setTutorMessages(prev => [...prev, aiResponse])
      localStorage.setItem('ai-tutor-messages', JSON.stringify([...tutorMessages, userMessage, aiResponse]))

      // Update analytics
      setAnalytics(prev => prev ? {
        ...prev,
        totalRequests: prev.totalRequests + 1
      } : null)

    } catch (error) {
      console.error('Tutor response failed:', error)
    } finally {
      setIsTyping(false)
    }
  }

  const generateTutorResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase()

    if (lowerMessage.includes('help') || lowerMessage.includes('explain')) {
      return `I'd be happy to help you understand this topic! Let me break it down step by step:

**Key Points:**
1. **Concept**: The fundamental idea behind this topic
2. **Application**: How it's used in practice
3. **Example**: Let me show you a concrete example

Would you like me to elaborate on any of these points or would you prefer a different explanation approach?`
    }

    if (lowerMessage.includes('example') || lowerMessage.includes('show')) {
      return `Here's a practical example:

\`\`\`javascript
// Practical implementation
function solveProblem() {
  // Step 1: Understand the problem
  // Step 2: Break it down
  // Step 3: Implement solution
  return result;
}
\`\`\`

This example demonstrates the core concept. Would you like me to explain how it works or show you variations?`
    }

    if (lowerMessage.includes('quiz') || lowerMessage.includes('test')) {
      return `Great idea! Let's test your understanding with a quick question:

**Question:** What is the main purpose of this concept we're discussing?

A) Option A
B) Option B
C) Option C
D) Option D

Take your time, and let me know your answer. I'll explain the reasoning behind the correct solution!`
    }

    return `That's a great question! Let me provide a comprehensive answer:

**Understanding the Concept:**
This topic relates to fundamental programming principles that are essential for building robust applications.

**Practical Application:**
In real-world scenarios, this concept helps you:
- Write cleaner code
- Solve problems more efficiently
- Build maintainable systems

**Further Learning:**
Would you like me to:
1. Show you a code example?
2. Explain a specific aspect in more detail?
3. Provide practice problems?
4. Connect this to other related topics?

Let me know what would be most helpful for your learning journey!`
  }

  const clearTutorChat = () => {
    setTutorMessages([])
    localStorage.removeItem('ai-tutor-messages')
  }

  const exportContent = (content: AIGeneratedContent) => {
    const blob = new Blob([content.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${content.title.replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!apiKeyConfigured) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Settings className="w-12 h-12 mx-auto mb-4 text-yellow-600" />
            <h3 className="text-lg font-semibold mb-2">AI Configuration Required</h3>
            <p className="text-gray-600 mb-4">Please configure your AI API credentials to enable these features.</p>
            <Button>Configure AI Settings</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI Content Hub</h2>
          <p className="text-gray-600 dark:text-gray-400">Generate content, get tutoring, and analyze learning patterns</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          AI Powered
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="tutor">
            <MessageSquare className="w-4 h-4 mr-2" />
            AI Tutor
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Generate Content Tab */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                AI Content Generation
              </CardTitle>
              <CardDescription>
                Generate lessons, quizzes, assignments, and other educational content with AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content Type</label>
                  <Select
                    value={contentRequest.type}
                    onValueChange={(value) => setContentRequest({ ...contentRequest, type: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Complete Course
                        </div>
                      </SelectItem>
                      <SelectItem value="lesson">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Single Lesson
                        </div>
                      </SelectItem>
                      <SelectItem value="quiz">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Quiz Questions
                        </div>
                      </SelectItem>
                      <SelectItem value="assignment">
                        <div className="flex items-center gap-2">
                          <Code className="w-4 h-4" />
                          Assignment
                        </div>
                      </SelectItem>
                      <SelectItem value="summary">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="w-4 h-4" />
                          Topic Summary
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty Level</label>
                  <Select
                    value={contentRequest.difficulty}
                    onValueChange={(value) => setContentRequest({ ...contentRequest, difficulty: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Topic/Subject</label>
                <Input
                  placeholder="e.g., React Hooks, Python Data Structures, Machine Learning Basics..."
                  value={contentRequest.topic || ''}
                  onChange={(e) => setContentRequest({ ...contentRequest, topic: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Audience</label>
                  <Input
                    placeholder="e.g., High school students, Working professionals..."
                    value={contentRequest.targetAudience || ''}
                    onChange={(e) => setContentRequest({ ...contentRequest, targetAudience: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content Length</label>
                  <Select
                    value={contentRequest.length}
                    onValueChange={(value) => setContentRequest({ ...contentRequest, length: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short (5-10 min read)</SelectItem>
                      <SelectItem value="medium">Medium (15-20 min read)</SelectItem>
                      <SelectItem value="long">Long (30+ min read)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeExamples"
                    checked={contentRequest.includeExamples}
                    onChange={(e) => setContentRequest({ ...contentRequest, includeExamples: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="includeExamples" className="text-sm">Include Examples</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeAssessment"
                    checked={contentRequest.includeAssessment}
                    onChange={(e) => setContentRequest({ ...contentRequest, includeAssessment: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="includeAssessment" className="text-sm">Include Assessment</label>
                </div>
              </div>

              <Button
                onClick={generateContent}
                disabled={!contentRequest.topic || isGenerating}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating Content...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Content
                  </>
                )}
              </Button>

              {generatedContent && (
                <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-900/20">
                  <CheckCircle2 className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-purple-800 dark:text-purple-300">
                    Content generated successfully! Review the generated content below.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {generatedContent && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{generatedContent.title}</CardTitle>
                    <CardDescription>
                      {generatedContent.metadata.wordCount} words • {generatedContent.metadata.estimatedReadTime} min read
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={() => exportContent(generatedContent)}>
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap">{generatedContent.content}</div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {generatedContent.metadata.topics.map(topic => (
                    <Badge key={topic} variant="secondary">{topic}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* AI Tutor Tab */}
        <TabsContent value="tutor" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600" />
                    AI Tutor
                  </CardTitle>
                  <CardDescription>
                    Get personalized help with your learning journey
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={clearTutorChat}>
                  Clear Chat
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Chat Messages */}
                <div className="h-96 overflow-y-auto space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {tutorMessages.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Start a conversation with your AI tutor!</p>
                      <p className="text-sm mt-1">Ask questions, get explanations, or request examples.</p>
                    </div>
                  )}

                  {tutorMessages.map(message => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-4 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-gray-700 border'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2">
                            <Brain className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium">AI Tutor</span>
                          </div>
                        )}
                        <div className="prose dark:prose-invert max-w-none text-sm">
                          {message.content}
                        </div>
                        <div className="text-xs mt-2 opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-gray-700 border p-4 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-blue-600 animate-pulse" />
                          <span className="text-sm">AI Tutor is typing...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask your AI tutor anything..."
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendTutorMessage()}
                    disabled={isTyping}
                  />
                  <Button
                    onClick={sendTutorMessage}
                    disabled={!currentMessage.trim() || isTyping}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentMessage('Explain this concept with examples')}
                  >
                    Explain with examples
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentMessage('Give me a practice problem')}
                  >
                    Practice problem
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentMessage('Test my understanding')}
                  >
                    Quiz me
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentMessage('Connect this to real-world applications')}
                  >
                    Real-world examples
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {analytics ? (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.totalRequests}</div>
                    <p className="text-xs text-gray-500 mt-1">All time usage</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.averageResponseTime}s</div>
                    <p className="text-xs text-green-500 mt-1">Fast responses</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${analytics.costSavings}</div>
                    <p className="text-xs text-gray-500 mt-1">Estimated savings</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">User Satisfaction</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.userSatisfaction}/5</div>
                    <p className="text-xs text-gray-500 mt-1">Average rating</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Usage by Type</CardTitle>
                  <CardDescription>Breakdown of AI feature usage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.usageByType).map(([type, count]) => {
                      const percentage = (count / analytics.totalRequests) * 100
                      return (
                        <div key={type}>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm capitalize">{type}</span>
                            <span className="text-sm text-gray-500">{count} ({percentage.toFixed(1)}%)</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Popular Topics</CardTitle>
                  <CardDescription>Most requested learning topics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analytics.popularTopics.map(topic => (
                      <Badge key={topic} variant="secondary" className="px-3 py-1">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No analytics data available</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}