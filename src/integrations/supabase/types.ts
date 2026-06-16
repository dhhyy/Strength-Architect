export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          content: string
          created_at: string
          id: string
          is_published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      athlete_active_template: {
        Row: {
          athlete_id: string
          created_at: string
          current_week: number
          id: string
          is_active: boolean
          start_date: string
          template_id: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          current_week?: number
          id?: string
          is_active?: boolean
          start_date?: string
          template_id: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          current_week?: number
          id?: string
          is_active?: boolean
          start_date?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_active_template_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_active_template_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "routine_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_lifts: {
        Row: {
          athlete_id: string
          created_at: string
          e1rm: number
          id: string
          is_current: boolean
          lift_type: Database["public"]["Enums"]["lift_type"]
          recorded_date: string
          reps: number
          weight_lifted: number
        }
        Insert: {
          athlete_id: string
          created_at?: string
          e1rm: number
          id?: string
          is_current?: boolean
          lift_type: Database["public"]["Enums"]["lift_type"]
          recorded_date?: string
          reps: number
          weight_lifted: number
        }
        Update: {
          athlete_id?: string
          created_at?: string
          e1rm?: number
          id?: string
          is_current?: boolean
          lift_type?: Database["public"]["Enums"]["lift_type"]
          recorded_date?: string
          reps?: number
          weight_lifted?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_lifts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_preferences: {
        Row: {
          athlete_assigned_routine_id: string | null
          athlete_id: string
          created_at: string
          desired_lifting_days: number
          preferred_lifting_weekdays: number[]
          priority_lifts: string[]
          routine_assignment_source: string | null
          season_phase: string
          selected_routine_type: string | null
          selected_template_id: string | null
          sport_training_load: string
          updated_at: string
        }
        Insert: {
          athlete_assigned_routine_id?: string | null
          athlete_id: string
          created_at?: string
          desired_lifting_days?: number
          preferred_lifting_weekdays?: number[]
          priority_lifts?: string[]
          routine_assignment_source?: string | null
          season_phase?: string
          selected_routine_type?: string | null
          selected_template_id?: string | null
          sport_training_load?: string
          updated_at?: string
        }
        Update: {
          athlete_assigned_routine_id?: string | null
          athlete_id?: string
          created_at?: string
          desired_lifting_days?: number
          preferred_lifting_weekdays?: number[]
          priority_lifts?: string[]
          routine_assignment_source?: string | null
          season_phase?: string
          selected_routine_type?: string | null
          selected_template_id?: string | null
          sport_training_load?: string
          updated_at?: string
        }
        Relationships: []
      }
      athlete_routine_assignments: {
        Row: {
          assignment_source: string
          athlete_id: string
          competition_date: string | null
          competition_weeks_out: number | null
          created_at: string
          current_goal: string | null
          current_week: number
          days_per_week: number
          desired_lifting_days: number | null
          duration_weeks: number
          goal_type: string | null
          id: string
          is_active: boolean
          main_goal: string | null
          main_prescription_preference: string | null
          main_rep_high: number | null
          main_rep_low: number | null
          preferred_weekdays: number[] | null
          priority_focus_1: string | null
          priority_focus_2: string | null
          priority_focus_3: string | null
          priority_lifts: string[]
          routine_type: string | null
          season_phase: string | null
          snapshot: Json
          source_template_id: string | null
          split_type: string
          sport_training_load: string | null
          sport_training_stress_level: string | null
          start_date: string
          strength_training_tolerance: string | null
          target_rep_zone: string | null
          updated_at: string
          weekday_map: Json
          weekly_program_mode: string | null
        }
        Insert: {
          assignment_source?: string
          athlete_id: string
          competition_date?: string | null
          competition_weeks_out?: number | null
          created_at?: string
          current_goal?: string | null
          current_week?: number
          days_per_week: number
          desired_lifting_days?: number | null
          duration_weeks?: number
          goal_type?: string | null
          id?: string
          is_active?: boolean
          main_goal?: string | null
          main_prescription_preference?: string | null
          main_rep_high?: number | null
          main_rep_low?: number | null
          preferred_weekdays?: number[] | null
          priority_focus_1?: string | null
          priority_focus_2?: string | null
          priority_focus_3?: string | null
          priority_lifts?: string[]
          routine_type?: string | null
          season_phase?: string | null
          snapshot?: Json
          source_template_id?: string | null
          split_type: string
          sport_training_load?: string | null
          sport_training_stress_level?: string | null
          start_date?: string
          strength_training_tolerance?: string | null
          target_rep_zone?: string | null
          updated_at?: string
          weekday_map?: Json
          weekly_program_mode?: string | null
        }
        Update: {
          assignment_source?: string
          athlete_id?: string
          competition_date?: string | null
          competition_weeks_out?: number | null
          created_at?: string
          current_goal?: string | null
          current_week?: number
          days_per_week?: number
          desired_lifting_days?: number | null
          duration_weeks?: number
          goal_type?: string | null
          id?: string
          is_active?: boolean
          main_goal?: string | null
          main_prescription_preference?: string | null
          main_rep_high?: number | null
          main_rep_low?: number | null
          preferred_weekdays?: number[] | null
          priority_focus_1?: string | null
          priority_focus_2?: string | null
          priority_focus_3?: string | null
          priority_lifts?: string[]
          routine_type?: string | null
          season_phase?: string | null
          snapshot?: Json
          source_template_id?: string | null
          split_type?: string
          sport_training_load?: string | null
          sport_training_stress_level?: string | null
          start_date?: string
          strength_training_tolerance?: string | null
          target_rep_zone?: string | null
          updated_at?: string
          weekday_map?: Json
          weekly_program_mode?: string | null
        }
        Relationships: []
      }
      board_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "board_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      board_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_best: boolean
          is_hidden: boolean
          likes_count: number
          parent_comment_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_best?: boolean
          is_hidden?: boolean
          likes_count?: number
          parent_comment_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_best?: boolean
          is_hidden?: boolean
          likes_count?: number
          parent_comment_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "board_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      board_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      board_posts: {
        Row: {
          author_id: string
          category: Database["public"]["Enums"]["board_category"]
          comments_count: number
          content: string
          created_at: string
          id: string
          images: string[]
          is_faq: boolean
          is_hidden: boolean
          is_pinned: boolean
          is_resolved: boolean
          likes_count: number
          reports_count: number
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          author_id: string
          category?: Database["public"]["Enums"]["board_category"]
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          images?: string[]
          is_faq?: boolean
          is_hidden?: boolean
          is_pinned?: boolean
          is_resolved?: boolean
          likes_count?: number
          reports_count?: number
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          author_id?: string
          category?: Database["public"]["Enums"]["board_category"]
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          images?: string[]
          is_faq?: boolean
          is_hidden?: boolean
          is_pinned?: boolean
          is_resolved?: boolean
          likes_count?: number
          reports_count?: number
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      board_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: []
      }
      coach_notes: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string
          id: string
          note: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_notes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_notes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          athlete_id: string | null
          competition_date: string
          competition_name: string
          created_at: string
          id: string
          importance: Database["public"]["Enums"]["comp_importance"]
          team_id: string | null
        }
        Insert: {
          athlete_id?: string | null
          competition_date: string
          competition_name: string
          created_at?: string
          id?: string
          importance?: Database["public"]["Enums"]["comp_importance"]
          team_id?: string | null
        }
        Update: {
          athlete_id?: string | null
          competition_date?: string
          competition_name?: string
          created_at?: string
          id?: string
          importance?: Database["public"]["Enums"]["comp_importance"]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          athlete_id: string
          condition: string | null
          created_at: string
          date: string
          fatigue_level: number
          id: string
          note: string | null
          sport_intensity: number
        }
        Insert: {
          athlete_id: string
          condition?: string | null
          created_at?: string
          date?: string
          fatigue_level: number
          id?: string
          note?: string | null
          sport_intensity: number
        }
        Update: {
          athlete_id?: string
          condition?: string | null
          created_at?: string
          date?: string
          fatigue_level?: number
          id?: string
          note?: string | null
          sport_intensity?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_routines: {
        Row: {
          adjusted_data: Json
          athlete_id: string
          created_at: string
          date: string
          executed_date: string | null
          id: string
          is_modified: boolean
          planned_date: string | null
          template_day_id: string | null
          updated_at: string
        }
        Insert: {
          adjusted_data?: Json
          athlete_id: string
          created_at?: string
          date?: string
          executed_date?: string | null
          id?: string
          is_modified?: boolean
          planned_date?: string | null
          template_day_id?: string | null
          updated_at?: string
        }
        Update: {
          adjusted_data?: Json
          athlete_id?: string
          created_at?: string
          date?: string
          executed_date?: string | null
          id?: string
          is_modified?: boolean
          planned_date?: string | null
          template_day_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      exercise_library: {
        Row: {
          body_part: Database["public"]["Enums"]["body_part"]
          created_at: string
          description: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          exercise_name: string
          id: string
          is_main_lift: boolean
          thumbnail_url: string | null
          youtube_url: string | null
          youtube_video_id: string | null
        }
        Insert: {
          body_part: Database["public"]["Enums"]["body_part"]
          created_at?: string
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          exercise_name: string
          id?: string
          is_main_lift?: boolean
          thumbnail_url?: string | null
          youtube_url?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          body_part?: Database["public"]["Enums"]["body_part"]
          created_at?: string
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          exercise_name?: string
          id?: string
          is_main_lift?: boolean
          thumbnail_url?: string | null
          youtube_url?: string | null
          youtube_video_id?: string | null
        }
        Relationships: []
      }
      lifestyle_checks: {
        Row: {
          athlete_id: string
          checked: boolean
          created_at: string
          date: string
          habit_id: string
          id: string
        }
        Insert: {
          athlete_id: string
          checked?: boolean
          created_at?: string
          date?: string
          habit_id: string
          id?: string
        }
        Update: {
          athlete_id?: string
          checked?: boolean
          created_at?: string
          date?: string
          habit_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifestyle_checks_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifestyle_checks_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "lifestyle_habits"
            referencedColumns: ["id"]
          },
        ]
      }
      lifestyle_habits: {
        Row: {
          athlete_id: string
          created_at: string
          habit_name: string
          icon: string
          id: string
          is_active: boolean
          order_index: number
        }
        Insert: {
          athlete_id: string
          created_at?: string
          habit_name: string
          icon?: string
          id?: string
          is_active?: boolean
          order_index?: number
        }
        Update: {
          athlete_id?: string
          created_at?: string
          habit_name?: string
          icon?: string
          id?: string
          is_active?: boolean
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "lifestyle_habits_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lifestyle_recommendations: {
        Row: {
          content_type: string
          created_at: string
          description: string
          id: string
          is_published: boolean
          order_index: number
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          content_type?: string
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          order_index?: number
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          order_index?: number
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      neural_budget_daily: {
        Row: {
          athlete_id: string
          created_at: string
          date: string
          id: string
          sport_score: number
          total_score: number
          updated_at: string
          weight_score: number
        }
        Insert: {
          athlete_id: string
          created_at?: string
          date?: string
          id?: string
          sport_score?: number
          total_score?: number
          updated_at?: string
          weight_score?: number
        }
        Update: {
          athlete_id?: string
          created_at?: string
          date?: string
          id?: string
          sport_score?: number
          total_score?: number
          updated_at?: string
          weight_score?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          bodyweight: number | null
          created_at: string
          gender: string | null
          height_cm: number | null
          id: string
          is_admin: boolean
          name: string
          role: Database["public"]["Enums"]["user_role"]
          sport: string | null
        }
        Insert: {
          age?: number | null
          bodyweight?: number | null
          created_at?: string
          gender?: string | null
          height_cm?: number | null
          id: string
          is_admin?: boolean
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          sport?: string | null
        }
        Update: {
          age?: number | null
          bodyweight?: number | null
          created_at?: string
          gender?: string | null
          height_cm?: number | null
          id?: string
          is_admin?: boolean
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          sport?: string | null
        }
        Relationships: []
      }
      qna_answer_likes: {
        Row: {
          answer_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qna_answer_likes_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "qna_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qna_answer_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qna_answers: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_best: boolean
          likes_count: number
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_best?: boolean
          likes_count?: number
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_best?: boolean
          likes_count?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qna_answers_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qna_answers_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "qna_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      qna_posts: {
        Row: {
          author_id: string
          category: Database["public"]["Enums"]["qna_category"]
          content: string
          created_at: string
          id: string
          is_resolved: boolean
          title: string
          views_count: number
        }
        Insert: {
          author_id: string
          category?: Database["public"]["Enums"]["qna_category"]
          content: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          title: string
          views_count?: number
        }
        Update: {
          author_id?: string
          category?: Database["public"]["Enums"]["qna_category"]
          content?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          title?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "qna_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_templates: {
        Row: {
          created_at: string
          created_by: string | null
          days_per_week: number
          description: string | null
          difficulty_level: Database["public"]["Enums"]["difficulty_level"]
          duration_weeks: number
          id: string
          is_public: boolean
          split_type: Database["public"]["Enums"]["split_type"]
          target_audience: string | null
          template_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days_per_week?: number
          description?: string | null
          difficulty_level?: Database["public"]["Enums"]["difficulty_level"]
          duration_weeks?: number
          id?: string
          is_public?: boolean
          split_type?: Database["public"]["Enums"]["split_type"]
          target_audience?: string | null
          template_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days_per_week?: number
          description?: string | null
          difficulty_level?: Database["public"]["Enums"]["difficulty_level"]
          duration_weeks?: number
          id?: string
          is_public?: boolean
          split_type?: Database["public"]["Enums"]["split_type"]
          target_audience?: string | null
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_announcements: {
        Row: {
          coach_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          team_id: string
          title: string
        }
        Insert: {
          coach_id: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          team_id: string
          title: string
        }
        Update: {
          coach_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          athlete_id: string
          id: string
          is_active: boolean
          joined_at: string
          team_id: string
        }
        Insert: {
          athlete_id: string
          id?: string
          is_active?: boolean
          joined_at?: string
          team_id: string
        }
        Update: {
          athlete_id?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          invite_code: string
          sport: string | null
          team_name: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          invite_code?: string
          sport?: string | null
          team_name: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          invite_code?: string
          sport?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          athlete_id: string
          id: string
          template_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          athlete_id: string
          id?: string
          template_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          athlete_id?: string
          id?: string
          template_id?: string
        }
        Relationships: []
      }
      template_days: {
        Row: {
          day_of_week: number
          day_title: string
          id: string
          is_rest_day: boolean
          template_id: string
          week_number: number
        }
        Insert: {
          day_of_week: number
          day_title?: string
          id?: string
          is_rest_day?: boolean
          template_id: string
          week_number: number
        }
        Update: {
          day_of_week?: number
          day_title?: string
          id?: string
          is_rest_day?: boolean
          template_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_days_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "routine_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_exercises: {
        Row: {
          base_intensity_percent: number | null
          base_reps: number
          base_sets: number
          exercise_name: string
          fixed_weight: number | null
          id: string
          lift_type: Database["public"]["Enums"]["lift_type"]
          note: string | null
          order_index: number
          priority: number
          template_day_id: string
        }
        Insert: {
          base_intensity_percent?: number | null
          base_reps?: number
          base_sets?: number
          exercise_name: string
          fixed_weight?: number | null
          id?: string
          lift_type: Database["public"]["Enums"]["lift_type"]
          note?: string | null
          order_index?: number
          priority?: number
          template_day_id: string
        }
        Update: {
          base_intensity_percent?: number | null
          base_reps?: number
          base_sets?: number
          exercise_name?: string
          fixed_weight?: number | null
          id?: string
          lift_type?: Database["public"]["Enums"]["lift_type"]
          note?: string | null
          order_index?: number
          priority?: number
          template_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_exercises_template_day_id_fkey"
            columns: ["template_day_id"]
            isOneToOne: false
            referencedRelation: "template_days"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          access_expires_at: string | null
          admin_override_reason: string | null
          created_at: string
          is_admin_override: boolean
          last_access_check_at: string | null
          paid_plan_type: string | null
          payment_provider: string | null
          payment_status: string | null
          subscription_status: string
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_expires_at?: string | null
          admin_override_reason?: string | null
          created_at?: string
          is_admin_override?: boolean
          last_access_check_at?: string | null
          paid_plan_type?: string | null
          payment_provider?: string | null
          payment_status?: string | null
          subscription_status?: string
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_expires_at?: string | null
          admin_override_reason?: string | null
          created_at?: string
          is_admin_override?: boolean
          last_access_check_at?: string | null
          paid_plan_type?: string | null
          payment_provider?: string | null
          payment_status?: string | null
          subscription_status?: string
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          actual_reps: number | null
          actual_sets: number | null
          actual_weight: number | null
          athlete_id: string
          completed: boolean
          created_at: string
          date: string
          exercise_name: string
          id: string
          note: string | null
          planned_reps: number
          planned_sets: number
          planned_weight: number
          rpe: number | null
          set_logs: Json
          skipped: boolean
          sport_training_done: boolean
          template_exercise_id: string | null
        }
        Insert: {
          actual_reps?: number | null
          actual_sets?: number | null
          actual_weight?: number | null
          athlete_id: string
          completed?: boolean
          created_at?: string
          date?: string
          exercise_name: string
          id?: string
          note?: string | null
          planned_reps: number
          planned_sets: number
          planned_weight: number
          rpe?: number | null
          set_logs?: Json
          skipped?: boolean
          sport_training_done?: boolean
          template_exercise_id?: string | null
        }
        Update: {
          actual_reps?: number | null
          actual_sets?: number | null
          actual_weight?: number | null
          athlete_id?: string
          completed?: boolean
          created_at?: string
          date?: string
          exercise_name?: string
          id?: string
          note?: string | null
          planned_reps?: number
          planned_sets?: number
          planned_weight?: number
          rpe?: number | null
          set_logs?: Json
          skipped?: boolean
          sport_training_done?: boolean
          template_exercise_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_template_exercise_id_fkey"
            columns: ["template_exercise_id"]
            isOneToOne: false
            referencedRelation: "template_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_invite_code: { Args: never; Returns: string }
      is_active_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_team_coach: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      join_team_with_code: { Args: { p_code: string }; Returns: string }
    }
    Enums: {
      board_category:
        | "free"
        | "training_tip"
        | "question"
        | "review"
        | "recovery"
        | "nutrition"
        | "equipment"
      body_part:
        | "chest"
        | "back"
        | "legs"
        | "shoulders"
        | "arms"
        | "core"
        | "full_body"
      comp_importance: "A" | "B" | "C"
      difficulty_level: "beginner" | "intermediate" | "advanced"
      lift_type:
        | "squat"
        | "deadlift"
        | "bench"
        | "ohp"
        | "power_clean"
        | "pullup"
        | "dips"
        | "accessory"
      notification_type:
        | "comment"
        | "like"
        | "answer"
        | "best"
        | "team_assign"
        | "competition_reminder"
        | "fatigue_alert"
        | "mention"
        | "template_assigned"
        | "coach_note"
        | "team_announcement"
      qna_category:
        | "training"
        | "nutrition"
        | "recovery"
        | "equipment"
        | "other"
      report_target: "post" | "comment"
      split_type:
        | "full_body_3"
        | "full_body_4"
        | "upper_lower_4"
        | "five_split_5"
        | "custom"
      user_role: "athlete" | "coach"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      board_category: [
        "free",
        "training_tip",
        "question",
        "review",
        "recovery",
        "nutrition",
        "equipment",
      ],
      body_part: [
        "chest",
        "back",
        "legs",
        "shoulders",
        "arms",
        "core",
        "full_body",
      ],
      comp_importance: ["A", "B", "C"],
      difficulty_level: ["beginner", "intermediate", "advanced"],
      lift_type: [
        "squat",
        "deadlift",
        "bench",
        "ohp",
        "power_clean",
        "pullup",
        "dips",
        "accessory",
      ],
      notification_type: [
        "comment",
        "like",
        "answer",
        "best",
        "team_assign",
        "competition_reminder",
        "fatigue_alert",
        "mention",
        "template_assigned",
        "coach_note",
        "team_announcement",
      ],
      qna_category: ["training", "nutrition", "recovery", "equipment", "other"],
      report_target: ["post", "comment"],
      split_type: [
        "full_body_3",
        "full_body_4",
        "upper_lower_4",
        "five_split_5",
        "custom",
      ],
      user_role: ["athlete", "coach"],
    },
  },
} as const
