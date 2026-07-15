'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Save,
  Trash2,
  Edit,
  Clock,
  Plus,
  MoreVertical,
  Calendar,
  Search,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

interface Note {
  id: string
  lessonId: string
  timestamp: number
  content: string
  createdAt: string
  updatedAt: string
}

interface TimestampNotesProps {
  lessonId: string
  videoRef?: React.RefObject<HTMLVideoElement>
  notes?: Note[]
  onSaveNote?: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void
  onUpdateNote?: (noteId: string, content: string) => void
  onDeleteNote?: (noteId: string) => void
}

export function TimestampNotes({
  lessonId,
  videoRef,
  notes: initialNotes = [],
  onSaveNote,
  onUpdateNote,
  onDeleteNote
}: TimestampNotesProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [newNote, setNewNote] = useState('')
  const [currentTimestamp, setCurrentTimestamp] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Update notes when initialNotes changes
  useEffect(() => {
    setNotes(initialNotes)
  }, [initialNotes])

  // Capture current timestamp when starting to type
  const handleStartNote = () => {
    if (videoRef?.current) {
      const currentTime = videoRef.current.currentTime
      setCurrentTimestamp(currentTime)
      setIsRecording(true)

      // Auto-pause video when taking notes
      if (!videoRef.current.paused) {
        videoRef.current.pause()
      }
    }
  }

  // Save note
  const handleSaveNote = () => {
    if (!newNote.trim()) return

    haptic()
    const note: Note = {
      id: crypto.randomUUID(),
      lessonId,
      timestamp: currentTimestamp,
      content: newNote.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setNotes(prev => [note, ...prev])
    setNewNote('')
    setIsRecording(false)

    // Resume video after saving
    if (videoRef?.current && videoRef.current.paused) {
      videoRef.current.play()
    }

    // Call parent save callback
    if (onSaveNote) {
      onSaveNote(note)
    }
  }

  // Cancel note creation
  const handleCancelNote = () => {
    setNewNote('')
    setIsRecording(false)

    // Resume video if it was paused for note-taking
    if (videoRef?.current && videoRef.current.paused) {
      videoRef.current.play()
    }
  }

  // Jump to timestamp
  const handleJumpToTimestamp = (timestamp: number) => {
    haptic()
    if (videoRef?.current) {
      videoRef.current.currentTime = timestamp
      if (videoRef.current.paused) {
        videoRef.current.play()
      }
    }
  }

  // Edit note
  const handleStartEdit = (note: Note) => {
    setEditingNote(note.id)
    setEditContent(note.content)
  }

  const handleSaveEdit = () => {
    if (!editingNote || !editContent.trim()) return

    haptic()
    setNotes(prev => prev.map(note =>
      note.id === editingNote
        ? { ...note, content: editContent.trim(), updatedAt: new Date().toISOString() }
        : note
    ))

    setEditingNote(null)
    setEditContent('')

    // Call parent update callback
    if (onUpdateNote) {
      onUpdateNote(editingNote, editContent.trim())
    }
  }

  const handleCancelEdit = () => {
    setEditingNote(null)
    setEditContent('')
  }

  // Delete note
  const handleDeleteNote = (noteId: string) => {
    haptic()
    setNotes(prev => prev.filter(note => note.id !== noteId))

    // Call parent delete callback
    if (onDeleteNote) {
      onDeleteNote(noteId)
    }
  }

  // Format timestamp to readable string
  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Format date to readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Filter notes based on search query
  const filteredNotes = notes.filter(note =>
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* Note Creation Area */}
      <Card className="glass-strong mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-bhutan-yellow" />
              Timestamp Notes
            </div>
            {isRecording && (
              <Badge variant="secondary" className="animate-pulse">
                <Clock className="w-3 h-3 mr-1" />
                {formatTimestamp(currentTimestamp)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Textarea
              placeholder={isRecording
                ? "Write your note at this timestamp..."
                : "Click here and start typing to capture a timestamp note..."
              }
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onFocus={handleStartNote}
              className={cn(
                "min-h-[100px] resize-none",
                isRecording && "border-primary bg-primary/5"
              )}
              disabled={!!editingNote}
            />
            {isRecording && newNote.length > 0 && (
              <div className="absolute bottom-2 right-2">
                <Badge variant="outline" className="text-xs">
                  {newNote.length} characters
                </Badge>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {isRecording
                ? "🎯 Recording mode: Video paused. Save note to resume playback."
                : "💡 Pro tip: Video auto-pauses when you start typing notes!"
              }
            </p>
            <div className="flex items-center gap-2">
              {isRecording && newNote.trim() && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelNote}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveNote}
                    className="bg-bhutan-yellow hover:bg-bhutan-orange"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save Note
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      {notes.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'No notes found' : 'No timestamp notes yet'}
              </h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Start typing above to create timestamped notes!'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-3 pr-4">
            {filteredNotes.map((note) => (
              <Card
                key={note.id}
                className={cn(
                  "glass hover:shadow-lg transition-all duration-200",
                  editingNote === note.id && "ring-2 ring-primary"
                )}
              >
                <CardContent className="p-4">
                  {editingNote === note.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Edit your note..."
                        className="min-h-[80px] resize-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          className="bg-bhutan-yellow hover:bg-bhutan-orange"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleJumpToTimestamp(note.timestamp)}
                                    className="h-7 px-2 font-mono text-xs touch-feedback"
                                  >
                                    <Clock className="w-3 h-3 mr-1" />
                                    {formatTimestamp(note.timestamp)}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Click to jump to {formatTimestamp(note.timestamp)} in video</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <Badge variant="secondary" className="text-xs">
                              <Calendar className="w-3 h-3 mr-1" />
                              {formatDate(note.updatedAt)}
                            </Badge>
                          </div>

                          <p className="text-sm leading-relaxed">{note.content}</p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 touch-feedback"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleStartEdit(note)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}