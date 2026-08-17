// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'
import { geminiJson } from '@/lib/gemini'
import {
  outlineTotals,
  sizeInstructions,
  type CourseOutline,
  type CourseSize,
  type FilledLesson,
} from '@/lib/ai-course-builder'
import { createDraftCourse, persistFilledLesson } from '@/lib/ai-course-persist'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const mode = (body.mode || 'outline') as 'outline' | 'draft' | 'fill-module'
  const prompt = String(body.prompt || '').trim()
  const documentText = String(body.documentText || '').trim()
  const language = String(body.language || 'English')
  const size = (body.size || 'standard') as CourseSize
  const userId = rbac.userId!

  if (mode === 'outline') {
    if (!prompt && !documentText) {
      return NextResponse.json({ error: 'Describe the course or attach source text' }, { status: 400 })
    }
    try {
      const outline = await geminiJson<CourseOutline>(
        `You are a senior instructional designer for Pelbu LMS (Bhutan).
Language for ALL titles and descriptions: ${language}.
${sizeInstructions(size)}
Topic / brief: ${prompt || 'From the attached source'}
Source text (optional): ${documentText.slice(0, 18000)}

Return JSON:
{
  "title": string,
  "description": string,
  "durationMinutes": number,
  "language": string,
  "modules": [
    {
      "title": string,
      "description": string,
      "lessons": [
        {
          "title": string,
          "description": string,
          "blocks": ["text","quiz"],
          "hasQuiz": true,
          "hasAssignment": false,
          "hasScenario": false,
          "hasFlashcards": false
        }
      ]
    }
  ]
}
blocks may include text, accordion, flipcards, quiz, assignment, scenario, flashcards, youtube.`,
        { userId }
      )
      return NextResponse.json({
        success: true,
        outline,
        totals: outlineTotals(outline),
      })
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || 'Gemini could not design the outline' },
        { status: 500 }
      )
    }
  }

  const service = await createServiceClient()

  if (mode === 'draft') {
    const outline = body.outline as CourseOutline
    if (!outline?.title || !outline.modules?.length) {
      return NextResponse.json({ error: 'outline is required' }, { status: 400 })
    }
    try {
      const created = await createDraftCourse(service, { userId, outline, language })
      return NextResponse.json({ success: true, ...created, outline })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Could not create draft course' }, { status: 500 })
    }
  }

  if (mode === 'fill-module') {
    const courseId = body.courseId as string
    const moduleId = body.moduleId as string
    if (!courseId || !moduleId) {
      return NextResponse.json({ error: 'courseId and moduleId are required' }, { status: 400 })
    }
    if (!(await userCanManageCourse(service, courseId, userId, rbac.userRole))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { data: course } = await service
      .from('courses')
      .select('id, title, description, instructor_id')
      .eq('id', courseId)
      .single()
    const { data: moduleRow } = await service
      .from('modules')
      .select('id, title, description')
      .eq('id', moduleId)
      .single()
    const { data: lessons } = await service
      .from('lessons')
      .select('id, title, description, order_index, content')
      .eq('module_id', moduleId)
      .order('order_index')

    const needsFill = (lessons || []).filter((l: any) => {
      const c = l.content
      return !c || (Array.isArray(c) && c.length === 0) || c === '[]'
    })
    if (!needsFill.length) {
      return NextResponse.json({ success: true, filled: 0, skipped: true, moduleId })
    }

    try {
      const packed = await geminiJson<{ lessons: FilledLesson[] }>(
        `Write complete lesson pages for this module of “${(course as any)?.title}”.
Course description: ${(course as any)?.description || ''}
Module: ${(moduleRow as any)?.title} — ${(moduleRow as any)?.description || ''}
Language: ${language}.
        Lessons to fill: ${JSON.stringify((needsFill || []).map((l: any) => ({ title: l.title, description: l.description })))}
Source: ${(prompt || documentText).slice(0, 8000)}

Return JSON:
{
  "lessons": [
    {
      "title": string,
      "description": string,
      "durationMinutes": 12,
      "textHtml": "<p>Rich HTML with headings and lists</p>",
      "accordion": [{ "title": string, "html": string }],
      "flipcards": [{ "front": string, "back": string }],
      "quiz": {
        "title": string,
        "questions": [{ "question": string, "options": [string, string, string, string], "correctIndex": 0, "explanation": string }]
      },
      "assignment": { "title": string, "instructions": string, "maxPoints": 100 },
      "scenario": {
        "title": string,
        "nodes": [
          { "id": "start", "text": string, "choices": [{ "label": string, "nextId": "end-good", "feedback": "Good choice" }, { "label": string, "nextId": "end-poor", "feedback": "A poor choice" }] },
          { "id": "end-good", "text": string, "end": true },
          { "id": "end-poor", "text": string, "end": true }
        ]
      },
      "flashcards": [{ "front": string, "back": string }]
    }
  ]
}
Match the lesson count and order. Include a quiz for most lessons. Include one scenario in the module. HTML only, no markdown fences.`,
        { userId }
      )

      const filledLessons = packed.lessons || []
      let filled = 0
      for (let i = 0; i < needsFill.length; i++) {
        const lesson = needsFill[i]
        const data = filledLessons[i] || {
          title: lesson.title,
          textHtml: `<p>${lesson.description || lesson.title}</p>`,
        }
        await persistFilledLesson(service, {
          lessonId: lesson.id,
          courseId,
          instructorId: (course as any).instructor_id || userId,
          filled: data,
        })
        filled++
      }
      return NextResponse.json({ success: true, filled, moduleId })
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || 'Gemini could not write this module' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ error: 'Unknown mode' }, { status: 400 })
}
