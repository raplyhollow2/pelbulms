'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Save, Trash2, Edit, Plus, X, Loader2 } from 'lucide-react'
import { haptic } from '@/lib/utils'

interface SimpleNote {
  id: string
  content: string
  created_at: string
  updated_at?: string
}

interface SimpleNotesProps {
  lessonId: string
  courseId: string
}

export function SimpleNotes({ lessonId, courseId }: SimpleNotesProps) {
  const [notes, setNotes] = useState<SimpleNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fetch notes on mount and when lessonId changes
  useEffect(() => {
    fetchNotes()
  }, [lessonId])

  const fetchNotes = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/notes?lessonId=${lessonId}`)
      const data = await response.json()
      if (response.ok) {
        setNotes(data.notes || [])
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Save new note
  const handleSaveNote = async () => {
    if (!newNote.trim()) return

    setSaving(true)

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          courseId,
          content: newNote.trim(),
          timestamp: 0 // Simplified - no timestamp
          // No userId - will be handled by backend or database
        })
      })

      if (response.ok) {
        const data = await response.json()
        setNotes([data, ...notes])
        setNewNote('')
      }
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setSaving(false)
    }
  }

  // Start editing
  const handleStartEdit = (note: SimpleNote) => {
    setEditingNote(note.id)
    setEditContent(note.content)
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingNote(null)
    setEditContent('')
  }

  // Save edit
  const handleSaveEdit = async (noteId: string) => {
    if (!editContent.trim()) return

    try {
      const response = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId,
          content: editContent.trim(),
          timestamp: 0
        })
      })

      if (response.ok) {
        const data = await response.json()
        setNotes(notes.map(note => note.id === noteId ? data : note))
        setEditingNote(null)
        setEditContent('')
      }
    } catch (error) {
      console.error('Error updating note:', error)
    }
  }

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const response = await fetch(`/api/notes?noteId=${noteId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setNotes(notes.filter(note => note.id !== noteId))
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Note Input */}
        <div className="space-y-3">
          <Textarea
            placeholder="Take notes here..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="min-h-[80px] resize-none"
            rows={3}
            disabled={saving}
          />
          <div className="flex justify-end gap-2">
            {newNote.trim() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewNote('')}
                disabled={saving}
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSaveNote}
              disabled={!newNote.trim() || saving}
              className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              {saving ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </div>

        {/* Notes List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            {notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notes yet. Start taking notes above!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-secondary/50 rounded-lg border border-border/50 hover:border-bhutan-yellow/30 transition-colors"
                  >
                    {editingNote === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[60px] resize-none"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(note.id)}
                            disabled={!editContent.trim()}
                            className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {note.content}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(note.created_at)}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleStartEdit(note)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteNote(note.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}