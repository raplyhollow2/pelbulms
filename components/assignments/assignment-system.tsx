// @ts-nocheck - Supabase type inference issues documented in TYPESCRIPT_ISSUES.md
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Upload,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Star,
  MessageSquare,
  Trash2,
  Plus,
  Save,
  Eye,
  Sparkles,
  BarChart3,
  Users,
  TrendingUp
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface Assignment {
  id: string
  title: string
  description: string
  course_id: string
  module_id: string
  due_date: string
  max_points: number
  submission_type: 'text' | 'file' | 'link' | 'code'
  allowed_file_types?: string[]
  max_file_size?: number
  instructions?: string
  rubric?: RubricCriteria[]
  created_by: string
  created_at: string
}

interface RubricCriteria {
  id: string
  description: string
  max_points: number
  weight: number
}

interface Submission {
  id: string
  assignment_id: string
  user_id: string
  content?: string
  file_url?: string
  link_url?: string
  submitted_at: string
  status: 'pending' | 'submitted' | 'graded' | 'returned'
  grade?: number
  feedback?: string
  ai_score?: number
  plagiarism_score?: number
  late_submission: boolean
}

interface AssignmentAnalytics {
  total_submissions: number
  on_time_submissions: number
  late_submissions: number
  average_grade: number
  average_ai_score: number
  plagiarism_flags: number
  graded_submissions: number
  pending_grading: number
}

