'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Download } from 'lucide-react'

export function GeminiCoursePanel({ courseId }: { courseId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" /> Course studio
        </CardTitle>
        <CardDescription>
          Edit pages as learners see them, ask Pelbu to rewrite, and generate images or quizzes.
          New courses start from Teach → Create.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
          render={<Link href={`/teach/courses/${courseId}/studio`} />}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Open course studio
        </Button>
        <Button type="button" variant="outline" className="min-h-11" render={<Link href="/teach/create" />}>
          Create another with Gemini
        </Button>
        <a
          href={`/api/teach/scorm?courseId=${courseId}`}
          className="inline-flex min-h-11 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
        >
          <Download className="mr-2 h-4 w-4" />
          Export SCORM
        </a>
      </CardContent>
    </Card>
  )
}
