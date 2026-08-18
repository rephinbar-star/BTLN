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
      analyses: {
        Row: {
          completed_at: string | null
          context_data: Json
          couple_type_id: number | null
          created_at: string
          error_message: string | null
          feedback_email: string | null
          feedback_question_variant: string | null
          feedback_score: number | null
          feedback_text: string | null
          id: string
          input_method: string
          is_paid: boolean
          message_count: number | null
          prompt_version_id: string | null
          relationship_type: string | null
          result_json: Json | null
          session_id: string
          status: string
          subscription_tier_at_view: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          context_data: Json
          couple_type_id?: number | null
          created_at?: string
          error_message?: string | null
          feedback_email?: string | null
          feedback_question_variant?: string | null
          feedback_score?: number | null
          feedback_text?: string | null
          id?: string
          input_method: string
          is_paid?: boolean
          message_count?: number | null
          prompt_version_id?: string | null
          relationship_type?: string | null
          result_json?: Json | null
          session_id: string
          status?: string
          subscription_tier_at_view?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          context_data?: Json
          couple_type_id?: number | null
          created_at?: string
          error_message?: string | null
          feedback_email?: string | null
          feedback_question_variant?: string | null
          feedback_score?: number | null
          feedback_text?: string | null
          id?: string
          input_method?: string
          is_paid?: boolean
          message_count?: number | null
          prompt_version_id?: string | null
          relationship_type?: string | null
          result_json?: Json | null
          session_id?: string
          status?: string
          subscription_tier_at_view?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analyses_couple_type_id_fkey"
            columns: ["couple_type_id"]
            isOneToOne: false
            referencedRelation: "couple_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_types: {
        Row: {
          background_color: string
          created_at: string
          decorative_element: string
          family_description: string
          family_name: string
          family_superpower: string
          family_tagline: string
          friend_description: string
          friend_name: string
          friend_superpower: string
          friend_tagline: string
          id: number
          image_url_family: string | null
          image_url_friend: string | null
          image_url_romantic: string | null
          romantic_description: string
          romantic_name: string
          romantic_superpower: string
          romantic_tagline: string
          text_color: string
        }
        Insert: {
          background_color: string
          created_at?: string
          decorative_element: string
          family_description: string
          family_name: string
          family_superpower: string
          family_tagline: string
          friend_description: string
          friend_name: string
          friend_superpower: string
          friend_tagline: string
          id: number
          image_url_family?: string | null
          image_url_friend?: string | null
          image_url_romantic?: string | null
          romantic_description: string
          romantic_name: string
          romantic_superpower: string
          romantic_tagline: string
          text_color: string
        }
        Update: {
          background_color?: string
          created_at?: string
          decorative_element?: string
          family_description?: string
          family_name?: string
          family_superpower?: string
          family_tagline?: string
          friend_description?: string
          friend_name?: string
          friend_superpower?: string
          friend_tagline?: string
          id?: number
          image_url_family?: string | null
          image_url_friend?: string | null
          image_url_romantic?: string | null
          romantic_description?: string
          romantic_name?: string
          romantic_superpower?: string
          romantic_tagline?: string
          text_color?: string
        }
        Relationships: []
      }
      decodes: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          relationship_id: string | null
          result_json: Json | null
          session_id: string
          source: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          relationship_id?: string | null
          result_json?: Json | null
          session_id: string
          source?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          relationship_id?: string | null
          result_json?: Json | null
          session_id?: string
          source?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_captures: {
        Row: {
          analysis_id: string | null
          created_at: string
          email: string
          id: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          email: string
          id?: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_captures_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          metadata: Json | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      general_feedback: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          question_variant: string | null
          score: number | null
          source: string | null
          text: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          question_variant?: string | null
          score?: number | null
          source?: string | null
          text?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          question_variant?: string | null
          score?: number | null
          source?: string | null
          text?: string | null
        }
        Relationships: []
      }
      messages_temp: {
        Row: {
          analysis_id: string
          content: string
          created_at: string
          id: string
          sender_role: string
          sequence_order: number
          timestamp_estimate: string | null
        }
        Insert: {
          analysis_id: string
          content: string
          created_at?: string
          id?: string
          sender_role: string
          sequence_order: number
          timestamp_estimate?: string | null
        }
        Update: {
          analysis_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_role?: string
          sequence_order?: number
          timestamp_estimate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_temp_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      one_time_unlocks: {
        Row: {
          amount_cents: number
          analysis_id: string
          created_at: string
          id: string
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          analysis_id: string
          created_at?: string
          id?: string
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          analysis_id?: string
          created_at?: string
          id?: string
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_unlocks_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      paywall_intents: {
        Row: {
          analysis_id: string | null
          created_at: string
          id: string
          option: string
          user_id: string | null
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          option: string
          user_id?: string | null
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          option?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paywall_intents_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          model_string: string
          notes: string | null
          prompt_text: string
          version_number: number
          vision_model_string: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          model_string?: string
          notes?: string | null
          prompt_text: string
          version_number: number
          vision_model_string?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          model_string?: string
          notes?: string | null
          prompt_text?: string
          version_number?: number
          vision_model_string?: string
        }
        Relationships: []
      }
      share_clicks: {
        Row: {
          analysis_id: string | null
          created_at: string
          id: string
          platform: string
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          platform: string
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_clicks_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          accuracy_rating: number
          analysis_id: string | null
          created_at: string
          email: string | null
          feedback_text: string | null
          id: string
          question_variant: string
          trigger_source: string | null
          user_id: string | null
        }
        Insert: {
          accuracy_rating: number
          analysis_id?: string | null
          created_at?: string
          email?: string | null
          feedback_text?: string | null
          id?: string
          question_variant: string
          trigger_source?: string | null
          user_id?: string | null
        }
        Update: {
          accuracy_rating?: number
          analysis_id?: string | null
          created_at?: string
          email?: string | null
          feedback_text?: string | null
          id?: string
          question_variant?: string
          trigger_source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          amount_cents: number | null
          analysis_id: string | null
          changes: Json
          checkout_session_id: string | null
          created_at: string
          environment: string
          error_message: string | null
          event_id: string | null
          event_type: string
          id: string
          payload_summary: Json
          provider: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          analysis_id?: string | null
          changes?: Json
          checkout_session_id?: string | null
          created_at?: string
          environment: string
          error_message?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          payload_summary?: Json
          provider?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          analysis_id?: string | null
          changes?: Json
          checkout_session_id?: string | null
          created_at?: string
          environment?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          payload_summary?: Json
          provider?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      capture_email: {
        Args: {
          p_analysis_id: string
          p_email: string
          p_session_id: string
          p_source: string
        }
        Returns: undefined
      }
      claim_analyses_for_session: {
        Args: { p_session_id: string }
        Returns: number
      }
      claim_analysis: { Args: { p_analysis_id: string }; Returns: boolean }
      claim_anonymous_analyses: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: number
      }
      get_analysis_for_session: {
        Args: { p_id: string; p_session_id: string }
        Returns: {
          context_data: Json
          couple_type_id: number
          error_message: string
          id: string
          is_paid: boolean
          message_count: number
          relationship_type: string
          result_json: Json
          session_id: string
          status: string
          user_id: string
        }[]
      }
      get_decode_for_session: {
        Args: { p_id: string; p_session_id: string }
        Returns: {
          error_message: string
          id: string
          relationship_id: string
          result_json: Json
          session_id: string
          source: string
          status: string
          user_id: string
        }[]
      }
      get_shared_analysis: {
        Args: { p_id: string }
        Returns: {
          context_data: Json
          couple_type_id: number
          error_message: string
          id: string
          is_paid: boolean
          message_count: number
          relationship_type: string
          result_json: Json
          session_id: string
          status: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_event: {
        Args: { p_event_name: string; p_metadata: Json; p_session_id: string }
        Returns: undefined
      }
      mark_analysis_failed: {
        Args: { p_error_message: string; p_id: string; p_session_id: string }
        Returns: boolean
      }
      record_paywall_intent: {
        Args: { p_analysis_id: string; p_option: string; p_session_id: string }
        Returns: string
      }
      record_share_click: {
        Args: {
          p_analysis_id: string
          p_platform: string
          p_session_id: string
        }
        Returns: undefined
      }
      set_couple_type_image_url: {
        Args: {
          p_image_url: string
          p_relationship_type: string
          p_type_id: number
        }
        Returns: undefined
      }
      submit_feedback:
        | {
            Args: {
              p_analysis_id: string
              p_email: string
              p_score: number
              p_text: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_analysis_id: string
              p_email: string
              p_question_variant?: string
              p_score: number
              p_text: string
            }
            Returns: undefined
          }
      submit_survey: {
        Args: {
          p_accuracy_rating: number
          p_analysis_id: string
          p_email: string
          p_feedback_text: string
          p_question_variant: string
          p_session_id: string
          p_trigger_source: string
        }
        Returns: string
      }
      user_has_paid_access: {
        Args: { p_analysis_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
