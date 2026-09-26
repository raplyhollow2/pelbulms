import { complete } from '@/lib/ai/complete'
import {
  courseStructureSchema,
  type CourseStructureProposal,
} from '@/lib/ai/course-structure-outline'
import type { ModelFamily } from '@/lib/ai/models'

export { applyProposalToOutline, courseStructureSchema, type CourseStructureProposal } from '@/lib/ai/course-structure-outline'

type Service = {
  from: (table: string) => any
}

function norm(value: string) {
  return value.trim().toLowerCase()
}

export async function proposeCourseStructure(opts: {
  instruction: string
  outline: {
    title?: string
    description?: string
    learningObjectives?: string[]
    modules: { title: string; description?: string; lessons: { title: string; description?: string }[] }[]
  }
  family?: ModelFamily
  userId?: string | null
}): Promise<{ proposal: CourseStructureProposal; model: string; family: ModelFamily }> {
  const result = await complete({
    task: 'course-structure',
    family: opts.family,
    userId: opts.userId,
    audience: 'instructor',
    schema: courseStructureSchema,
    system: `You restructure PelbuLMS courses. Return a full module tree.
keep: an existing page stays, matched by sourceTitle.
move: an existing page changes module, matched by sourceTitle. Do not invent new body content.
add: a new empty page. sourceTitle is empty.
split: keep the source page and add one new empty page for the split-off title.
Do not delete pages by omission if they hold teaching material; place every existing lesson title somewhere.
Set hasQuiz only as a placement hint. Do not rewrite lesson text.`,
    prompt: `Teacher request: ${opts.instruction}

Current structure JSON:
${JSON.stringify(opts.outline)}`,
  })
  return { proposal: result.object, model: result.model, family: result.family }
}

export async function applyCourseStructure(
  service: Service,
  courseId: string,
  proposal: CourseStructureProposal,
  acceptedIndexes: number[]
) {
  const accepted = proposal.modules.filter((_, index) => acceptedIndexes.includes(index))
  if (!accepted.length) throw new Error('Choose at least one module to apply.')

  const { data: existingModules, error: moduleError } = await service
    .from('modules')
    .select('id, title, order_index')
    .eq('course_id', courseId)
    .order('order_index')
  if (moduleError) throw new Error(moduleError.message)

  const moduleRows = (existingModules || []) as { id: string; title: string; order_index: number }[]
  const moduleIds = moduleRows.map((row) => row.id)
  let lessonRows: { id: string; module_id: string; title: string }[] = []
  if (moduleIds.length) {
    const { data: lessons, error: lessonError } = await service
      .from('lessons')
      .select('id, module_id, title')
      .in('module_id', moduleIds)
    if (lessonError) throw new Error(lessonError.message)
    lessonRows = (lessons || []) as { id: string; module_id: string; title: string }[]
  }

  const unusedLessons = [...lessonRows]
  const takeLesson = (title: string) => {
    const key = norm(title)
    if (!key) return null
    const index = unusedLessons.findIndex((lesson) => norm(lesson.title) === key)
    if (index < 0) return null
    return unusedLessons.splice(index, 1)[0]
  }

  const usedModuleIds = new Set<string>()
  let moduleOrder = 0

  for (const mod of accepted) {
    const match = moduleRows.find(
      (row) => !usedModuleIds.has(row.id) && norm(row.title) === norm(mod.title)
    )
    let moduleId = match?.id
    if (moduleId) {
      usedModuleIds.add(moduleId)
      const { error } = await service
        .from('modules')
        .update({
          title: mod.title,
          description: mod.description || null,
          order_index: moduleOrder,
        })
        .eq('id', moduleId)
      if (error) throw new Error(error.message)
    } else {
      const { data, error } = await service
        .from('modules')
        .insert({
          course_id: courseId,
          title: mod.title,
          description: mod.description || null,
          order_index: moduleOrder,
          is_published: false,
        })
        .select('id')
        .single()
      if (error || !data) throw new Error(error?.message || 'Could not add a module')
      moduleId = data.id as string
      usedModuleIds.add(moduleId)
    }

    let lessonOrder = 0
    for (const lesson of mod.lessons) {
      const source =
        lesson.action === 'add' ? null : takeLesson(lesson.sourceTitle || lesson.title)
      if (!source) {
        const { error } = await service.from('lessons').insert({
          module_id: moduleId,
          title: lesson.title,
          description: lesson.description || null,
          content: [],
          order_index: lessonOrder,
          is_published: false,
          duration_minutes: 10,
          resources: [],
        })
        if (error) throw new Error(error.message)
        lessonOrder += 1
        continue
      }

      const patch: Record<string, unknown> = {
        module_id: moduleId,
        order_index: lessonOrder,
      }
      if (lesson.action !== 'split') patch.title = lesson.title || source.title
      if (lesson.description?.trim() && lesson.action !== 'split') {
        patch.description = lesson.description.trim()
      }
      const { error } = await service.from('lessons').update(patch).eq('id', source.id)
      if (error) throw new Error(error.message)
      lessonOrder += 1

      if (lesson.action === 'split' && norm(lesson.title) !== norm(source.title)) {
        const { error: splitError } = await service.from('lessons').insert({
          module_id: moduleId,
          title: lesson.title,
          description: lesson.description || null,
          content: [],
          order_index: lessonOrder,
          is_published: false,
          duration_minutes: 10,
          resources: [],
        })
        if (splitError) throw new Error(splitError.message)
        lessonOrder += 1
      }
    }
    moduleOrder += 1
  }

  for (const row of moduleRows) {
    if (usedModuleIds.has(row.id)) continue
    const { error } = await service.from('modules').update({ order_index: moduleOrder }).eq('id', row.id)
    if (error) throw new Error(error.message)
    moduleOrder += 1
  }

  if (proposal.learningObjectives.length) {
    const { error } = await service
      .from('courses')
      .update({ learning_objectives: proposal.learningObjectives })
      .eq('id', courseId)
    if (error) throw new Error(error.message)
  }
}
