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
      broker_match_requests: {
        Row: {
          buyer_or_seller: string | null
          contact_method: string | null
          contact_time: string | null
          created_at: string
          credit_band: string | null
          first_time_buyer: boolean | null
          id: string
          loan_type: string | null
          notes: string | null
          plan_id: string | null
          preferred_language: string | null
          price_max: number | null
          price_min: number | null
          priority: boolean
          property_type: string | null
          service_type: string
          status: string
          target_city: string | null
          target_state: string | null
          target_zip: string | null
          tier_at_signup: string
          timeline: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_or_seller?: string | null
          contact_method?: string | null
          contact_time?: string | null
          created_at?: string
          credit_band?: string | null
          first_time_buyer?: boolean | null
          id?: string
          loan_type?: string | null
          notes?: string | null
          plan_id?: string | null
          preferred_language?: string | null
          price_max?: number | null
          price_min?: number | null
          priority?: boolean
          property_type?: string | null
          service_type: string
          status?: string
          target_city?: string | null
          target_state?: string | null
          target_zip?: string | null
          tier_at_signup?: string
          timeline?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_or_seller?: string | null
          contact_method?: string | null
          contact_time?: string | null
          created_at?: string
          credit_band?: string | null
          first_time_buyer?: boolean | null
          id?: string
          loan_type?: string | null
          notes?: string | null
          plan_id?: string | null
          preferred_language?: string | null
          price_max?: number | null
          price_min?: number | null
          priority?: boolean
          property_type?: string | null
          service_type?: string
          status?: string
          target_city?: string | null
          target_state?: string | null
          target_zip?: string | null
          tier_at_signup?: string
          timeline?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          notes: string | null
          priority: boolean
          tier_at_signup: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          priority?: boolean
          tier_at_signup?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          priority?: boolean
          tier_at_signup?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          meta: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meta?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meta?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          answers: Json
          completed: boolean
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          completed?: boolean
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          completed?: boolean
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lender_documents: {
        Row: {
          checklist_item: Database["public"]["Enums"]["lender_doc_item"]
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist_item: Database["public"]["Enums"]["lender_doc_item"]
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist_item?: Database["public"]["Enums"]["lender_doc_item"]
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_snapshots: {
        Row: {
          city: string
          created_at: string
          fetched_at: string
          id: string
          payload: Json
          state: string
        }
        Insert: {
          city: string
          created_at?: string
          fetched_at?: string
          id?: string
          payload?: Json
          state: string
        }
        Update: {
          city?: string
          created_at?: string
          fetched_at?: string
          id?: string
          payload?: Json
          state?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          action_plan_progress: Json
          answers: Json
          assumptions: Json
          created_at: string
          current_savings: number | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          parent_plan_id: string | null
          pdf_token: string | null
          phone: string | null
          share_enabled: boolean
          share_slug: string | null
          tags: string[]
          target_move_in: string | null
          theme: string
          title: string | null
          user_id: string | null
          version: number
        }
        Insert: {
          action_plan_progress?: Json
          answers?: Json
          assumptions?: Json
          created_at?: string
          current_savings?: number | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          parent_plan_id?: string | null
          pdf_token?: string | null
          phone?: string | null
          share_enabled?: boolean
          share_slug?: string | null
          tags?: string[]
          target_move_in?: string | null
          theme?: string
          title?: string | null
          user_id?: string | null
          version?: number
        }
        Update: {
          action_plan_progress?: Json
          answers?: Json
          assumptions?: Json
          created_at?: string
          current_savings?: number | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          parent_plan_id?: string | null
          pdf_token?: string | null
          phone?: string | null
          share_enabled?: boolean
          share_slug?: string | null
          tags?: string[]
          target_move_in?: string | null
          theme?: string
          title?: string | null
          user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plans_parent_plan_id_fkey"
            columns: ["parent_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          coach_summary: string | null
          created_at: string
          display_name: string | null
          id: string
          last_reminder_at: string | null
          next_reminder_at: string | null
          reminders_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          coach_summary?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_reminder_at?: string | null
          next_reminder_at?: string | null
          reminders_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          coach_summary?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_reminder_at?: string | null
          next_reminder_at?: string | null
          reminders_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_alerts: {
        Row: {
          active: boolean
          created_at: string
          email_notifications: boolean
          last_notified_at: string | null
          last_seen_rate: number | null
          loan_amount: number
          target_rate: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email_notifications?: boolean
          last_notified_at?: string | null
          last_seen_rate?: number | null
          loan_amount: number
          target_rate: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email_notifications?: boolean
          last_notified_at?: string | null
          last_seen_rate?: number | null
          loan_amount?: number
          target_rate?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          attribution_source: string | null
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attribution_source?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attribution_source?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      upgrade_events: {
        Row: {
          created_at: string
          email: string | null
          event_type: string
          id: string
          metadata: Json
          plan_id: string | null
          session_id: string | null
          source: string
          tier: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_type: string
          id?: string
          metadata?: Json
          plan_id?: string | null
          session_id?: string | null
          source: string
          tier: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          plan_id?: string | null
          session_id?: string | null
          source?: string
          tier?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_plan_with_limit:
        | {
            Args: {
              p_answers: Json
              p_email: string
              p_environment?: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_answers: Json
              p_email: string
              p_environment?: string
              p_first_name?: string
              p_last_name?: string
              p_phone?: string
              p_user_id: string
            }
            Returns: Json
          }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_upgrade_funnel: {
        Args: { p_since: string }
        Returns: {
          checkout_opens: number
          clicks: number
          signups: number
          source: string
          tier: string
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      join_broker_waitlist: { Args: { p_notes?: string }; Returns: Json }
      log_upgrade_event: {
        Args: {
          p_email?: string
          p_event_type: string
          p_metadata?: Json
          p_plan_id?: string
          p_session_id?: string
          p_source: string
          p_tier: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      upsert_lead:
        | {
            Args: { p_answers: Json; p_completed: boolean; p_email: string }
            Returns: undefined
          }
        | {
            Args: {
              p_answers: Json
              p_completed: boolean
              p_email: string
              p_first_name?: string
              p_last_name?: string
              p_phone?: string
            }
            Returns: undefined
          }
    }
    Enums: {
      lender_doc_item:
        | "w2"
        | "tax_return"
        | "pay_stub"
        | "bank_statement"
        | "id"
        | "gift_letter"
        | "employment_letter"
        | "other"
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
      lender_doc_item: [
        "w2",
        "tax_return",
        "pay_stub",
        "bank_statement",
        "id",
        "gift_letter",
        "employment_letter",
        "other",
      ],
    },
  },
} as const
