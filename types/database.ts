/**
 * Database Type Definitions
 *
 * This file contains TypeScript types for the Supabase database schema.
 * Initially generated as a placeholder - will be replaced with auto-generated
 * types from Supabase after running: npx supabase gen types typescript --local > types/database.types.ts
 *
 * For now, these are basic interface definitions that will be expanded
 * once the complete database schema is implemented.
 */

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
      // User Management Tables
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          role: 'student' | 'teacher' | 'admin' | 'superadmin'
          institution_id: string | null
          phone: string | null
          metadata: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          avatar_url?: string | null
          role?: 'student' | 'teacher' | 'admin' | 'superadmin'
          institution_id?: string | null
          phone?: string | null
          metadata?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          role?: 'student' | 'teacher' | 'admin' | 'superadmin'
          institution_id?: string | null
          phone?: string | null
          metadata?: Json
          is_active?: boolean
          updated_at?: string
        }
      }
      institutions: {
        Row: {
          id: string
          name: string
          code: string
          domain: string | null
          logo_url: string | null
          settings: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          domain?: string | null
          logo_url?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          code?: string
          domain?: string | null
          logo_url?: string | null
          settings?: Json
          is_active?: boolean
          updated_at?: string
        }
      }
      // More tables will be added as we implement the complete schema
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'student' | 'teacher' | 'admin' | 'superadmin'
      enrollment_status: 'active' | 'completed' | 'dropped' | 'suspended'
      attendance_status: 'present' | 'absent' | 'late' | 'excused'
      quiz_attempt_status: 'pending' | 'in_progress' | 'submitted' | 'graded'
    }
  }
}

// Export common types for convenience
export type Tables = Database['public']['Tables']
export type Enums = Database['public']['Enums']