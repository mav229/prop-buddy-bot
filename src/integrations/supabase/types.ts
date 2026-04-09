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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      auto_replies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          match_mode: string
          priority: number
          response_text: string
          trigger_keywords: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_mode?: string
          priority?: number
          response_text: string
          trigger_keywords?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_mode?: string
          priority?: number
          response_text?: string
          trigger_keywords?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      autobot_settings: {
        Row: {
          bot_name: string | null
          channels: string[] | null
          created_at: string
          delay_seconds: number
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          bot_name?: string | null
          channels?: string[] | null
          created_at?: string
          delay_seconds?: number
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          bot_name?: string | null
          channels?: string[] | null
          created_at?: string
          delay_seconds?: number
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      chat_history: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          source: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          source?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          source?: string
        }
        Relationships: []
      }
      chat_ratings: {
        Row: {
          created_at: string
          id: string
          message_index: number
          rating: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_index: number
          rating: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_index?: number
          rating?: string
          session_id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          benefits: string | null
          code: string
          created_at: string
          current_uses: number | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_purchase: number | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          benefits?: string | null
          code: string
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_type?: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          benefits?: string | null
          code?: string
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      discord_connection_logs: {
        Row: {
          action: string
          assigned_role: string | null
          created_at: string
          discord_user_id: string | null
          discord_username: string | null
          email: string
          error_message: string | null
          id: string
          status: string
        }
        Insert: {
          action?: string
          assigned_role?: string | null
          created_at?: string
          discord_user_id?: string | null
          discord_username?: string | null
          email: string
          error_message?: string | null
          id?: string
          status?: string
        }
        Update: {
          action?: string
          assigned_role?: string | null
          created_at?: string
          discord_user_id?: string | null
          discord_username?: string | null
          email?: string
          error_message?: string | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      discord_connections: {
        Row: {
          assigned_role: string
          created_at: string
          discord_avatar: string | null
          discord_user_id: string
          discord_username: string | null
          email: string
          id: string
          last_role_update: string
          last_synced_at: string | null
          needs_sync: boolean
          updated_at: string
        }
        Insert: {
          assigned_role?: string
          created_at?: string
          discord_avatar?: string | null
          discord_user_id: string
          discord_username?: string | null
          email: string
          id?: string
          last_role_update?: string
          last_synced_at?: string | null
          needs_sync?: boolean
          updated_at?: string
        }
        Update: {
          assigned_role?: string
          created_at?: string
          discord_avatar?: string | null
          discord_user_id?: string
          discord_username?: string | null
          email?: string
          id?: string
          last_role_update?: string
          last_synced_at?: string | null
          needs_sync?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      discord_users: {
        Row: {
          created_at: string
          discord_user_id: string
          display_name: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          message_count: number
          notes: string | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          discord_user_id: string
          display_name?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message_count?: number
          notes?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          discord_user_id?: string
          display_name?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message_count?: number
          notes?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          clicked_at: string | null
          created_at: string
          id: string
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          source: string
          template_id: string
          tracking_id: string
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          source?: string
          template_id: string
          tracking_id?: string
        }
        Update: {
          clicked_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          source?: string
          template_id?: string
          tracking_id?: string
        }
        Relationships: []
      }
      extension_tone_presets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          prompt_instructions: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          prompt_instructions: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          prompt_instructions?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      extension_usage_logs: {
        Row: {
          created_at: string
          id: string
          input_length: number
          response_time_ms: number | null
          success: boolean | null
          tone_selected: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          input_length: number
          response_time_ms?: number | null
          success?: boolean | null
          tone_selected?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          input_length?: number
          response_time_ms?: number | null
          success?: boolean | null
          tone_selected?: string | null
        }
        Relationships: []
      }
      hall_of_fame_certificates: {
        Row: {
          account_number: string | null
          certificate_type: string
          certificate_url: string
          created_at: string
          email: string | null
          id: string
          mongo_collection: string
          mongo_source_id: string
          payout_amount: number | null
          phase: string | null
          slug: string
          status: string | null
          synced_at: string
          testimonial_sent_at: string | null
          updated_at: string
          user_name: string
        }
        Insert: {
          account_number?: string | null
          certificate_type?: string
          certificate_url: string
          created_at?: string
          email?: string | null
          id?: string
          mongo_collection?: string
          mongo_source_id: string
          payout_amount?: number | null
          phase?: string | null
          slug: string
          status?: string | null
          synced_at?: string
          testimonial_sent_at?: string | null
          updated_at?: string
          user_name: string
        }
        Update: {
          account_number?: string | null
          certificate_type?: string
          certificate_url?: string
          created_at?: string
          email?: string | null
          id?: string
          mongo_collection?: string
          mongo_source_id?: string
          payout_amount?: number | null
          phase?: string | null
          slug?: string
          status?: string | null
          synced_at?: string
          testimonial_sent_at?: string | null
          updated_at?: string
          user_name?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      mod_reference_links: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          keywords: string[]
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      pushed_orders: {
        Row: {
          account_size: string | null
          customer_name: string | null
          id: string
          mongo_order_id: string
          order_number: string | null
          payment_method: string | null
          pushed_at: string
        }
        Insert: {
          account_size?: string | null
          customer_name?: string | null
          id?: string
          mongo_order_id: string
          order_number?: string | null
          payment_method?: string | null
          pushed_at?: string
        }
        Update: {
          account_size?: string | null
          customer_name?: string | null
          id?: string
          mongo_order_id?: string
          order_number?: string | null
          payment_method?: string | null
          pushed_at?: string
        }
        Relationships: []
      }
      session_cache: {
        Row: {
          context_json: Json
          created_at: string | null
          email: string
          id: string
          session_id: string
        }
        Insert: {
          context_json: Json
          created_at?: string | null
          email: string
          id?: string
          session_id: string
        }
        Update: {
          context_json?: Json
          created_at?: string | null
          email?: string
          id?: string
          session_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          chat_history: string | null
          created_at: string
          email: string
          id: string
          phone: string
          problem: string
          replied_at: string | null
          session_id: string | null
          source: string
          status: string
          ticket_number: number | null
          updated_at: string
        }
        Insert: {
          admin_reply?: string | null
          chat_history?: string | null
          created_at?: string
          email: string
          id?: string
          phone: string
          problem: string
          replied_at?: string | null
          session_id?: string | null
          source?: string
          status?: string
          ticket_number?: number | null
          updated_at?: string
        }
        Update: {
          admin_reply?: string | null
          chat_history?: string | null
          created_at?: string
          email?: string
          id?: string
          phone?: string
          problem?: string
          replied_at?: string | null
          session_id?: string | null
          source?: string
          status?: string
          ticket_number?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      testimonial_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      training_feedback: {
        Row: {
          bot_answer: string
          confidence: number | null
          corrected_answer: string | null
          created_at: string
          id: string
          is_correct: boolean | null
          question: string
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
        }
        Insert: {
          bot_answer: string
          confidence?: number | null
          corrected_answer?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
        }
        Update: {
          bot_answer?: string
          confidence?: number | null
          corrected_answer?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      violation_scans: {
        Row: {
          account_number: string
          created_at: string
          credential_status: string | null
          email: string | null
          flags: Json
          id: string
          metrics_snapshot: Json
          risk_level: string
          scan_batch_id: string
          scanned_at: string
          updated_at: string
          user_name: string | null
        }
        Insert: {
          account_number: string
          created_at?: string
          credential_status?: string | null
          email?: string | null
          flags?: Json
          id?: string
          metrics_snapshot?: Json
          risk_level?: string
          scan_batch_id: string
          scanned_at?: string
          updated_at?: string
          user_name?: string | null
        }
        Update: {
          account_number?: string
          created_at?: string
          credential_status?: string | null
          email?: string | null
          flags?: Json
          id?: string
          metrics_snapshot?: Json
          risk_level?: string
          scan_batch_id?: string
          scanned_at?: string
          updated_at?: string
          user_name?: string | null
        }
        Relationships: []
      }
      widget_config: {
        Row: {
          config: Json
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      widget_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          page_url: string | null
          session_id: string | null
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          page_url?: string | null
          session_id?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          page_url?: string | null
          session_id?: string | null
          source?: string
        }
        Relationships: []
      }
      widget_user_profiles: {
        Row: {
          display_name: string | null
          email: string
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          preferences: Json | null
          total_sessions: number | null
        }
        Insert: {
          display_name?: string | null
          email: string
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          preferences?: Json | null
          total_sessions?: number | null
        }
        Update: {
          display_name?: string | null
          email?: string
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          preferences?: Json | null
          total_sessions?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
