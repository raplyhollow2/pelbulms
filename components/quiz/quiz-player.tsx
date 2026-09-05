'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Clock, CheckCircle, XCircle, ArrowLeft, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Quiz = Database['public']['Tables']['quizzes']['Row']
type QuizQuestion = Database['public']['Tables']['quiz_questions']['Row'] & {
  incorrect_explanation?: string | null
}
type QuizAttempt = Database['public']['Tables']['quiz_attempts']['Row']

export type QuizOutcome = {
  attempt: QuizAttempt
  passed: boolean
  attemptsUsed: number
  maxAttempts: number
  attemptsExhausted: boolean
}

interface QuizPlayerProps {
  quizId: string
  lessonId: string
  courseId: string
  quizData?: Quiz
  questionsData?: QuizQuestion[]
  onComplete?: (outcome: QuizOutcome) => void
  onClose?: () => void
  /** Called when learner must redo the lesson after failing all attempts */
  onRedoLesson?: () => void
}

function parseOptions(raw: unknown): Array<{ text: string; is_correct?: boolean }> {
  if (Array.isArray(raw)) return raw as any
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function isAnswerCorrect(question: QuizQuestion, userAnswer: any): boolean {
  if (question.question_type === 'multiple_choice') {
    const options = parseOptions(question.options).map((opt: any) =>
      typeof opt === 'string'
        ? { text: opt, is_correct: opt === question.correct_answer }
        : opt
    )
    const correctOptions = options.filter((opt: any) => opt.is_correct)
    if (Array.isArray(userAnswer)) {
      const userCorrect = userAnswer.filter((ans: string) =>
        correctOptions.some((opt: any) => opt.text === ans)
      )
      return (
        userCorrect.length === correctOptions.length &&
        userAnswer.length === correctOptions.length
      )
    }
    return correctOptions.some((opt: any) => opt.text === userAnswer)
  }
  if (question.question_type === 'true_false') {
    return String(userAnswer) === String(question.correct_answer)
  }
  // short_answer / essay: not auto-graded as wrong in the dialogue
  return true
}

export function QuizPlayer({
  quizId,
  lessonId: _lessonId,
  courseId: _courseId,
  quizData,
  questionsData,
  onComplete,
  onClose,
  onRedoLesson,
}: QuizPlayerProps) {
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
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [attemptsExhausted, setAttemptsExhausted] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedback, setFeedback] = useState<{
    correct: boolean
    title: string
    message: string
  } | null>(null)
  const [outcomeOpen, setOutcomeOpen] = useState(false)
  const [lastOutcome, setLastOutcome] = useState<QuizOutcome | null>(null)

  const supabase = createClient()

  const maxAttempts = Math.max(1, Number((quiz as any)?.max_attempts) || 3)

  const loadAttempts = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 0
    const { count } = await (supabase as any)
      .from('quiz_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('quiz_id', quizId)
    const used = count || 0
    setAttemptsUsed(used)
    return used
  }, [quizId, supabase])

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true)
        let loadedQuiz: any = quizData
        let loadedQuestions: any[] = questionsData || []
        if (quizData && questionsData) {
          setQuiz(quizData)
          setQuestions(questionsData)
          setTimeRemaining(((quizData as any).time_limit_minutes || 0) * 60)
        } else {
          const { data: q } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
          if (!q) return
          loadedQuiz = q
          setQuiz(q)
          setTimeRemaining(((q as any).time_limit_minutes || 0) * 60)
          const { data: qs } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('quiz_id', quizId)
            .order('order_index', { ascending: true })
          loadedQuestions = (qs as any) || []
          setQuestions(loadedQuestions)
        }
        const used = await loadAttempts()
        const max = Math.max(1, Number(loadedQuiz?.max_attempts) || 3)
        if (used >= max) {
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (user) {
            const { data: passRow } = await (supabase as any)
              .from('quiz_attempts')
              .select('id')
              .eq('quiz_id', quizId)
              .eq('user_id', user.id)
              .eq('passed', true)
              .limit(1)
              .maybeSingle()
            if (!passRow) setAttemptsExhausted(true)
          }
        }
      } catch (e) {
        console.error('Error loading quiz:', e)
      } finally {
        setLoading(false)
      }
    }
    void boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, quizData, questionsData])

  useEffect(() => {
    if (!quiz || !(quiz as any).time_limit_minutes || timeRemaining <= 0 || submitted || showResults) {
      return
    }
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          void handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz, timeRemaining, submitted, showResults])

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const advanceOrReview = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1)
    } else {
      setShowResults(true)
    }
  }

  const checkCurrentAndContinue = () => {
    const q = questions[currentQuestion]
    const userAnswer = answers[q.id]
    if (userAnswer === undefined) return

    const autoGradable =
      q.question_type === 'multiple_choice' || q.question_type === 'true_false'

    if (!autoGradable) {
      advanceOrReview()
      return
    }

    const correct = isAnswerCorrect(q, userAnswer)
    if (correct) {
      const msg =
        (q as any).explanation?.trim() ||
        'Nice work — that answer is correct.'
      setFeedback({ correct: true, title: 'Correct', message: msg })
      setFeedbackOpen(true)
      return
    }

    const wrongMsg =
      (q as any).incorrect_explanation?.trim() ||
      (q as any).explanation?.trim() ||
      'That answer is not correct. Review the lesson material and try again on your next attempt.'
    setFeedback({ correct: false, title: 'Not quite', message: wrongMsg })
    setFeedbackOpen(true)
  }

  const handleFeedbackContinue = () => {
    setFeedbackOpen(false)
    setFeedback(null)
    advanceOrReview()
  }

  const handleSubmit = async () => {
    if (submitting || submitted) return
    if (attemptsExhausted) return

    try {
      setSubmitting(true)
      const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0) || 1
      let correctCount = 0
      let earnedPoints = 0

      questions.forEach((question) => {
        const userAnswer = answers[question.id]
        const ok =
          question.question_type === 'short_answer' || question.question_type === 'essay'
            ? false
            : isAnswerCorrect(question, userAnswer)
        // short/essay don't count toward auto score unless we have exact match
        let scored = ok
        if (question.question_type === 'short_answer' || question.question_type === 'essay') {
          scored =
            String(userAnswer || '')
              .trim()
              .toLowerCase() ===
            String(question.correct_answer || '')
              .trim()
              .toLowerCase()
        }
        if (scored) {
          correctCount++
          earnedPoints += question.points || 1
        }
      })

      const score = Math.round((earnedPoints / totalPoints) * 100)
      const passed = score >= ((quiz as any)?.passing_score || 70)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: attemptData, error } = await (supabase as any)
        .from('quiz_attempts')
        .insert({
          user_id: user.id,
          quiz_id: quizId,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          score,
          passed,
          time_spent_seconds: Math.max(
            0,
            ((quiz as any)?.time_limit_minutes * 60 || 0) - timeRemaining
          ),
          answers,
          feedback: {
            correctCount,
            totalQuestions: questions.length,
            earnedPoints,
            totalPoints,
          },
        })
        .select()
        .single()

      if (error) throw error

      const used = attemptsUsed + 1
      setAttemptsUsed(used)
      setAttempt(attemptData)
      setSubmitted(true)

      const exhausted = !passed && used >= maxAttempts
      if (exhausted) setAttemptsExhausted(true)

      const outcome: QuizOutcome = {
        attempt: attemptData,
        passed,
        attemptsUsed: used,
        maxAttempts,
        attemptsExhausted: exhausted,
      }
      setLastOutcome(outcome)
      setOutcomeOpen(true)
      onComplete?.(outcome)
    } catch (error) {
      console.error('Error submitting quiz:', error)
      alert('Failed to submit quiz. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const retakeQuiz = () => {
    setAnswers({})
    setCurrentQuestion(0)
    setShowResults(false)
    setSubmitted(false)
    setAttempt(null)
    setLastOutcome(null)
    setOutcomeOpen(false)
    setTimeRemaining(((quiz as any)?.time_limit_minutes || 0) * 60)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
        <span className="ml-3 text-muted-foreground">Loading quiz...</span>
      </div>
    )
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Quiz not found or has no questions.</p>
        {onClose && (
          <Button variant="outline" className="mt-4" onClick={onClose}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        )}
      </div>
    )
  }

  if (attemptsExhausted && !submitted) {
    return (
      <Card className="glass-strong">
        <CardHeader>
          <CardTitle>Attempts used up</CardTitle>
          <CardDescription>
            You have used all {maxAttempts} attempts on this quiz without passing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Review this lesson again, then you can ask your teacher if more attempts are needed.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              onClick={() => onRedoLesson?.() || onClose?.()}
            >
              Redo lesson
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentQuestionData = questions[currentQuestion]
  const progress = ((currentQuestion + 1) / questions.length) * 100
  const isAnswered = answers[currentQuestionData?.id] !== undefined

  return (
    <div className="space-y-6">
      <Card className="glass-strong">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{(quiz as any).title}</CardTitle>
              {(quiz as any).description && (
                <CardDescription>{(quiz as any).description}</CardDescription>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {(quiz as any).time_limit_minutes > 0 && !submitted && (
                <Badge variant="outline" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatTime(timeRemaining)}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground">
                Attempt {Math.min(attemptsUsed + 1, maxAttempts)} of {maxAttempts}
              </p>
            </div>
          </div>
          {!showResults && <Progress value={progress} className="mt-4" />}
          {!showResults && (
            <p className="mt-2 text-sm text-muted-foreground">
              Question {currentQuestion + 1} of {questions.length}
            </p>
          )}
        </CardHeader>
      </Card>

      {!showResults ? (
        <Card className="glass">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-xl">{currentQuestionData.question_text}</CardTitle>
              <Badge variant="secondary">
                {currentQuestionData.points || 1} pt
                {(currentQuestionData.points || 1) !== 1 ? 's' : ''}
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

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))}
                disabled={currentQuestion === 0}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <Button
                onClick={checkCurrentAndContinue}
                disabled={!isAnswered}
                className="bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              >
                {currentQuestion === questions.length - 1 ? 'Review answers' : 'Check & next'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <QuizResults
          questions={questions}
          answers={answers}
          attempt={attempt}
          onSubmit={() => void handleSubmit()}
          submitting={submitting}
          submitted={submitted}
          onClose={onClose}
          onRetake={
            submitted && !attempt?.passed && attemptsUsed < maxAttempts ? retakeQuiz : undefined
          }
          remainingAttempts={Math.max(0, maxAttempts - attemptsUsed)}
        />
      )}

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {feedback?.correct ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {feedback?.title}
            </DialogTitle>
            <DialogDescription className="text-left text-foreground/90 whitespace-pre-wrap">
              {feedback?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              onClick={handleFeedbackContinue}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={outcomeOpen} onOpenChange={setOutcomeOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {lastOutcome?.passed ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {lastOutcome?.passed
                ? 'You passed!'
                : lastOutcome?.attemptsExhausted
                  ? 'Attempts exhausted'
                  : 'Not passed yet'}
            </DialogTitle>
            <DialogDescription className="text-left space-y-2">
              <span className="block">
                Score: {lastOutcome?.attempt?.score}% (pass mark{' '}
                {(quiz as any)?.passing_score || 70}%)
              </span>
              {lastOutcome?.passed ? (
                <span className="block">
                  You can continue with the lesson. Mandatory quiz progress will update
                  automatically.
                </span>
              ) : lastOutcome?.attemptsExhausted ? (
                <span className="block">
                  You used all {maxAttempts} attempts. Review this lesson from the start, then try
                  again later if your teacher allows more attempts.
                </span>
              ) : (
                <span className="block">
                  You have {Math.max(0, maxAttempts - (lastOutcome?.attemptsUsed || 0))} attempt(s)
                  left. Retake the quiz or review the lesson first.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {lastOutcome?.passed && (
              <Button
                className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
                onClick={() => {
                  setOutcomeOpen(false)
                  onClose?.()
                }}
              >
                Continue learning
              </Button>
            )}
            {!lastOutcome?.passed && !lastOutcome?.attemptsExhausted && (
              <>
                <Button variant="outline" className="min-h-11" onClick={retakeQuiz}>
                  Retake quiz
                </Button>
                <Button
                  className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
                  onClick={() => {
                    setOutcomeOpen(false)
                    onClose?.()
                  }}
                >
                  Review lesson
                </Button>
              </>
            )}
            {lastOutcome?.attemptsExhausted && (
              <Button
                className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
                onClick={() => {
                  setOutcomeOpen(false)
                  onRedoLesson?.()
                  onClose?.()
                }}
              >
                Redo lesson
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MultipleChoiceQuestion({ question, value, onChange }: any) {
  let options = parseOptions(question.options)
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
        <Label className="text-sm text-muted-foreground">Select all that apply:</Label>
        {options.map((option: any, index: number) => (
          <div key={index} className="flex items-center space-x-2">
            <Checkbox
              id={`option-${index}`}
              checked={value?.includes(option.text)}
              onCheckedChange={(checked) => {
                const currentValues = value || []
                if (checked) onChange([...currentValues, option.text])
                else onChange(currentValues.filter((v: string) => v !== option.text))
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
    <RadioGroup value={value ?? ''} onValueChange={onChange}>
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

function TrueFalseQuestion({ value, onChange }: any) {
  return (
    <RadioGroup value={value ?? ''} onValueChange={onChange}>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="true" id="true" />
        <Label htmlFor="true" className="cursor-pointer">
          True
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="false" id="false" />
        <Label htmlFor="false" className="cursor-pointer">
          False
        </Label>
      </div>
    </RadioGroup>
  )
}

function ShortAnswerQuestion({ value, onChange }: any) {
  return (
    <Textarea
      value={value ?? ''}
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
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Write your essay response..."
      rows={8}
      className="resize-none"
    />
  )
}

function QuizResults({
  questions,
  answers,
  attempt,
  onSubmit,
  submitting,
  submitted,
  onClose,
  onRetake,
  remainingAttempts,
}: any) {
  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === questions.length

  return (
    <Card className="glass-strong">
      <CardHeader>
        <CardTitle>{submitted ? 'Results' : 'Ready to submit?'}</CardTitle>
        <CardDescription>
          {submitted
            ? `Final score ${attempt?.score}%`
            : `You've answered ${answeredCount} out of ${questions.length} questions.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!submitted ? (
          <>
            <div className="space-y-3">
              {questions.map((question: any, index: number) => {
                const answered = answers[question.id] !== undefined
                return (
                  <div
                    key={question.id}
                    className="flex items-center justify-between rounded-lg bg-background/50 p-3"
                  >
                    <span className="text-sm">
                      Question {index + 1}: {question.question_text.slice(0, 50)}
                      {question.question_text.length > 50 ? '…' : ''}
                    </span>
                    {answered ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={onSubmit}
                disabled={!allAnswered || submitting}
                className="flex-1 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit quiz'
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4 text-center">
            {attempt?.passed ? (
              <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
            ) : (
              <XCircle className="mx-auto h-16 w-16 text-red-600" />
            )}
            <div>
              <h3 className="text-2xl font-bold">
                {attempt?.passed ? 'Congratulations!' : 'Keep learning'}
              </h3>
              <p className="mt-2 text-muted-foreground">
                You scored {attempt?.score}% and {attempt?.passed ? 'passed' : 'did not pass'} the
                quiz.
              </p>
              {!attempt?.passed && remainingAttempts > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining.
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {onRetake && (
                <Button variant="outline" onClick={onRetake}>
                  Retake quiz
                </Button>
              )}
              {onClose && (
                <Button onClick={onClose} className="bg-bhutan-yellow text-black hover:bg-bhutan-orange">
                  Continue
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
