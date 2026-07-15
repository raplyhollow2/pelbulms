'use client'

import { useState, useEffect } from 'react'
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
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  FileText,
  Code,
  Image as ImageIcon,
  Video,
  Upload,
  BarChart3,
  Target,
  TrendingUp,
  Award,
  RotateCw,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  Save
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface Question {
  id: string
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'coding' | 'fill_blank'
  question: string
  options?: string[]
  correctAnswer: string | string[]
  points: number
  difficulty: 'easy' | 'medium' | 'hard'
  explanation?: string
  media?: {
    type: 'image' | 'video'
    url: string
  }
}

interface Quiz {
  id: string
  title: string
  description: string
  questions: Question[]
  time_limit?: number // minutes
  passing_score: number
  max_attempts: number
  shuffle_questions: boolean
  show_results: 'immediate' | 'after_review' | 'after_deadline'
  created_by: string
}

interface QuizAttempt {
  id: string
  quiz_id: string
  user_id: string
  answers: Record<string, string>
  score: number
  passed: boolean
  time_spent: number
  started_at: string
  completed_at?: string
  attempt_number: number
}

interface QuizAnalytics {
  total_attempts: number
  average_score: number
  pass_rate: number
  average_time: number
  question_accuracy: Record<string, number>
  difficulty_distribution: Record<string, number>
  plagiarism_flags: number
}

