'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Clock, CheckCircle, XCircle, ArrowLeft, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Quiz = Database['public']['Tables']['quizzes']['Row']
type QuizQuestion = Database['public']['Tables']['quiz_questions']['Row']
type QuizAttempt = Database['public']['Tables']['quiz_attempts']['Row']

interface QuizPlayerProps {
  quizId: string
  lessonId: string
  courseId: string
  quizData?: Quiz
  questionsData?: QuizQuestion[]
  onComplete?: (attempt: QuizAttempt) => void
  onClose?: () => void
}

export function QuizPlayer({ quizId, lessonId, courseId, quizData, questionsData, onComplete, onClose }: QuizPlayerProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [showResults, setShowResults] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (quizData && questionsData) {
      // Use provided data instead of fetching
      setQuiz(quizData)
      setQuestions(questionsData)
      setTimeRemaining(quizData.time_limit_minutes * 60 || 0)
      setLoading(false)
    } else {
      // Fallback to fetching if no data provided
      fetchQuizData()
    }
  }, [quizId, quizData, questionsData])

  useEffect(() => {
    if (quiz?.time_limit_minutes && timeRemaining > 0 && !submitted) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [quiz, timeRemaining, submitted])

  const fetchQuizData = async () => {
    try {
      setLoading(true)

      // Fetch quiz details
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single()

      if (!quizData) return

      setQuiz(quizData)
      setTimeRemaining(quizData.time_limit_minutes * 60 || 0)

      // Fetch questions
      const { data: questionsData } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true })

      if (questionsData) {
        setQuestions(questionsData)
      }
    } catch (error) {
      console.error('Error fetching quiz:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
    } else {
      setShowResults(true)
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (submitting || submitted) return

    try {
      setSubmitting(true)

      // Calculate score
      let correctCount = 0
      const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0)
      let earnedPoints = 0

      questions.forEach(question => {
        const userAnswer = answers[question.id]
        let isCorrect = false

        if (question.question_type === 'multiple_choice') {
          const options = JSON.parse(question.options || '[]')
          const correctOptions = options.filter((opt: any) => opt.is_correct)

          if (Array.isArray(userAnswer)) {
            // Multiple correct answers
            const userCorrectOptions = userAnswer.filter((ans: string) =>
              correctOptions.some((opt: any) => opt.text === ans)
            )
            isCorrect = userCorrectOptions.length === correctOptions.length &&
                        userAnswer.length === correctOptions.length
          } else {
            // Single correct answer
            isCorrect = correctOptions.some((opt: any) => opt.text === userAnswer)
          }
        } else if (question.question_type === 'true_false') {
          isCorrect = userAnswer === question.correct_answer
        }

        if (isCorrect) {
          correctCount++
          earnedPoints += question.points || 1
        }
      })

      const score = Math.round((earnedPoints / totalPoints) * 100)
      const passed = score >= (quiz?.passing_score || 70)

      // Create quiz attempt
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const { data: attemptData } = await supabase
        .from('quiz_attempts')
        .insert({
          user_id: user.id,
          quiz_id: quizId,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          score,
          passed,
          time_spent_seconds: (quiz?.time_limit_minutes * 60 || 0) - timeRemaining,
          answers,
          feedback: {
            correctCount,
            totalQuestions: questions.length,
            earnedPoints,
            totalPoints
          }
        })
        .select()
        .single()

      if (attemptData) {
        setAttempt(attemptData)
        setSubmitted(true)
        onComplete?.(attemptData)
      }
    } catch (error) {
      console.error('Error submitting quiz:', error)
      alert('Failed to submit quiz. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
        <span className="ml-3 text-muted-foreground">Loading quiz...</span>
      </div>
    )
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Quiz not found or has no questions.</p>
        {onClose && (
          <Button variant="outline" className="mt-4" onClick={onClose}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        )}
      </div>
    )
  }

  const currentQuestionData = questions[currentQuestion]
  const progress = ((currentQuestion + 1) / questions.length) * 100
  const isAnswered = answers[currentQuestionData.id] !== undefined

  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <Card className="glass-strong">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{quiz.title}</CardTitle>
              {quiz.description && (
                <CardDescription>{quiz.description}</CardDescription>
              )}
            </div>
            {quiz.time_limit_minutes && !submitted && (
              <Badge variant="outline" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {formatTime(timeRemaining)}
              </Badge>
            )}
          </div>
          <Progress value={progress} className="mt-4" />
          <p className="text-sm text-muted-foreground mt-2">
            Question {currentQuestion + 1} of {questions.length}
          </p>
        </CardHeader>
      </Card>

      {!showResults ? (
        <>
          {/* Question Card */}
          <Card className="glass">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-xl">
                  {currentQuestionData.question_text}
                </CardTitle>
                <Badge variant="secondary">
                  {currentQuestionData.points || 1} pt{currentQuestionData.points !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentQuestionData.question_type === 'multiple_choice' && (
                <MultipleChoiceQuestion
                  question={currentQuestionData}
                  value={answers[currentQuestionData.id]}
                  onChange={(value) => handleAnswer(currentQuestionData.id, value)}
                />
              )}

              {currentQuestionData.question_type === 'true_false' && (
                <TrueFalseQuestion
                  question={currentQuestionData}
                  value={answers[currentQuestionData.id]}
                  onChange={(value) => handleAnswer(currentQuestionData.id, value)}
                />
              )}

              {currentQuestionData.question_type === 'short_answer' && (
                <ShortAnswerQuestion
                  value={answers[currentQuestionData.id]}
                  onChange={(value) => handleAnswer(currentQuestionData.id, value)}
                />
              )}

              {currentQuestionData.question_type === 'essay' && (
                <EssayQuestion
                  value={answers[currentQuestionData.id]}
                  onChange={(value) => handleAnswer(currentQuestionData.id, value)}
                />
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentQuestion === 0}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                {currentQuestion === questions.length - 1 ? (
                  <Button
                    onClick={() => setShowResults(true)}
                    disabled={!isAnswered}
                    className="bg-bhutan-yellow hover:bg-bhutan-orange"
                  >
                    Review Answers
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={!isAnswered}
                    className="bg-bhutan-yellow hover:bg-bhutan-orange"
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <QuizResults
          questions={questions}
          answers={answers}
          attempt={attempt}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitted={submitted}
          onClose={onClose}
        />
      )}
    </div>
  )
}

// Question Components
function MultipleChoiceQuestion({ question, value, onChange }: any) {
  let options = JSON.parse(question.options || '[]')

  // Convert string arrays to object format
  options = options.map((opt: any) => {
    if (typeof opt === 'string') {
      return { text: opt, is_correct: opt === question.correct_answer }
    }
    return opt
  })

  const isMultiple = options.filter((opt: any) => opt.is_correct).length > 1

  if (isMultiple) {
    return (
      <div className="space-y-3">
        <Label className="text-sm text-muted-foreground">
          Select all that apply:
        </Label>
        {options.map((option: any, index: number) => (
          <div key={index} className="flex items-center space-x-2">
            <Checkbox
              id={`option-${index}`}
              checked={value?.includes(option.text)}
              onCheckedChange={(checked) => {
                const currentValues = value || []
                if (checked) {
                  onChange([...currentValues, option.text])
                } else {
                  onChange(currentValues.filter((v: string) => v !== option.text))
                }
              }}
            />
            <Label htmlFor={`option-${index}`} className="cursor-pointer">
              {option.text}
            </Label>
          </div>
        ))}
      </div>
    )
  }

  return (
    <RadioGroup value={value} onValueChange={onChange}>
      {options.map((option: any, index: number) => (
        <div key={index} className="flex items-center space-x-2">
          <RadioGroupItem value={option.text} id={`option-${index}`} />
          <Label htmlFor={`option-${index}`} className="cursor-pointer">
            {option.text}
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}

function TrueFalseQuestion({ question, value, onChange }: any) {
  return (
    <RadioGroup value={value} onValueChange={onChange}>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="true" id="true" />
        <Label htmlFor="true" className="cursor-pointer">True</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="false" id="false" />
        <Label htmlFor="false" className="cursor-pointer">False</Label>
      </div>
    </RadioGroup>
  )
}

function ShortAnswerQuestion({ value, onChange }: any) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter your answer..."
      rows={3}
      className="resize-none"
    />
  )
}

function EssayQuestion({ value, onChange }: any) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Write your essay response..."
      rows={8}
      className="resize-none"
    />
  )
}

// Results Component
function QuizResults({ questions, answers, attempt, onSubmit, submitting, submitted, onClose }: any) {
  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === questions.length

  return (
    <Card className="glass-strong">
      <CardHeader>
        <CardTitle>Ready to Submit?</CardTitle>
        <CardDescription>
          You've answered {answeredCount} out of {questions.length} questions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!submitted ? (
          <>
            <div className="space-y-3">
              <h3 className="font-semibold">Answer Summary:</h3>
              {questions.map((question: any, index: number) => {
                const isAnswered = answers[question.id] !== undefined
                return (
                  <div key={question.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                    <span className="text-sm">
                      Question {index + 1}: {question.question_text.slice(0, 50)}...
                    </span>
                    {isAnswered ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={onSubmit}
                disabled={!allAnswered || submitting}
                className="flex-1 bg-bhutan-yellow hover:bg-bhutan-orange"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Quiz'
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center space-y-4">
            {attempt?.passed ? (
              <CheckCircle className="w-16 h-16 mx-auto text-green-600" />
            ) : (
              <XCircle className="w-16 h-16 mx-auto text-red-600" />
            )}
            <div>
              <h3 className="text-2xl font-bold">
                {attempt?.passed ? 'Congratulations!' : 'Keep Learning!'}
              </h3>
              <p className="text-muted-foreground mt-2">
                You scored {attempt?.score}% and {attempt?.passed ? 'passed' : 'did not pass'} the quiz.
              </p>
            </div>
            {onClose && (
              <Button onClick={onClose} className="bg-bhutan-yellow hover:bg-bhutan-orange">
                Continue Learning
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}