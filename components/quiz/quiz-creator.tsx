'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'

type DraftQuestion = {
  id?: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
  options: Array<{ text: string; is_correct: boolean }>
  correct_answer: string
  explanation: string
  incorrect_explanation: string
  order_index: number
  points: number
}

export type SavedQuiz = {
  id: string
  title: string
  passing_score?: number
}

interface QuizCreatorProps {
  lessonId: string
  quizId?: string | null
  compact?: boolean
  onSave?: (quiz: SavedQuiz) => void
  onCancel?: () => void
}

function emptyQuestion(index: number): DraftQuestion {
  return {
    question_text: '',
    question_type: 'multiple_choice',
    options: [
      { text: '', is_correct: false },
      { text: '', is_correct: false },
      { text: '', is_correct: false },
      { text: '', is_correct: false },
    ],
    correct_answer: '',
    explanation: '',
    incorrect_explanation: '',
    order_index: index,
    points: 1,
  }
}

function parseOptions(raw: unknown): Array<{ text: string; is_correct: boolean }> {
  if (Array.isArray(raw)) {
    return raw.map((o: any) =>
      typeof o === 'string'
        ? { text: o, is_correct: false }
        : { text: o?.text || String(o || ''), is_correct: Boolean(o?.is_correct) }
    )
  }
  if (typeof raw === 'string') {
    try {
      return parseOptions(JSON.parse(raw))
    } catch {
      return []
    }
  }
  return []
}

