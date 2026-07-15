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
      announcements: {
        Row: {
          id: string
          title: string
          content: string
          priority: 'low' | 'medium' | 'high' | 'urgent'
          course_id: string | null
          is_global: boolean
          is_pinned: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          course_id?: string | null
          is_global?: boolean
          is_pinned?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          course_id?: string | null
          is_global?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
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
          published_at: string | null
          last_updated_at: string
          enrollment_count: number
          average_rating: number
          rating_count: number
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
          published_at?: string | null
          last_updated_at?: string
          enrollment_count?: number
          average_rating?: number
          rating_count?: number
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
          published_at?: string | null
          last_updated_at?: string
          enrollment_count?: number
          average_rating?: number
          rating_count?: number
          metadata?: Json
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
          last_accessed_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          enrolled_at?: string
          completed_at?: string | null
          progress_percentage?: number
          last_accessed_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          enrolled_at?: string
          completed_at?: string | null
          progress_percentage?: number
          last_accessed_at?: string
          updated_at?: string
        }
      }
      lesson_progress: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          completed: boolean
          completed_at: string | null
          time_spent_seconds: number
          last_accessed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          completed?: boolean
          completed_at?: string | null
          time_spent_seconds?: number
          last_accessed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          completed?: boolean
          completed_at?: string | null
          time_spent_seconds?: number
          last_accessed_at?: string
        }
      }
      lessons: {
        Row: {
          id: string
          module_id: string
          title: string
          description: string | null
          content: Json | null
          video_url: string | null
          duration_minutes: number
          order_index: number
          is_free: boolean
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          module_id: string
          title: string
          description?: string | null
          content?: Json | null
          video_url?: string | null
          duration_minutes?: number
          order_index?: number
          is_free?: boolean
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          module_id?: string
          title?: string
          description?: string | null
          content?: Json | null
          video_url?: string | null
          duration_minutes?: number
          order_index?: number
          is_free?: boolean
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      modules: {
        Row: {
          id: string
          course_id: string
          title: string
          description: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          description?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          description?: string | null
          order_index?: number
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
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          role: 'student' | 'instructor' | 'admin'
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'student' | 'instructor' | 'admin'
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'student' | 'instructor' | 'admin'
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          user_id: string
          course_id: string
          rating: number
          comment: string | null
          helpful_count: number
          not_helpful_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          rating: number
          comment?: string | null
          helpful_count?: number
          not_helpful_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          rating?: number
          comment?: string | null
          helpful_count?: number
          not_helpful_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      quiz_attempts: {
        Row: {
          id: string
          user_id: string
          quiz_id: string
          started_at: string
          completed_at: string
          score: number
          passed: boolean
          time_spent_seconds: number
          answers: Json
          feedback: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          quiz_id: string
          started_at?: string
          completed_at?: string
          score?: number
          passed?: boolean
          time_spent_seconds?: number
          answers?: Json
          feedback?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          quiz_id?: string
          started_at?: string
          completed_at?: string
          score?: number
          passed?: boolean
          time_spent_seconds?: number
          answers?: Json
          feedback?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      quiz_questions: {
        Row: {
          id: string
          quiz_id: string
          question_text: string
          question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
          options: string | null
          correct_answer: string | null
          explanation: string | null
          order_index: number
          points: number
        }
        Insert: {
          id?: string
          quiz_id: string
          question_text: string
          question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
          options?: string | null
          correct_answer?: string | null
          explanation?: string | null
          order_index?: number
          points?: number
        }
        Update: {
          id?: string
          quiz_id?: string
          question_text?: string
          question_type?: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
          options?: string | null
          correct_answer?: string | null
          explanation?: string | null
          order_index?: number
          points?: number
        }
      }
      quizzes: {
        Row: {
          id: string
          lesson_id: string
          title: string
          description: string | null
          time_limit_minutes: number
          passing_score: number
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          title: string
          description?: string | null
          time_limit_minutes?: number
          passing_score?: number
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          title?: string
          description?: string | null
          time_limit_minutes?: number
          passing_score?: number
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          email_notifications: boolean
          push_notifications: boolean
          course_updates: boolean
          announcement_notifications: boolean
          message_notifications: boolean
          theme: string
          language: string
          timezone: string
          profile_visibility: string
          show_progress: boolean
          show_certificates: boolean
          auto_play_video: boolean
          video_quality: string
          playback_speed: number
          subtitle_language: string
          digest_frequency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email_notifications?: boolean
          push_notifications?: boolean
          course_updates?: boolean
          announcement_notifications?: boolean
          message_notifications?: boolean
          theme?: string
          language?: string
          timezone?: string
          profile_visibility?: string
          show_progress?: boolean
          show_certificates?: boolean
          auto_play_video?: boolean
          video_quality?: string
          playback_speed?: number
          subtitle_language?: string
          digest_frequency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email_notifications?: boolean
          push_notifications?: boolean
          course_updates?: boolean
          announcement_notifications?: boolean
          message_notifications?: boolean
          theme?: string
          language?: string
          timezone?: string
          profile_visibility?: string
          show_progress?: boolean
          show_certificates?: boolean
          auto_play_video?: boolean
          video_quality?: string
          playback_speed?: number
          subtitle_language?: string
          digest_frequency?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}