'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Quiz = Database['public']['Tables']['quizzes']['Row']
type QuizQuestion = Database['public']['Tables']['quiz_questions']['Row']

interface QuizCreatorProps {
  lessonId?: string
  onSave?: (quiz: Quiz) => void
  onCancel?: () => void
}

export function QuizCreator({ lessonId, onSave, onCancel }: QuizCreatorProps) {
  const [loading, setLoading] = useState(false)
  const [quiz, setQuiz] = useState({
    title: '',
    description: '',
    time_limit_minutes: 30,
    passing_score: 70,
    max_attempts: 3,
    is_published: false
  })
  const [questions, setQuestions] = useState<Omit<QuizQuestion, 'id' | 'quiz_id' | 'created_at'>[]>([])

  const supabase = createClient()

  const addQuestion = () => {
    setQuestions([...questions, {
      question_text: '',
      question_type: 'multiple_choice',
      options: JSON.stringify([
        { text: '', is_correct: false },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
        { text: '', is_correct: false }
      ]),
      correct_answer: '',
      explanation: '',
      order_index: questions.length,
      points: 1
    }])
  }

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], ...updates }
    setQuestions(newQuestions)
  }

  const deleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const updateOption = (questionIndex: number, optionIndex: number, text: string) => {
    const question = questions[questionIndex]
    const options = JSON.parse(question.options || '[]')
    options[optionIndex].text = text
    updateQuestion(questionIndex, { options: JSON.stringify(options) })
  }

  const toggleCorrect = (questionIndex: number, optionIndex: number) => {
    const question = questions[questionIndex]
    const options = JSON.parse(question.options || '[]')

    // For single choice, only one can be correct
    if (question.question_type === 'multiple_choice') {
      const hasMultipleCorrect = options.filter((opt: any) => opt.is_correct).length > 1

      if (!hasMultipleCorrect) {
        options[optionIndex].is_correct = !options[optionIndex].is_correct
        // If setting this as correct, unset others
        if (options[optionIndex].is_correct) {
          options.forEach((opt: any, i: number) => {
            if (i !== optionIndex) opt.is_correct = false
          })
        }
      } else {
        // Multiple choice mode - toggle independently
        options[optionIndex].is_correct = !options[optionIndex].is_correct
      }
    }

    updateQuestion(questionIndex, { options: JSON.stringify(options) })
  }

  const handleSave = async () => {
    if (!quiz.title.trim()) {
      alert('Please enter a quiz title')
      return
    }

    if (questions.length === 0) {
      alert('Please add at least one question')
      return
    }

    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create quiz
      const { data: quizData } = await supabase
        .from('quizzes')
        .insert({
          lesson_id: lessonId || null,
          title: quiz.title,
          description: quiz.description || null,
          time_limit_minutes: quiz.time_limit_minutes,
          passing_score: quiz.passing_score,
          max_attempts: quiz.max_attempts,
          is_published: quiz.is_published
        })
        .select()
        .single()

      if (!quizData) return

      // Create questions
      const questionsToInsert = questions.map(q => ({
        quiz_id: quizData.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        order_index: q.order_index,
        points: q.points
      }))

      const { error: questionsError } = await supabase
        .from('quiz_questions')
        .insert(questionsToInsert)

      if (questionsError) throw questionsError

      onSave?.(quizData)
    } catch (error) {
      console.error('Error creating quiz:', error)
      alert('Failed to create quiz. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Quiz Details */}
      <Card className="glass-strong">
        <CardHeader>
          <CardTitle>Quiz Details</CardTitle>
          <CardDescription>Set up your quiz configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={quiz.title}
              onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
              placeholder="e.g., Module 1 Assessment"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={quiz.description}
              onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
              placeholder="Brief description of the quiz..."
              rows={2}
              className="mt-1 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
              <Input
                id="timeLimit"
                type="number"
                value={quiz.time_limit_minutes}
                onChange={(e) => setQuiz({ ...quiz, time_limit_minutes: parseInt(e.target.value) })}
                min={1}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="passingScore">Passing Score (%)</Label>
              <Input
                id="passingScore"
                type="number"
                value={quiz.passing_score}
                onChange={(e) => setQuiz({ ...quiz, passing_score: parseInt(e.target.value) })}
                min={1}
                max={100}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="maxAttempts">Max Attempts</Label>
              <Input
                id="maxAttempts"
                type="number"
                value={quiz.max_attempts}
                onChange={(e) => setQuiz({ ...quiz, max_attempts: parseInt(e.target.value) })}
                min={1}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="published"
              checked={quiz.is_published}
              onCheckedChange={(checked) => setQuiz({ ...quiz, is_published: checked })}
            />
            <Label htmlFor="published">Publish immediately</Label>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card className="glass-strong">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription>Add and manage quiz questions</CardDescription>
            </div>
            <Button onClick={addQuestion} size="sm" className="bg-bhutan-yellow hover:bg-bhutan-orange">
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No questions yet. Click "Add Question" to get started.
            </div>
          ) : (
            questions.map((question, questionIndex) => (
              <QuestionEditor
                key={questionIndex}
                question={question}
                questionNumber={questionIndex + 1}
                onUpdate={(updates) => updateQuestion(questionIndex, updates)}
                onDelete={() => deleteQuestion(questionIndex)}
                onOptionUpdate={(optionIndex, text) => updateOption(questionIndex, optionIndex, text)}
                onToggleCorrect={(optionIndex) => toggleCorrect(questionIndex, optionIndex)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={loading}
          className="bg-bhutan-yellow hover:bg-bhutan-orange"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Quiz
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function QuestionEditor({ question, questionNumber, onUpdate, onDelete, onOptionUpdate, onToggleCorrect }: any) {
  const options = JSON.parse(question.options || '[]')
  const isMultipleCorrect = options.filter((opt: any) => opt.is_correct).length > 1

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">Question {questionNumber}</h3>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="w-4 h-4 text-red-600" />
        </Button>
      </div>

      <div>
        <Label>Question Text *</Label>
        <Textarea
          value={question.question_text}
          onChange={(e) => onUpdate({ question_text: e.target.value })}
          placeholder="Enter your question..."
          rows={2}
          className="mt-1 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Question Type</Label>
          <select
            value={question.question_type}
            onChange={(e) => onUpdate({ question_type: e.target.value })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="true_false">True/False</option>
            <option value="short_answer">Short Answer</option>
            <option value="essay">Essay</option>
          </select>
        </div>

        <div>
          <Label>Points</Label>
          <Input
            type="number"
            value={question.points}
            onChange={(e) => onUpdate({ points: parseInt(e.target.value) })}
            min={1}
            className="mt-1"
          />
        </div>
      </div>

      {question.question_type === 'multiple_choice' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Answer Options</Label>
            {isMultipleCorrect && (
              <Badge variant="secondary" className="text-xs">
                Multiple correct answers enabled
              </Badge>
            )}
          </div>
          {options.map((option: any, optionIndex: number) => (
            <div key={optionIndex} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={option.is_correct}
                onChange={() => onToggleCorrect(optionIndex)}
                className="w-4 h-4"
              />
              <Input
                value={option.text}
                onChange={(e) => onOptionUpdate(optionIndex, e.target.value)}
                placeholder={`Option ${optionIndex + 1}`}
                className="flex-1"
              />
            </div>
          ))}
        </div>
      )}

      {question.question_type === 'true_false' && (
        <div>
          <Label>Correct Answer</Label>
          <select
            value={question.correct_answer}
            onChange={(e) => onUpdate({ correct_answer: e.target.value })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select correct answer</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      )}

      <div>
        <Label>Explanation (Optional)</Label>
        <Textarea
          value={question.explanation || ''}
          onChange={(e) => onUpdate({ explanation: e.target.value })}
          placeholder="Explanation shown after answering..."
          rows={2}
          className="mt-1 resize-none"
        />
      </div>
    </div>
  )
}