'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Thread = {
  id: string
  title: string
  body: string
  created_at: string
  author_name?: string
}

type Reply = {
  id: string
  thread_id: string
  body: string
  created_at: string
  author_name?: string
}

interface LessonForumProps {
  courseId: string
  moduleId?: string
  lessonId?: string
  userId?: string
}

export function LessonForum({ courseId, moduleId, lessonId, userId }: LessonForumProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [forumId, setForumId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [threads, setThreads] = useState<Thread[]>([])
  const [replies, setReplies] = useState<Record<string, Reply[]>>({})
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadForum()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, moduleId, lessonId])

  const loadForum = async () => {
    setLoading(true)
    setError('')
    try {
      let forum: any = null
      if (lessonId) {
        const { data } = await (supabase as any)
          .from('forums')
          .select('*')
          .eq('course_id', courseId)
          .eq('lesson_id', lessonId)
          .maybeSingle()
        forum = data
      }
      if (!forum && moduleId) {
        const { data } = await (supabase as any)
          .from('forums')
          .select('*')
          .eq('course_id', courseId)
          .eq('module_id', moduleId)
          .is('lesson_id', null)
          .maybeSingle()
        forum = data
      }
      if (!forum) {
        const { data } = await (supabase as any)
          .from('forums')
          .select('*')
          .eq('course_id', courseId)
          .is('module_id', null)
          .is('lesson_id', null)
          .maybeSingle()
        forum = data
      }

      if (!forum || forum.is_enabled === false) {
        setEnabled(false)
        setForumId(null)
        setThreads([])
        return
      }

      setEnabled(true)
      setForumId(forum.id)

      const { data: threadRows } = await (supabase as any)
        .from('threads')
        .select('*')
        .eq('forum_id', forum.id)
        .order('created_at', { ascending: false })

      const list = (threadRows || []) as any[]
      const authorIds = [...new Set(list.map((t) => t.user_id).filter(Boolean))]
      let names: Record<string, string> = {}
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', authorIds)
        for (const p of (profiles || []) as any[]) {
          names[p.id] = p.full_name || 'Student'
        }
      }

      setThreads(
        list.map((t) => ({
          id: t.id,
          title: t.title,
          body: t.content || '',
          created_at: t.created_at,
          author_name: names[t.user_id],
        }))
      )

      if (list.length > 0) {
        const { data: replyRows } = await (supabase as any)
          .from('replies')
          .select('*')
          .in(
            'thread_id',
            list.map((t) => t.id)
          )
          .order('created_at', { ascending: true })

        const replyList = (replyRows || []) as any[]
        const replyAuthorIds = [...new Set(replyList.map((r) => r.user_id).filter(Boolean))]
        if (replyAuthorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', replyAuthorIds)
          for (const p of (profiles || []) as any[]) {
            names[p.id] = p.full_name || 'Student'
          }
        }

        const byThread: Record<string, Reply[]> = {}
        for (const r of replyList) {
          const tid = r.thread_id
          if (!byThread[tid]) byThread[tid] = []
          byThread[tid].push({
            id: r.id,
            thread_id: tid,
            body: r.content || '',
            created_at: r.created_at,
            author_name: names[r.user_id],
          })
        }
        setReplies(byThread)
      }
    } catch (e: any) {
      console.error('Forum load error:', e)
      setError(e?.message || 'Discussion is not available yet.')
      setEnabled(false)
    } finally {
      setLoading(false)
    }
  }

  const createThread = async () => {
    if (!forumId || !userId || !title.trim() || !body.trim()) return
    setPosting(true)
    try {
      const { error: insertError } = await (supabase as any).from('threads').insert({
        forum_id: forumId,
        user_id: userId,
        title: title.trim(),
        content: body.trim(),
      })
      if (insertError) throw insertError
      setTitle('')
      setBody('')
      await loadForum()
    } catch (e: any) {
      setError(e?.message || 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  const postReply = async (threadId: string) => {
    const text = replyDrafts[threadId]?.trim()
    if (!userId || !text) return
    setPosting(true)
    try {
      const { error: insertError } = await (supabase as any).from('replies').insert({
        thread_id: threadId,
        user_id: userId,
        content: text,
      })
      if (insertError) throw insertError
      setReplyDrafts((prev) => ({ ...prev, [threadId]: '' }))
      await loadForum()
    } catch (e: any) {
      setError(e?.message || 'Failed to reply')
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading discussion…
      </div>
    )
  }

  if (!enabled) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Discussion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The course creator has not enabled a discussion for this lesson or course yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Start a thread</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Topic title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!userId}
          />
          <Textarea
            placeholder="Share a question or comment for enrolled students…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            disabled={!userId}
          />
          <Button
            onClick={createThread}
            disabled={posting || !userId || !title.trim() || !body.trim()}
            className="bg-bhutan-yellow text-black hover:bg-bhutan-orange"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Post
          </Button>
        </CardContent>
      </Card>

      {threads.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No threads yet. Be the first to post.</p>
      ) : (
        threads.map((thread) => (
          <Card key={thread.id} className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{thread.title}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {thread.author_name || 'Student'} · {new Date(thread.created_at).toLocaleString()}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm whitespace-pre-wrap">{thread.body}</p>
              <div className="space-y-2 border-t pt-3">
                {(replies[thread.id] || []).map((r) => (
                  <div key={r.id} className="rounded-md bg-muted/40 p-2">
                    <p className="text-xs text-muted-foreground mb-1">
                      {r.author_name || 'Student'} · {new Date(r.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{r.body}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Write a reply…"
                    value={replyDrafts[thread.id] || ''}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [thread.id]: e.target.value }))
                    }
                    disabled={!userId}
                  />
                  <Button
                    variant="outline"
                    disabled={posting || !userId || !(replyDrafts[thread.id] || '').trim()}
                    onClick={() => postReply(thread.id)}
                  >
                    Reply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
