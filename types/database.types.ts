export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      courses: {
        Row: {
          id: string
          title: string
          slug: string
          description: string | null
          thumbnail_url: string | null
          instructor_id: string | null
          category: string
          level: string
          language: string
          price: number
          duration_minutes: number | null
          prerequisites: string[] | null
          learning_objectives: string[] | null
          requirements: string[] | null
          tags: string[] | null
          is_published: boolean
          is_featured: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          description?: string | null
          thumbnail_url?: string | null
          instructor_id?: string | null
          category: string
          level: string
          language: string
          price?: number
          duration_minutes?: number | null
          prerequisites?: string[] | null
          learning_objectives?: string[] | null
          requirements?: string[] | null
          tags?: string[] | null
          is_published?: boolean
          is_featured?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          description?: string | null
          thumbnail_url?: string | null
          instructor_id?: string | null
          category?: string
          level?: string
          language?: string
          price?: number
          duration_minutes?: number | null
          prerequisites?: string[] | null
          learning_objectives?: string[] | null
          requirements?: string[] | null
          tags?: string[] | null
          is_published?: boolean
          is_featured?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      lessons: {
        Row: {
          id: string
          module_id: string
          title: string
          description: string | null
          video_url: string | null
          video_duration: number | null
          transcript: string | null
          resources: string[] | null
          order_index: number
          is_published: boolean
          is_preview: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          module_id: string
          title: string
          description?: string | null
          video_url?: string | null
          video_duration?: number | null
          transcript?: string | null
          resources?: string[] | null
          order_index: number
          is_published?: boolean
          is_preview?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          module_id?: string
          title?: string
          description?: string | null
          video_url?: string | null
          video_duration?: number | null
          transcript?: string | null
          resources?: string[] | null
          order_index?: number
          is_published?: boolean
          is_preview?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          course_id: string
          content: string
          timestamp: number
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          course_id: string
          content: string
          timestamp?: number
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          course_id?: string
          content?: string
          timestamp?: number
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      enrollments: {
        Row: {
          id: string
          user_id: string
          course_id: string
          enrolled_at: string
          completed_at: string | null
          progress_percentage: number
          last_accessed_at: string | null
          status: string
          metadata: Json
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          enrolled_at?: string
          completed_at?: string | null
          progress_percentage?: number
          last_accessed_at?: string | null
          status?: string
          metadata?: Json
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          enrolled_at?: string
          completed_at?: string | null
          progress_percentage?: number
          last_accessed_at?: string | null
          status?: string
          metadata?: Json
          created_at?: string
          updated_at?: string | null
        }
      }
      lesson_progress: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          course_id: string
          completed: boolean
          completed_at: string | null
          progress_percentage: number
          last_position_seconds: number
          time_spent_seconds: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          course_id: string
          completed?: boolean
          completed_at?: string | null
          progress_percentage?: number
          last_position_seconds?: number
          time_spent_seconds?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          course_id?: string
          completed?: boolean
          completed_at?: string | null
          progress_percentage?: number
          last_position_seconds?: number
          time_spent_seconds?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      quizzes: {
        Row: {
          id: string
          lesson_id: string | null
          title: string
          description: string | null
          time_limit_minutes: number | null
          passing_score: number
          max_attempts: number
          is_published: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id?: string | null
          title: string
          description?: string | null
          time_limit_minutes?: number | null
          passing_score?: number
          max_attempts?: number
          is_published?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string | null
          title?: string
          description?: string | null
          time_limit_minutes?: number | null
          passing_score?: number
          max_attempts?: number
          is_published?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      quiz_questions: {
        Row: {
          id: string
          quiz_id: string
          question_text: string
          question_type: string
          options: string | null
          correct_answer: string | null
          explanation: string | null
          order_index: number
          points: number
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          question_text: string
          question_type?: string
          options?: string | null
          correct_answer?: string | null
          explanation?: string | null
          order_index: number
          points?: number
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          question_text?: string
          question_type?: string
          options?: string | null
          correct_answer?: string | null
          explanation?: string | null
          order_index?: number
          points?: number
          metadata?: Json
          created_at?: string
        }
      }
      quiz_attempts: {
        Row: {
          id: string
          user_id: string
          quiz_id: string
          enrollment_id: string | null
          started_at: string
          completed_at: string | null
          score: number | null
          passed: boolean
          time_spent_seconds: number | null
          answers: Json | null
          feedback: Json | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          quiz_id: string
          enrollment_id?: string | null
          started_at?: string
          completed_at?: string | null
          score?: number | null
          passed?: boolean
          time_spent_seconds?: number | null
          answers?: Json | null
          feedback?: Json | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          quiz_id?: string
          enrollment_id?: string | null
          started_at?: string
          completed_at?: string | null
          score?: number | null
          passed?: boolean
          time_spent_seconds?: number | null
          answers?: Json | null
          feedback?: Json | null
          metadata?: Json
          created_at?: string
        }
      }
      modules: {
        Row: {
          id: string
          course_id: string
          title: string
          description: string | null
          order_index: number
          is_published: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          description?: string | null
          order_index: number
          is_published?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          description?: string | null
          order_index?: number
          is_published?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          role: string
          institution_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          role?: string
          institution_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          role?: string
          institution_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}