export function QuizCreator({ lessonId, quizId, compact, onSave, onCancel }: QuizCreatorProps) {
  const [loading, setLoading] = useState(Boolean(quizId))
  const [saving, setSaving] = useState(false)
  const [existingId, setExistingId] = useState<string | null>(quizId || null)
  const [quiz, setQuiz] = useState({
    title: '',
    description: '',
    time_limit_minutes: 30,
    passing_score: 70,
    max_attempts: 3,
    is_published: true,
  })
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!quizId) return
    void loadExisting(quizId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId])

  const loadExisting = async (id: string) => {
    setLoading(true)
    setError('')
    try {
      const [quizRes, qRes] = await Promise.all([
        fetch(`/api/quizzes/${id}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/quizzes/${id}/questions`).then((r) => r.json()),
      ])
      if (quizRes?.quiz) {
        setQuiz({
          title: quizRes.quiz.title || '',
          description: quizRes.quiz.description || '',
          time_limit_minutes: quizRes.quiz.time_limit_minutes || 30,
          passing_score: quizRes.quiz.passing_score || 70,
          max_attempts: quizRes.quiz.max_attempts || 3,
          is_published: quizRes.quiz.is_published !== false,
        })
        setExistingId(quizRes.quiz.id)
      }
      const rows = qRes.questions || []
      setQuestions(
        rows.map((q: any, i: number) => ({
          id: q.id,
          question_text: q.question_text || '',
          question_type: q.question_type || 'multiple_choice',
          options: parseOptions(q.options).length
            ? parseOptions(q.options)
            : emptyQuestion(i).options,
          correct_answer: q.correct_answer || '',
          explanation: q.explanation || '',
          incorrect_explanation: q.incorrect_explanation || '',
          order_index: q.order_index ?? i,
          points: q.points || 1,
        }))
      )
    } catch (e: any) {
      setError(e?.message || 'Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }

  const addQuestion = () => {
    setQuestions([...questions, emptyQuestion(questions.length)])
  }

  const generateWithGemini = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, topic: quiz.title }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      const rows = data.quiz?.questions || []
      if (!rows.length) throw new Error('Gemini returned no questions')
      if (!quiz.title && data.quiz?.title) {
        setQuiz({ ...quiz, title: data.quiz.title })
      }
      setQuestions(
        rows.map((q: any, i: number) => ({
          question_text: q.question || '',
          question_type: 'multiple_choice' as const,
          options: (q.options || []).map((text: string, idx: number) => ({
            text,
            is_correct: idx === q.correctIndex,
          })),
          correct_answer: q.options?.[q.correctIndex] || '',
          explanation: q.explanation || '',
          incorrect_explanation: q.incorrectExplanation || q.incorrect_explanation || '',
          order_index: i,
          points: 1,
        }))
      )
    } catch (e: any) {
      setError(e?.message || 'Failed to generate questions')
    } finally {
      setGenerating(false)
    }
  }

  const updateQuestion = (index: number, updates: Partial<DraftQuestion>) => {
    const next = [...questions]
    next[index] = { ...next[index], ...updates }
    setQuestions(next)
  }

  const deleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order_index: i })))
  }

  const updateOption = (qi: number, oi: number, text: string) => {
    const options = [...questions[qi].options]
    options[oi] = { ...options[oi], text }
    updateQuestion(qi, { options })
  }

  const toggleCorrect = (qi: number, oi: number) => {
    const question = questions[qi]
    const options = question.options.map((opt, i) => {
      if (question.question_type === 'multiple_choice') {
        return { ...opt, is_correct: i === oi }
      }
      if (i === oi) return { ...opt, is_correct: !opt.is_correct }
      return opt
    })
    updateQuestion(qi, { options })
  }

  const persistQuestions = async (id: string) => {
    const existingRes = await fetch(`/api/quizzes/${id}/questions`)
    const existingJson = await existingRes.json().catch(() => ({ questions: [] }))
    const existing: any[] = existingJson.questions || []
    const keepIds = new Set(questions.map((q) => q.id).filter(Boolean))

    for (const old of existing) {
      if (!keepIds.has(old.id)) {
        await fetch(`/api/quizzes/${id}/questions/${old.id}`, { method: 'DELETE' })
      }
    }

    for (const [i, q] of questions.entries()) {
      const correct =
        q.question_type === 'true_false'
          ? q.correct_answer
          : q.options.find((o) => o.is_correct)?.text || q.correct_answer
      const body = {
        questionText: q.question_text,
        questionType: q.question_type,
        options: q.question_type === 'multiple_choice' ? q.options : undefined,
        correctAnswer: correct,
        explanation: q.explanation,
        incorrectExplanation: q.incorrect_explanation,
        points: q.points,
        orderIndex: i,
      }
      if (q.id) {
        const res = await fetch(`/api/quizzes/${id}/questions/${q.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to update question')
        }
      } else {
        const res = await fetch(`/api/quizzes/${id}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to add question')
      }
    }
  }

  const handleSave = async () => {
    if (!quiz.title.trim()) {
      setError('Please enter a quiz title')
      return
    }
    if (questions.length === 0) {
      setError('Please add at least one question')
      return
    }
    if (questions.some((q) => !q.question_text.trim())) {
      setError('Every question needs text')
      return
    }

    try {
      setSaving(true)
      setError('')
      let id = existingId

      if (!id) {
        const res = await fetch('/api/quizzes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonId,
            title: quiz.title,
            description: quiz.description,
            passingScore: quiz.passing_score,
            maxAttempts: quiz.max_attempts,
            timeLimitMinutes: quiz.time_limit_minutes,
            isPublished: quiz.is_published,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `Failed to create quiz (${res.status})`)
        id = data.quiz?.id
        if (!id) throw new Error(data.error || 'Quiz was created but no id was returned')
        setExistingId(id)
      } else {
        const res = await fetch(`/api/quizzes/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: quiz.title,
            description: quiz.description,
            passingScore: quiz.passing_score,
            maxAttempts: quiz.max_attempts,
            timeLimitMinutes: quiz.time_limit_minutes,
            isPublished: quiz.is_published,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `Failed to update quiz (${res.status})`)
      }

      await persistQuestions(id!)
      onSave?.({ id: id!, title: quiz.title, passing_score: quiz.passing_score })
    } catch (e: any) {
      setError(e?.message || 'Failed to save quiz')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading quiz…
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <Card className={compact ? '' : 'glass-strong'}>
        {!compact && (
          <CardHeader>
            <CardTitle>Quiz Details</CardTitle>
            <CardDescription>Questions are saved to this lesson and students can take them.</CardDescription>
          </CardHeader>
        )}
        <CardContent className={compact ? 'p-0 space-y-3' : 'space-y-4'}>
          <div>
            <Label htmlFor="quiz-title">Title *</Label>
            <Input
              id="quiz-title"
              value={quiz.title}
              onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
              placeholder="e.g. Module 1 assessment"
              className="mt-1 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="quiz-desc">Description</Label>
            <Textarea
              id="quiz-desc"
              value={quiz.description}
              onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
              rows={2}
              className="mt-1 resize-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Time limit (min)</Label>
              <Input
                type="number"
                min={1}
                value={quiz.time_limit_minutes}
                onChange={(e) =>
                  setQuiz({ ...quiz, time_limit_minutes: parseInt(e.target.value) || 0 })
                }
                className="mt-1 min-h-11"
              />
            </div>
            <div>
              <Label>Passing score (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={quiz.passing_score}
                onChange={(e) =>
                  setQuiz({ ...quiz, passing_score: parseInt(e.target.value) || 70 })
                }
                className="mt-1 min-h-11"
              />
            </div>
            <div>
              <Label>Max attempts</Label>
              <Input
                type="number"
                min={1}
                value={quiz.max_attempts}
                onChange={(e) =>
                  setQuiz({ ...quiz, max_attempts: parseInt(e.target.value) || 3 })
                }
                className="mt-1 min-h-11"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="quiz-published"
              checked={quiz.is_published}
              onCheckedChange={(checked) => setQuiz({ ...quiz, is_published: checked })}
            />
            <Label htmlFor="quiz-published">Visible to students</Label>
          </div>
        </CardContent>
      </Card>

      <Card className={compact ? '' : 'glass-strong'}>
        <CardHeader className={compact ? 'px-0 pt-0' : undefined}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Questions</CardTitle>
              <CardDescription>Multiple choice, true/false, short answer, or essay</CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={generating}
                onClick={() => void generateWithGemini()}
              >
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate with Gemini
              </Button>
              <Button
                type="button"
                onClick={addQuestion}
                size="sm"
                className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add question
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={compact ? 'space-y-4 px-0' : 'space-y-6'}>
          {questions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No questions yet. Add a multiple-choice item to get started.
            </p>
          ) : (
            questions.map((question, questionIndex) => (
              <QuestionEditor
                key={question.id || questionIndex}
                question={question}
                questionNumber={questionIndex + 1}
                onUpdate={(updates) => updateQuestion(questionIndex, updates)}
                onDelete={() => deleteQuestion(questionIndex)}
                onOptionUpdate={(oi, text) => updateOption(questionIndex, oi, text)}
                onToggleCorrect={(oi) => toggleCorrect(questionIndex, oi)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" className="min-h-11" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {existingId ? 'Update quiz' : 'Save quiz'}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function QuestionEditor({
  question,
  questionNumber,
  onUpdate,
  onDelete,
  onOptionUpdate,
  onToggleCorrect,
}: {
  question: DraftQuestion
  questionNumber: number
  onUpdate: (updates: Partial<DraftQuestion>) => void
  onDelete: () => void
  onOptionUpdate: (optionIndex: number, text: string) => void
  onToggleCorrect: (optionIndex: number) => void
}) {
  const isMultipleCorrect = question.options.filter((opt) => opt.is_correct).length > 1

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">Question {questionNumber}</h3>
        <Button type="button" variant="ghost" size="sm" className="min-h-11 min-w-11" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>

      <div>
        <Label>Question text *</Label>
        <Textarea
          value={question.question_text}
          onChange={(e) => onUpdate({ question_text: e.target.value })}
          placeholder="Enter your question…"
          rows={2}
          className="mt-1 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Question type</Label>
          <select
            value={question.question_type}
            onChange={(e) =>
              onUpdate({ question_type: e.target.value as DraftQuestion['question_type'] })
            }
            className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="multiple_choice">Multiple choice</option>
            <option value="true_false">True / false</option>
            <option value="short_answer">Short answer</option>
            <option value="essay">Essay</option>
          </select>
        </div>
        <div>
          <Label>Points</Label>
          <Input
            type="number"
            min={1}
            value={question.points}
            onChange={(e) => onUpdate({ points: parseInt(e.target.value) || 1 })}
            className="mt-1 min-h-11"
          />
        </div>
      </div>

      {question.question_type === 'multiple_choice' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Answer options</Label>
            {isMultipleCorrect && (
              <Badge variant="secondary" className="text-xs">
                Multiple correct
              </Badge>
            )}
          </div>
          {question.options.map((option, optionIndex) => (
            <div key={optionIndex} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={option.is_correct}
                onChange={() => onToggleCorrect(optionIndex)}
                className="h-5 w-5"
                aria-label={`Mark option ${optionIndex + 1} correct`}
              />
              <Input
                value={option.text}
                onChange={(e) => onOptionUpdate(optionIndex, e.target.value)}
                placeholder={`Option ${optionIndex + 1}`}
                className="min-h-11 flex-1"
              />
            </div>
          ))}
        </div>
      )}

      {question.question_type === 'true_false' && (
        <div>
          <Label>Correct answer</Label>
          <select
            value={question.correct_answer}
            onChange={(e) => onUpdate({ correct_answer: e.target.value })}
            className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select correct answer</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      )}

      {(question.question_type === 'short_answer' || question.question_type === 'essay') && (
        <div>
          <Label>Model answer (optional)</Label>
          <Input
            value={question.correct_answer}
            onChange={(e) => onUpdate({ correct_answer: e.target.value })}
            className="mt-1 min-h-11"
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Correct answer feedback (optional)</Label>
          <Textarea
            value={question.explanation || ''}
            onChange={(e) => onUpdate({ explanation: e.target.value })}
            placeholder="Shown when the learner answers correctly…"
            rows={2}
            className="mt-1 resize-none"
          />
        </div>
        <div>
          <Label>Wrong answer dialogue (optional)</Label>
          <Textarea
            value={question.incorrect_explanation || ''}
            onChange={(e) => onUpdate({ incorrect_explanation: e.target.value })}
            placeholder="Shown in a dialogue when they pick a wrong answer…"
            rows={2}
            className="mt-1 resize-none"
          />
        </div>
      </div>
    </div>
  )
}
