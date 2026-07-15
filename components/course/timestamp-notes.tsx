'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StickyNote, Clock, Save, Trash2, Edit, MoreVertical, Play } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Note = Database['public']['Tables']['notes']['Row']

interface TimestampNotesProps {
  lessonId: string
  courseId: string
  videoRef: React.RefObject<HTMLVideoElement>
  userId?: string
}

export function TimestampNotes({ lessonId, courseId, videoRef, userId }: TimestampNotesProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadNotes()
  }, [lessonId, userId])

  const loadNotes = async () => {
    if (!userId) return

    try {
      const response = await fetch(`/api/notes?lessonId=${lessonId}`)
      if (response.ok) {
        const data = await response.json()
        setNotes(data.notes || [])
      }
    } catch (error) {
      console.error('Error loading notes:', error)
    }
  }

  const saveNote = async (noteContent: string, timestamp: number) => {
    if (!userId || !noteContent.trim()) return

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          courseId,
          content: noteContent.trim(),
          timestamp: Math.floor(timestamp),
          userId
        })
      })

      if (response.ok) {
        const newNoteData = await response.json()
        setNotes([newNoteData, ...notes])
        setNewNote('')
        setCurrentTime(0)
        setIsRecording(false)
      }
    } catch (error) {
      console.error('Error saving note:', error)
    }
  }

  const deleteNote = async (noteId: string) => {
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setNotes(notes.filter(note => note.id !== noteId))
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  const updateNote = async (noteId: string, content: string) => {
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })

      if (response.ok) {
        setNotes(notes.map(note =>
          note.id === noteId ? { ...note, content } : note
        ))
        setEditingNote(null)
        setEditText('')
      }
    } catch (error) {
      console.error('Error updating note:', error)
    }
  }

  const jumpToTimestamp = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp
      videoRef.current.play()
    }
  }

  const startRecordingNote = () => {
    // For YouTube iframe, we can't get currentTime, so just enable note taking
    setIsRecording(true)
    textareaRef.current?.focus()
  }

  const cancelRecording = () => {
    setIsRecording(false)
    setNewNote('')
    setCurrentTime(0)
  }

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="w-5 h-5" />
          Timestamp Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Note Creation Area */}
        <div className="space-y-3">
          {!isRecording ? (
            <Button
              onClick={startRecordingNote}
              className="w-full bg-bhutan-yellow hover:bg-bhutan-orange"
              size="lg"
            >
              <StickyNote className="w-4 h-4 mr-2" />
              Take Note at Current Time
            </Button>
          ) : (
            <div className="space-y-3 p-4 bg-secondary/30 rounded-lg border-2 border-bhutan-yellow">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  Timestamp: {formatTimestamp(currentTime)}
                </Badge>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelRecording}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveNote(newNote, currentTime)}
                    disabled={!newNote.trim()}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
              </div>

              <Textarea
                ref={textareaRef}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write your note here... (Video is paused)"
                className="min-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelRecording()
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    saveNote(newNote, currentTime)
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Press ⌘/Ctrl + Enter to save • Esc to cancel
              </p>
            </div>
          )}
        </div>

        {/* Notes List */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <StickyNote className="w-4 h-4" />
            Your Notes ({notes.length})
          </h3>

          <ScrollArea className="h-[400px]">
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <StickyNote className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No notes yet. Start taking notes while watching!</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-secondary/20 rounded-lg border border-border/40 hover:border-bhutan-yellow/50 transition-colors"
                  >
                    {editingNote === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-[60px] resize-none text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingNote(null)
                              setEditText('')
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateNote(note.id, editText)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Save className="w-3 h-3 mr-1" />
                            Update
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => jumpToTimestamp(note.timestamp || 0)}
                            className="font-mono text-xs h-7 px-2"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            {formatTimestamp(note.timestamp || 0)}
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreVertical className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingNote(note.id)
                                  setEditText(note.content)
                                }}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => deleteNote(note.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <p className="text-sm leading-relaxed">{note.content}</p>

                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}