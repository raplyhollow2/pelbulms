export type GradedQuestion = {
  id: string
  question_type: string
  options: unknown
  correct_answer: string | null
  explanation?: string | null
  incorrect_explanation?: string | null
  points?: number | null
}

export type GradeResult = {
  score: number
  passed: boolean
  correctCount: number
  earnedPoints: number
  totalPoints: number
  results: Array<{ questionId: string; correct: boolean }>
}

function parseOptions(raw: unknown): Array<{ text: string; is_correct?: boolean }> {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  return value.map((opt) =>
    typeof opt === 'string' ? { text: opt } : { text: String(opt?.text ?? ''), is_correct: Boolean(opt?.is_correct) }
  )
}

export function answerIsCorrect(question: GradedQuestion, userAnswer: unknown): boolean {
  if (question.question_type === 'multiple_choice') {
    const options = parseOptions(question.options)
    const keyed = options.some((opt) => opt.is_correct)
    const correctOptions = keyed
      ? options.filter((opt) => opt.is_correct)
      : options.filter((opt) => opt.text === String(question.correct_answer ?? ''))
    if (Array.isArray(userAnswer)) {
      const picked = userAnswer.map(String)
      return (
        picked.length === correctOptions.length &&
        correctOptions.every((opt) => picked.includes(opt.text))
      )
    }
    return correctOptions.some((opt) => opt.text === String(userAnswer ?? ''))
  }

  if (question.question_type === 'true_false') {
    return String(userAnswer) === String(question.correct_answer)
  }

  if (question.question_type === 'short_answer' || question.question_type === 'essay') {
    const expected = String(question.correct_answer || '').trim().toLowerCase()
    if (!expected) return false
    return String(userAnswer || '').trim().toLowerCase() === expected
  }

  return false
}

export function gradeQuiz(
  questions: GradedQuestion[],
  answers: Record<string, unknown>,
  passingScore: number
): GradeResult {
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0) || 1
  let correctCount = 0
  let earnedPoints = 0
  const results: GradeResult['results'] = []

  for (const question of questions) {
    const correct = answerIsCorrect(question, answers[question.id])
    results.push({ questionId: question.id, correct })
    if (correct) {
      correctCount += 1
      earnedPoints += question.points || 1
    }
  }

  const score = Math.round((earnedPoints / totalPoints) * 100)
  return {
    score,
    passed: score >= passingScore,
    correctCount,
    earnedPoints,
    totalPoints,
    results,
  }
}

/** Drop answer keys and correctness flags before a learner sees the question. */
export function sanitizeQuestionForLearner<T extends Record<string, unknown>>(question: T) {
  const options = parseOptions(question.options).map((opt) => ({ text: opt.text }))
  return {
    id: question.id,
    quiz_id: question.quiz_id,
    question_text: question.question_text,
    question_type: question.question_type,
    options,
    order_index: question.order_index,
    points: question.points ?? 1,
  }
}