export function AssignmentSystem() {
  const [activeTab, setActiveTab] = useState<'view' | 'create' | 'grade' | 'analytics'>('view')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newAssignment, setNewAssignment] = useState<Partial<Assignment>>({
    submission_type: 'text',
    max_points: 100,
    rubric: []
  })
  const [submissionContent, setSubmissionContent] = useState('')
  const [fileToUpload, setFileToUpload] = useState<File | null>(null)
  const [analytics, setAnalytics] = useState<AssignmentAnalytics | null>(null)
  const [userRole, setUserRole] = useState<'student' | 'instructor' | 'admin'>('instructor')
  const [isUploading, setIsUploading] = useState(false)
  const [isGrading, setIsGrading] = useState(false)

  useEffect(() => {
    fetchAssignments()
    fetchSubmissions()
    fetchAnalytics()
  }, [])

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .order('due_date', { ascending: true })

    if (!error && data) {
      setAssignments(data as Assignment[])
    }
  }

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })

    if (!error && data) {
      setSubmissions(data as Submission[])
    }
  }

  const fetchAnalytics = async () => {
    // Mock analytics data
    setAnalytics({
      total_submissions: 45,
      on_time_submissions: 38,
      late_submissions: 7,
      average_grade: 78,
      average_ai_score: 82,
      plagiarism_flags: 3,
      graded_submissions: 32,
      pending_grading: 13
    })
  }

  const createAssignment = async () => {
    const assignment: Partial<Assignment> = {
      ...newAssignment,
      created_at: new Date().toISOString(),
      created_by: 'current-user'
    }

    const { error } = await supabase
      .from('assignments')
      .insert(assignment)

    if (!error) {
      setIsCreating(false)
      fetchAssignments()
      setNewAssignment({
        submission_type: 'text',
        max_points: 100,
        rubric: []
      })
    }
  }

  const submitAssignment = async (assignmentId: string) => {
    setIsUploading(true)

    try {
      let fileUrl = null

      if (fileToUpload) {
        // Upload file to Supabase Storage
        const fileExt = fileToUpload.name.split('.').pop()
        const fileName = `${assignmentId}/${Date.now()}.${fileExt}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('assignment-submissions')
          .upload(fileName, fileToUpload)

        if (uploadError) throw uploadError

        fileUrl = uploadData.path
      }

      const submission: Partial<Submission> = {
        assignment_id: assignmentId,
        user_id: 'current-user',
        content: submissionContent,
        file_url: fileUrl,
        submitted_at: new Date().toISOString(),
        status: 'submitted'
      }

      const { error } = await supabase
        .from('assignment_submissions')
        .insert(submission)

      if (error) throw error

      // Trigger AI analysis
      await triggerAIAnalysis(submission)

      fetchSubmissions()
      setSubmissionContent('')
      setFileToUpload(null)

    } catch (error) {
      console.error('Submission failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const triggerAIAnalysis = async (submission: Partial<Submission>) => {
    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 2000))

    const aiScore = Math.floor(Math.random() * 20) + 80
    const plagiarismScore = Math.floor(Math.random() * 15)

    await supabase
      .from('assignment_submissions')
      .update({
        ai_score: aiScore,
        plagiarism_score: plagiarismScore
      })
      .eq('id', submission.id)

    fetchSubmissions()
  }

  const gradeSubmission = async (submissionId: string, grade: number, feedback: string) => {
    setIsGrading(true)

    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          grade,
          feedback,
          status: 'graded'
        })
        .eq('id', submissionId)

      if (error) throw error

      fetchSubmissions()
      fetchAnalytics()

    } catch (error) {
      console.error('Grading failed:', error)
    } finally {
      setIsGrading(false)
    }
  }

  const addRubricCriteria = () => {
    const newCriteria: RubricCriteria = {
      id: crypto.randomUUID(),
      description: 'New criteria',
      max_points: 10,
      weight: 1
    }

    setNewAssignment(prev => ({
      ...prev,
      rubric: [...(prev.rubric || []), newCriteria]
    }))
  }

  const updateRubricCriteria = (criteriaId: string, updates: Partial<RubricCriteria>) => {
    setNewAssignment(prev => ({
      ...prev,
      rubric: prev.rubric?.map(criteria =>
        criteria.id === criteriaId ? { ...criteria, ...updates } : criteria
      ) || []
    }))
  }

  const removeRubricCriteria = (criteriaId: string) => {
    setNewAssignment(prev => ({
      ...prev,
      rubric: prev.rubric?.filter(criteria => criteria.id !== criteriaId) || []
    }))
  }

  const getDueDateStatus = (dueDate: string) => {
    const now = new Date()
    const due = new Date(dueDate)
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilDue < 0) {
      return { status: 'overdue', color: 'destructive', text: 'Overdue' }
    } else if (daysUntilDue === 0) {
      return { status: 'today', color: 'default', text: 'Due today' }
    } else if (daysUntilDue === 1) {
      return { status: 'tomorrow', color: 'secondary', text: 'Due tomorrow' }
    } else if (daysUntilDue <= 7) {
      return { status: 'week', color: 'outline', text: `${daysUntilDue} days left` }
    } else {
      return { status: 'future', color: 'outline', text: `${daysUntilDue} days left` }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Assignment System</h2>
          <p className="text-gray-600 dark:text-gray-400">Create, submit, and grade assignments with AI assistance</p>
        </div>
        {userRole === 'instructor' && (
          <Button onClick={() => setIsCreating(true)} size="lg">
            <Plus className="w-4 h-4 mr-2" />
            Create Assignment
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="view">Assignments</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="grade">Grade</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* View Assignments Tab */}
        <TabsContent value="view" className="space-y-4">
          {assignments.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No assignments available</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {assignments.map(assignment => {
                const dueStatus = getDueDateStatus(assignment.due_date)
                const submission = submissions.find(s => s.assignment_id === assignment.id && s.user_id === 'current-user')

                return (
                  <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl">{assignment.title}</CardTitle>
                          <CardDescription className="mt-2">{assignment.description}</CardDescription>
                        </div>
                        <Badge variant={dueStatus.color as any}>{dueStatus.text}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(assignment.due_date).toLocaleDateString()}
                        </Badge>
                        <Badge variant="outline">
                          <Star className="w-3 h-3 mr-1" />
                          {assignment.max_points} points
                        </Badge>
                        <Badge variant="outline">
                          {assignment.submission_type}
                        </Badge>
                      </div>

                      {submission ? (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <div>
                                <p className="font-medium text-green-900 dark:text-green-300">Submitted</p>
                                <p className="text-sm text-green-700 dark:text-green-400">
                                  {new Date(submission.submitted_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            {submission.grade !== undefined && (
                              <Badge className="bg-green-600">
                                {submission.grade}/{assignment.max_points}
                              </Badge>
                            )}
                          </div>
                          {submission.feedback && (
                            <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded">
                              <div className="flex items-center gap-2 text-sm">
                                <MessageSquare className="w-4 h-4" />
                                <span className="font-medium">Feedback:</span>
                              </div>
                              <p className="text-sm mt-1">{submission.feedback}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          onClick={() => setSelectedAssignment(assignment)}
                          className="w-full"
                          size="lg"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Submit Assignment
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Submission Modal */}
          {selectedAssignment && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle>Submit Assignment: {selectedAssignment.title}</CardTitle>
                <CardDescription>Due: {new Date(selectedAssignment.due_date).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedAssignment.submission_type === 'text' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your Answer</label>
                    <Textarea
                      placeholder="Write your answer here..."
                      value={submissionContent}
                      onChange={(e) => setSubmissionContent(e.target.value)}
                      className="min-h-48"
                    />
                  </div>
                )}

                {selectedAssignment.submission_type === 'file' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Upload File</label>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <input
                        type="file"
                        onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          {fileToUpload ? fileToUpload.name : 'Click to upload or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedAssignment.allowed_file_types?.join(', ') || 'Any file type'}
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                {selectedAssignment.submission_type === 'link' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Submission Link</label>
                    <Input
                      placeholder="https://..."
                      value={submissionContent}
                      onChange={(e) => setSubmissionContent(e.target.value)}
                    />
                  </div>
                )}

                {selectedAssignment.submission_type === 'code' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Code Submission</label>
                    <Textarea
                      placeholder="// Paste your code here..."
                      value={submissionContent}
                      onChange={(e) => setSubmissionContent(e.target.value)}
                      className="min-h-48 font-mono"
                    />
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    onClick={() => {
                      submitAssignment(selectedAssignment.id)
                      setSelectedAssignment(null)
                    }}
                    disabled={isUploading || (!submissionContent && !fileToUpload)}
                    className="flex-1"
                  >
                    {isUploading ? (
                      <>Submitting...</>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Submit
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedAssignment(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Create Assignment Tab */}
        <TabsContent value="create" className="space-y-4">
          {!isCreating ? (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">Create New Assignment</h3>
                <p className="text-gray-500 mb-4">Build custom assignments with rubrics and AI grading</p>
                <Button onClick={() => setIsCreating(true)} size="lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Start Creating
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Create Assignment</CardTitle>
                <CardDescription>Build your assignment with custom submission types and rubrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assignment Title</label>
                  <Input
                    placeholder="Enter assignment title"
                    value={newAssignment.title || ''}
                    onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Describe the assignment requirements..."
                    value={newAssignment.description || ''}
                    onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Submission Type</label>
                    <Select
                      value={newAssignment.submission_type}
                      onValueChange={(value) => setNewAssignment({ ...newAssignment, submission_type: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text Response</SelectItem>
                        <SelectItem value="file">File Upload</SelectItem>
                        <SelectItem value="link">Link Submission</SelectItem>
                        <SelectItem value="code">Code Submission</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Maximum Points</label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={newAssignment.max_points || ''}
                      onChange={(e) => setNewAssignment({ ...newAssignment, max_points: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Due Date</label>
                  <Input
                    type="datetime-local"
                    value={newAssignment.due_date || ''}
                    onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Instructions (Optional)</label>
                  <Textarea
                    placeholder="Provide detailed instructions for students..."
                    value={newAssignment.instructions || ''}
                    onChange={(e) => setNewAssignment({ ...newAssignment, instructions: e.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Grading Rubric</label>
                    <Button size="sm" onClick={addRubricCriteria}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Criteria
                    </Button>
                  </div>
                  {newAssignment.rubric?.map((criteria, index) => (
                    <div key={criteria.id} className="flex items-center gap-2 p-3 border rounded-lg">
                      <span className="font-medium">{index + 1}.</span>
                      <Input
                        placeholder="Criteria description"
                        value={criteria.description}
                        onChange={(e) => updateRubricCriteria(criteria.id, { description: e.target.value })}
                        className="flex-1"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Points"
                          value={criteria.max_points}
                          onChange={(e) => updateRubricCriteria(criteria.id, { max_points: parseInt(e.target.value) })}
                          className="w-20"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeRubricCriteria(criteria.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={createAssignment}
                    disabled={!newAssignment.title || !newAssignment.description}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Create Assignment
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreating(false)
                      setNewAssignment({ submission_type: 'text', max_points: 100, rubric: [] })
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Grade Submissions Tab */}
        <TabsContent value="grade" className="space-y-4">
          {submissions.filter(s => s.status === 'submitted' || s.status === 'pending').length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No submissions to grade</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {submissions
                .filter(s => s.status === 'submitted' || s.status === 'pending')
                .map(submission => {
                  const assignment = assignments.find(a => a.id === submission.assignment_id)
                  if (!assignment) return null

                  return (
                    <Card key={submission.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle>{assignment.title}</CardTitle>
                            <CardDescription>
                              Submitted: {new Date(submission.submitted_at).toLocaleString()}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            {submission.ai_score && (
                              <Badge variant="secondary">
                                <Sparkles className="w-3 h-3 mr-1" />
                                AI: {submission.ai_score}%
                              </Badge>
                            )}
                            {submission.plagiarism_score !== undefined && submission.plagiarism_score > 20 && (
                              <Badge variant="destructive">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Plagiarism: {submission.plagiarism_score}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                          <p className="font-medium mb-2">Submission Content:</p>
                          <p className="text-sm whitespace-pre-wrap">{submission.content}</p>
                          {submission.file_url && (
                            <Button size="sm" variant="outline" className="mt-2">
                              <Download className="w-4 h-4 mr-1" />
                              View File
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Grade (0-{assignment.max_points})</label>
                            <Input
                              type="number"
                              placeholder="Enter grade"
                              max={assignment.max_points}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Use AI Score</label>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                if (submission.ai_score) {
                                  const aiGrade = Math.round((submission.ai_score / 100) * assignment.max_points)
                                  // Set the grade input value
                                }
                              }}
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Apply AI Score ({submission.ai_score}%)
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Feedback</label>
                          <Textarea
                            placeholder="Provide detailed feedback to the student..."
                            rows={4}
                          />
                        </div>

                        <Button
                          onClick={() => gradeSubmission(submission.id, 0, '')}
                          disabled={isGrading}
                          className="w-full"
                        >
                          {isGrading ? (
                            <>Grading...</>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Submit Grade
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {analytics ? (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.total_submissions}</div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>{analytics.on_time_submissions} on time</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Average Grade</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.average_grade}%</div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>AI: {analytics.average_ai_score}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Pending Grading</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.pending_grading}</div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span>Awaiting review</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Plagiarism Flags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.plagiarism_flags}</div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>Need review</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Grading Progress</CardTitle>
                  <CardDescription>Track your grading progress across all assignments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Overall Progress</span>
                        <span className="text-sm text-gray-500">
                          {analytics.graded_submissions}/{analytics.total_submissions}
                        </span>
                      </div>
                      <Progress
                        value={(analytics.graded_submissions / analytics.total_submissions) * 100}
                        className="h-2"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
                        <p className="font-medium text-green-900 dark:text-green-300">On Time</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                          {analytics.on_time_submissions}
                        </p>
                      </div>
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded">
                        <p className="font-medium text-orange-900 dark:text-orange-300">Late</p>
                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                          {analytics.late_submissions}
                        </p>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <p className="font-medium text-blue-900 dark:text-blue-300">Avg Grade</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                          {analytics.average_grade}%
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No analytics data available</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}