export function QuizSystem() {
  const [activeTab, setActiveTab] = useState<'take' | 'create' | 'results' | 'analytics'>('take')
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [quizState, setQuizState] = useState<'not_started' | 'in_progress' | 'completed'>('not_started')
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const [analytics, setAnalytics] = useState<QuizAnalytics | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newQuiz, setNewQuiz] = useState<Partial<Quiz>>({
    questions: [],
    passing_score: 70,
    max_attempts: 3,
    shuffle_questions: false,
    show_results: 'immediate'
  })

  // Mock quiz data
  const mockQuiz: Quiz = {
    id: 'quiz-1',
    title: 'Web Development Fundamentals',
    description: 'Test your knowledge of HTML, CSS, and JavaScript basics',
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        question: 'What does HTML stand for?',
        options: [
          'Hyper Text Markup Language',
          'High Tech Modern Language',
          'Home Tool Markup Language',
          'Hyperlinks Text Mark Language'
        ],
        correctAnswer: 'Hyper Text Markup Language',
        points: 5,
        difficulty: 'easy',
        explanation: 'HTML is the standard markup language for creating web pages.'
      },
      {
        id: 'q2',
        type: 'true_false',
        question: 'CSS is used to add interactivity to web pages.',
        correctAnswer: 'false',
        points: 3,
        difficulty: 'easy',
        explanation: 'JavaScript is used for interactivity, CSS for styling.'
      },
      {
        id: 'q3',
        type: 'short_answer',
        question: 'What is the correct syntax for referring to an external script called "app.js"?',
        correctAnswer: '<script src="app.js"></script>',
        points: 10,
        difficulty: 'medium',
        explanation: 'The src attribute specifies the URL of the external script file.'
      },
      {
        id: 'q4',
        type: 'coding',
        question: 'Write a JavaScript function that returns the sum of two numbers.',
        correctAnswer: 'function sum(a, b) { return a + b; }',
        points: 15,
        difficulty: 'medium',
        explanation: 'A basic function that takes two parameters and returns their sum.'
      },
      {
        id: 'q5',
        type: 'fill_blank',
        question: 'The CSS property used to change text color is ______.',
        correctAnswer: 'color',
        points: 5,
        difficulty: 'easy',
        explanation: 'The color property sets the foreground color of an element.'
      },
      {
        id: 'q6',
        type: 'essay',
        question: 'Explain the difference between let, const, and var in JavaScript.',
        correctAnswer: 'let is block-scoped and can be reassigned, const is block-scoped and cannot be reassigned, var is function-scoped and can be reassigned.',
        points: 20,
        difficulty: 'hard',
        explanation: 'Understanding scope and mutability is crucial for modern JavaScript development.'
      }
    ],
    time_limit: 30,
    passing_score: 70,
    max_attempts: 3,
    shuffle_questions: false,
    show_results: 'immediate',
    created_by: 'instructor-1'
  }

  useEffect(() => {
    setQuizzes([mockQuiz])
  }, [])

  // Timer for quiz taking
  useEffect(() => {
    if (quizState === 'in_progress' && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            submitQuiz()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [quizState, timeRemaining])

  const startQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz)
    setQuizState('in_progress')
    setCurrentQuestion(0)
    setUserAnswers({})
    setTimeRemaining(quiz.time_limit || 0)
    setShowResults(false)
  }

  const handleAnswer = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const submitQuiz = async () => {
    if (!selectedQuiz) return

    let correctCount = 0
    let totalPoints = 0

    selectedQuiz.questions.forEach(question => {
      totalPoints += question.points
      const userAnswer = userAnswers[question.id]

      let isCorrect = false
      if (Array.isArray(question.correctAnswer)) {
        isCorrect = question.correctAnswer.includes(userAnswer)
      } else {
        isCorrect = userAnswer === question.correctAnswer
      }

      if (isCorrect) {
        correctCount += question.points
      }
    })

    const score = Math.round((correctCount / totalPoints) * 100)
    const passed = score >= selectedQuiz.passing_score

    setQuizState('completed')
    setShowResults(true)

    // Save attempt to database
    const attempt: QuizAttempt = {
      id: crypto.randomUUID(),
      quiz_id: selectedQuiz.id,
      user_id: 'current-user',
      answers: userAnswers,
      score,
      passed,
      time_spent: (selectedQuiz.time_limit || 0) - timeRemaining,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      attempt_number: 1
    }

    console.log('Quiz attempt saved:', attempt)
  }

  const calculateGrade = (score: number) => {
    if (score >= 90) return { grade: 'A', color: 'bg-green-500' }
    if (score >= 80) return { grade: 'B', color: 'bg-blue-500' }
    if (score >= 70) return { grade: 'C', color: 'bg-yellow-500' }
    if (score >= 60) return { grade: 'D', color: 'bg-orange-500' }
    return { grade: 'F', color: 'bg-red-500' }
  }

  const createQuestion = (): Question => ({
    id: crypto.randomUUID(),
    type: 'multiple_choice',
    question: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    points: 5,
    difficulty: 'medium'
  })

  const addQuestionToQuiz = () => {
    setNewQuiz(prev => ({
      ...prev,
      questions: [...(prev.questions || []), createQuestion()]
    }))
  }

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    setNewQuiz(prev => ({
      ...prev,
      questions: prev.questions?.map((q, i) =>
        i === index ? { ...q, ...updates } : q
      ) || []
    }))
  }

  const saveQuiz = async () => {
    const quizToSave: Quiz = {
      id: crypto.randomUUID(),
      title: newQuiz.title || 'New Quiz',
      description: newQuiz.description || '',
      questions: newQuiz.questions || [],
      time_limit: newQuiz.time_limit,
      passing_score: newQuiz.passing_score || 70,
      max_attempts: newQuiz.max_attempts || 3,
      shuffle_questions: newQuiz.shuffle_questions || false,
      show_results: newQuiz.show_results || 'immediate',
      created_by: 'current-user'
    }

    setQuizzes(prev => [...prev, quizToSave])
    setIsCreating(false)
    setActiveTab('take')
    setNewQuiz({
      questions: [],
      passing_score: 70,
      max_attempts: 3,
      shuffle_questions: false,
      show_results: 'immediate'
    })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (activeTab === 'analytics') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quiz Analytics</h2>
            <p className="text-gray-600 dark:text-gray-400">Performance insights and statistics</p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-gray-500">+12% from last week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">78%</div>
              <p className="text-xs text-green-500">+5% improvement</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">85%</div>
              <p className="text-xs text-gray-500">Above target</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18m 30s</div>
              <p className="text-xs text-gray-500">Within limits</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Question Analysis</CardTitle>
            <CardDescription>Breakdown by difficulty and performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Easy Questions</span>
                  <span className="text-sm font-medium">92% accuracy</span>
                </div>
                <Progress value={92} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Medium Questions</span>
                  <span className="text-sm font-medium">76% accuracy</span>
                </div>
                <Progress value={76} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Hard Questions</span>
                  <span className="text-sm font-medium">54% accuracy</span>
                </div>
                <Progress value={54} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            3 potential plagiarism cases detected for manual review.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quiz & Assessment System</h2>
          <p className="text-gray-600 dark:text-gray-400">Interactive quizzes with auto-grading</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="take">Take Quiz</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Take Quiz Tab */}
        <TabsContent value="take" className="space-y-4">
          {quizState === 'not_started' && (
            <div className="grid md:grid-cols-2 gap-4">
              {quizzes.map(quiz => (
                <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle>{quiz.title}</CardTitle>
                    <CardDescription>{quiz.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="outline">{quiz.questions.length} questions</Badge>
                      <Badge variant="outline">{quiz.time_limit} mins</Badge>
                      <Badge variant="outline">Passing: {quiz.passing_score}%</Badge>
                    </div>
                    <Button
                      onClick={() => startQuiz(quiz)}
                      className="w-full"
                      size="lg"
                    >
                      <Target className="w-4 h-4 mr-2" />
                      Start Quiz
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {quizState === 'in_progress' && selectedQuiz && (
            <div className="space-y-4">
              {/* Quiz header */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{selectedQuiz.title}</h3>
                      <p className="text-sm text-gray-500">
                        Question {currentQuestion + 1} of {selectedQuiz.questions.length}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={timeRemaining < 300 ? "destructive" : "outline"}>
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTime(timeRemaining)}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={((currentQuestion + 1) / selectedQuiz.questions.length) * 100} className="mt-3" />
                </CardContent>
              </Card>

              {/* Current question */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">
                      Question {currentQuestion + 1}
                    </CardTitle>
                    <Badge>{selectedQuiz.questions[currentQuestion].points} pts</Badge>
                  </div>
                  <CardDescription>
                    <Badge variant="outline">{selectedQuiz.questions[currentQuestion].difficulty}</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-lg">{selectedQuiz.questions[currentQuestion].question}</p>

                  {selectedQuiz.questions[currentQuestion].type === 'multiple_choice' && (
                    <div className="space-y-2">
                      {selectedQuiz.questions[currentQuestion].options?.map((option, index) => (
                        <div
                          key={index}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            userAnswers[selectedQuiz.questions[currentQuestion].id] === option
                              ? 'bg-primary/10 border-primary'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleAnswer(selectedQuiz.questions[currentQuestion].id, option)}
                        >
                          {option}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedQuiz.questions[currentQuestion].type === 'true_false' && (
                    <div className="flex gap-4">
                      <div
                        className={`flex-1 p-4 border rounded-lg cursor-pointer text-center transition-colors ${
                          userAnswers[selectedQuiz.questions[currentQuestion].id] === 'true'
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => handleAnswer(selectedQuiz.questions[currentQuestion].id, 'true')}
                      >
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-2" />
                        <span className="font-medium">True</span>
                      </div>
                      <div
                        className={`flex-1 p-4 border rounded-lg cursor-pointer text-center transition-colors ${
                          userAnswers[selectedQuiz.questions[currentQuestion].id] === 'false'
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => handleAnswer(selectedQuiz.questions[currentQuestion].id, 'false')}
                      >
                        <XCircle className="w-6 h-6 mx-auto mb-2" />
                        <span className="font-medium">False</span>
                      </div>
                    </div>
                  )}

                  {selectedQuiz.questions[currentQuestion].type === 'short_answer' && (
                    <Textarea
                      placeholder="Enter your answer..."
                      value={userAnswers[selectedQuiz.questions[currentQuestion].id] || ''}
                      onChange={(e) => handleAnswer(selectedQuiz.questions[currentQuestion].id, e.target.value)}
                      className="min-h-24"
                    />
                  )}

                  {selectedQuiz.questions[currentQuestion].type === 'coding' && (
                    <div className="space-y-2">
                      <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                        <pre>// Write your code here</pre>
                      </div>
                      <Textarea
                        placeholder="Write your code solution..."
                        value={userAnswers[selectedQuiz.questions[currentQuestion].id] || ''}
                        onChange={(e) => handleAnswer(selectedQuiz.questions[currentQuestion].id, e.target.value)}
                        className="min-h-32 font-mono"
                      />
                    </div>
                  )}

                  {selectedQuiz.questions[currentQuestion].type === 'essay' && (
                    <Textarea
                      placeholder="Write your essay answer..."
                      value={userAnswers[selectedQuiz.questions[currentQuestion].id] || ''}
                      onChange={(e) => handleAnswer(selectedQuiz.questions[currentQuestion].id, e.target.value)}
                      className="min-h-48"
                    />
                  )}

                  {selectedQuiz.questions[currentQuestion].type === 'fill_blank' && (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">The answer is:</span>
                      <Input
                        placeholder="Fill in the blank"
                        value={userAnswers[selectedQuiz.questions[currentQuestion].id] || ''}
                        onChange={(e) => handleAnswer(selectedQuiz.questions[currentQuestion].id, e.target.value)}
                        className="max-w-xs"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex justify-between">
                <Button
                  onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                  disabled={currentQuestion === 0}
                  variant="outline"
                  className="flex-1 mr-2"
                >
                  Previous
                </Button>
                {currentQuestion === selectedQuiz.questions.length - 1 ? (
                  <Button onClick={submitQuiz} className="flex-1 ml-2">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Submit Quiz
                  </Button>
                ) : (
                  <Button
                    onClick={() => setCurrentQuestion(Math.min(selectedQuiz.questions.length - 1, currentQuestion + 1))}
                    className="flex-1 ml-2"
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}

          {quizState === 'completed' && showResults && selectedQuiz && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Quiz Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Score display */}
                <div className="text-center space-y-2">
                  <div className="text-6xl font-bold">
                    {(() => {
                      const correctAnswers = selectedQuiz.questions.filter(q => {
                        const userAnswer = userAnswers[q.id]
                        const correct = Array.isArray(q.correctAnswer)
                          ? q.correctAnswer.includes(userAnswer)
                          : userAnswer === q.correctAnswer
                        return correct
                      }).length

                      const percentage = Math.round((correctAnswers / selectedQuiz.questions.length) * 100)
                      const { grade } = calculateGrade(percentage)
                      return percentage + '%'
                    })()}
                  </div>
                  <div className="flex justify-center gap-2">
                    {(() => {
                      const correctAnswers = selectedQuiz.questions.filter(q => {
                        const userAnswer = userAnswers[q.id]
                        const correct = Array.isArray(q.correctAnswer)
                          ? q.correctAnswer.includes(userAnswer)
                          : userAnswer === q.correctAnswer
                        return correct
                      }).length

                      const percentage = Math.round((correctAnswers / selectedQuiz.questions.length) * 100)
                      const { grade } = calculateGrade(percentage)
                      return <Badge className={calculateGrade(percentage).color}>{grade}</Badge>
                    })()}
                  </div>
                </div>

                {/* Question breakdown */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Question Breakdown</h3>
                  {selectedQuiz.questions.map((question, index) => {
                    const userAnswer = userAnswers[question.id]
                    const isCorrect = Array.isArray(question.correctAnswer)
                      ? question.correctAnswer.includes(userAnswer)
                      : userAnswer === question.correctAnswer

                    return (
                      <div key={question.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium">{question.question}</p>
                          {isCorrect ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div className="text-sm space-y-1">
                          <p><span className="font-medium">Your answer:</span> {userAnswer || 'Not answered'}</p>
                          {!isCorrect && (
                            <p><span className="font-medium">Correct answer:</span> {question.correctAnswer}</p>
                          )}
                          {question.explanation && (
                            <p className="text-gray-600 mt-2">
                              <Lightbulb className="w-4 h-4 inline mr-1" />
                              {question.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Button onClick={() => setQuizState('not_started')} className="w-full" size="lg">
                  <RotateCw className="w-4 h-4 mr-2" />
                  Back to Quizzes
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Create Quiz Tab */}
        <TabsContent value="create" className="space-y-4">
          {!isCreating ? (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">Create New Quiz</h3>
                <p className="text-gray-500 mb-4">Build a custom quiz with various question types</p>
                <Button onClick={() => setIsCreating(true)} size="lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Start Creating
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Create Quiz</CardTitle>
                <CardDescription>Build your quiz with multiple question types</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quiz Title</label>
                  <Input
                    placeholder="Enter quiz title"
                    value={newQuiz.title || ''}
                    onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Describe what this quiz covers"
                    value={newQuiz.description || ''}
                    onChange={(e) => setNewQuiz({ ...newQuiz, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Time Limit (mins)</label>
                    <Input
                      type="number"
                      placeholder="30"
                      value={newQuiz.time_limit || ''}
                      onChange={(e) => setNewQuiz({ ...newQuiz, time_limit: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Passing Score (%)</label>
                    <Input
                      type="number"
                      placeholder="70"
                      value={newQuiz.passing_score || ''}
                      onChange={(e) => setNewQuiz({ ...newQuiz, passing_score: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Attempts</label>
                    <Input
                      type="number"
                      placeholder="3"
                      value={newQuiz.max_attempts || ''}
                      onChange={(e) => setNewQuiz({ ...newQuiz, max_attempts: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Questions</h3>
                  <Button onClick={addQuestionToQuiz} size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Question
                  </Button>
                </div>

                <div className="space-y-4">
                  {newQuiz.questions?.map((question, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{index + 1}.</span>
                          <Select
                            value={question.type}
                            onValueChange={(value) => updateQuestion(index, { type: value as any })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                              <SelectItem value="true_false">True/False</SelectItem>
                              <SelectItem value="short_answer">Short Answer</SelectItem>
                              <SelectItem value="essay">Essay</SelectItem>
                              <SelectItem value="coding">Coding</SelectItem>
                              <SelectItem value="fill_blank">Fill in the Blank</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Textarea
                          placeholder="Question text"
                          value={question.question}
                          onChange={(e) => updateQuestion(index, { question: e.target.value })}
                        />

                        {question.type === 'multiple_choice' && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Options (one per line)</label>
                            <Textarea
                              placeholder="Option 1\nOption 2\nOption 3\nOption 4"
                              value={question.options?.join('\n') || ''}
                              onChange={(e) => updateQuestion(index, {
                                options: e.target.value.split('\n').filter(o => o.trim())
                              })}
                            />
                          </div>
                        )}

                        <Input
                          placeholder="Correct answer"
                          value={question.correctAnswer as string}
                          onChange={(e) => updateQuestion(index, { correctAnswer: e.target.value })}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">Points</label>
                            <Input
                              type="number"
                              value={question.points}
                              onChange={(e) => updateQuestion(index, { points: parseInt(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Difficulty</label>
                            <Select
                              value={question.difficulty}
                              onValueChange={(value) => updateQuestion(index, { difficulty: value as any })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="easy">Easy</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="hard">Hard</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setNewQuiz(prev => ({
                            ...prev,
                            questions: prev.questions?.filter((_, i) => i !== index) || []
                          }))}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove Question
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={saveQuiz}
                    disabled={!newQuiz.title || !newQuiz.questions?.length}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Quiz
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreating(false)
                      setNewQuiz({
                        questions: [],
                        passing_score: 70,
                        max_attempts: 3,
                        shuffle_questions: false,
                        show_results: 'immediate'
                      })
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Your Quiz Results</CardTitle>
              <CardDescription>View your past quiz attempts and scores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No completed quizzes yet</p>
                <p className="text-sm">Your results will appear here after you complete quizzes</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}