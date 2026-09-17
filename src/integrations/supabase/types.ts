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
      analysis_recipient_perspectives: {
        Row: {
          created_at: string
          id: string
          participant_index: number
          participant_label: string | null
          share_link_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_index: number
          participant_label?: string | null
          share_link_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_index?: number
          participant_label?: string | null
          share_link_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_recipient_perspectives_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "analysis_share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_share_links: {
        Row: {
          analysis_id: string
          created_at: string
          id: string
          include_names: boolean
          include_quotes: boolean
          revoked_at: string | null
          snapshot_json: Json
          token_hash: string
          updated_at: string
          visit_count: number
        }
        Insert: {
          analysis_id: string
          created_at?: string
          id?: string
          include_names?: boolean
          include_quotes?: boolean
          revoked_at?: string | null
          snapshot_json: Json
          token_hash: string
          updated_at?: string
          visit_count?: number
        }
        Update: {
          analysis_id?: string
          created_at?: string
          id?: string
          include_names?: boolean
          include_quotes?: boolean
          revoked_at?: string | null
          snapshot_json?: Json
          token_hash?: string
          updated_at?: string
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "analysis_share_links_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_types: {
        Row: {
          background_color: string
          created_at: string
          decorative_element: string
          extras: Json
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
          extras?: Json
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
          extras?: Json
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
      group_read_unlocks: {
        Row: {
          amount_cents: number
          created_at: string
          group_read_id: string
          id: string
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          group_read_id: string
          id?: string
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          group_read_id?: string
          id?: string
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_read_unlocks_group_read_id_fkey"
            columns: ["group_read_id"]
            isOneToOne: false
            referencedRelation: "group_reads"
            referencedColumns: ["id"]
          },
        ]
      }
      group_reads: {
        Row: {
          access_source: string
          category: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          message_count: number
          participant_count: number
          result_json: Json | null
          session_id: string
          stats_json: Json | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_source?: string
          category?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_count?: number
          participant_count?: number
          result_json?: Json | null
          session_id: string
          stats_json?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_source?: string
          category?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_count?: number
          participant_count?: number
          result_json?: Json | null
          session_id?: string
          stats_json?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      group_roast_share_links: {
        Row: {
          created_at: string
          group_roast_id: string
          id: string
          include_names: boolean
          include_quotes: boolean
          revoked_at: string | null
          snapshot_json: Json
          token_hash: string
          updated_at: string
          visit_count: number
        }
        Insert: {
          created_at?: string
          group_roast_id: string
          id?: string
          include_names?: boolean
          include_quotes?: boolean
          revoked_at?: string | null
          snapshot_json: Json
          token_hash: string
          updated_at?: string
          visit_count?: number
        }
        Update: {
          created_at?: string
          group_roast_id?: string
          id?: string
          include_names?: boolean
          include_quotes?: boolean
          revoked_at?: string | null
          snapshot_json?: Json
          token_hash?: string
          updated_at?: string
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_roast_share_links_group_roast_id_fkey"
            columns: ["group_roast_id"]
            isOneToOne: false
            referencedRelation: "group_roasts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_roast_unlocks: {
        Row: {
          amount_cents: number
          created_at: string
          group_roast_id: string
          id: string
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          group_roast_id: string
          id?: string
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          group_roast_id?: string
          id?: string
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_roast_unlocks_group_roast_id_fkey"
            columns: ["group_roast_id"]
            isOneToOne: false
            referencedRelation: "group_roasts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_roasts: {
        Row: {
          attempt_count: number
          completed_at: string | null
          coverage_json: Json
          created_at: string
          error_message: string | null
          id: string
          input_fingerprint: string
          message_count: number
          model: string | null
          observations_json: Json
          participant_count: number
          participant_labels: Json
          preview_json: Json | null
          result_json: Json | null
          safety_blocked: boolean
          selected_period: Json
          stats_json: Json
          status: string
          updated_at: string
          usage_json: Json
          user_id: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          coverage_json?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          input_fingerprint: string
          message_count: number
          model?: string | null
          observations_json?: Json
          participant_count: number
          participant_labels?: Json
          preview_json?: Json | null
          result_json?: Json | null
          safety_blocked?: boolean
          selected_period?: Json
          stats_json?: Json
          status?: string
          updated_at?: string
          usage_json?: Json
          user_id: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          coverage_json?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          input_fingerprint?: string
          message_count?: number
          model?: string | null
          observations_json?: Json
          participant_count?: number
          participant_labels?: Json
          preview_json?: Json | null
          result_json?: Json | null
          safety_blocked?: boolean
          selected_period?: Json
          stats_json?: Json
          status?: string
          updated_at?: string
          usage_json?: Json
          user_id?: string
        }
        Relationships: []
      }
      group_share_links: {
        Row: {
          created_at: string
          group_read_id: string
          id: string
          include_names: boolean
          include_quotes: boolean
          revoked_at: string | null
          snapshot_json: Json
          token_hash: string
          updated_at: string
          visit_count: number
        }
        Insert: {
          created_at?: string
          group_read_id: string
          id?: string
          include_names?: boolean
          include_quotes?: boolean
          revoked_at?: string | null
          snapshot_json?: Json
          token_hash: string
          updated_at?: string
          visit_count?: number
        }
        Update: {
          created_at?: string
          group_read_id?: string
          id?: string
          include_names?: boolean
          include_quotes?: boolean
          revoked_at?: string | null
          snapshot_json?: Json
          token_hash?: string
          updated_at?: string
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_share_links_group_read_id_fkey"
            columns: ["group_read_id"]
            isOneToOne: false
            referencedRelation: "group_reads"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          input_fingerprint: string | null
          kind: string
          relationship_id: string | null
          started_from_version: number
          status: string
          updated_at: string
          usage_json: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_fingerprint?: string | null
          kind: string
          relationship_id?: string | null
          started_from_version: number
          status?: string
          updated_at?: string
          usage_json?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_fingerprint?: string | null
          kind?: string
          relationship_id?: string | null
          started_from_version?: number
          status?: string
          updated_at?: string
          usage_json?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_jobs_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "journey_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_observations: {
        Row: {
          alternatives: Json
          confidence: string
          corrected_at: string | null
          created_at: string
          evidence_refs: Json
          excluded_at: string | null
          id: string
          journey_source_id: string
          observation_type: string
          observed_period_end: string | null
          observed_period_start: string | null
          relationship_id: string
          statement: string
          subject_kind: string
          subject_label: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          alternatives?: Json
          confidence?: string
          corrected_at?: string | null
          created_at?: string
          evidence_refs?: Json
          excluded_at?: string | null
          id?: string
          journey_source_id: string
          observation_type: string
          observed_period_end?: string | null
          observed_period_start?: string | null
          relationship_id: string
          statement: string
          subject_kind: string
          subject_label?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          alternatives?: Json
          confidence?: string
          corrected_at?: string | null
          created_at?: string
          evidence_refs?: Json
          excluded_at?: string | null
          id?: string
          journey_source_id?: string
          observation_type?: string
          observed_period_end?: string | null
          observed_period_start?: string | null
          relationship_id?: string
          statement?: string
          subject_kind?: string
          subject_label?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "journey_observations_journey_source_id_fkey"
            columns: ["journey_source_id"]
            isOneToOne: false
            referencedRelation: "journey_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_observations_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "journey_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_profiles: {
        Row: {
          created_at: string
          data_version: number
          opted_in_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_version?: number
          opted_in_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_version?: number
          opted_in_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journey_relationships: {
        Row: {
          created_at: string
          data_version: number
          id: string
          kind: string
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_version?: number
          id?: string
          kind: string
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_version?: number
          id?: string
          kind?: string
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journey_sources: {
        Row: {
          adapter_version: number
          consent_at: string
          created_at: string
          excluded_at: string | null
          id: string
          notes: string | null
          observed_period_end: string | null
          observed_period_start: string | null
          relationship_id: string
          source_id: string
          source_kind: string
          subject_participant: string | null
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          adapter_version?: number
          consent_at?: string
          created_at?: string
          excluded_at?: string | null
          id?: string
          notes?: string | null
          observed_period_end?: string | null
          observed_period_start?: string | null
          relationship_id: string
          source_id: string
          source_kind: string
          subject_participant?: string | null
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          adapter_version?: number
          consent_at?: string
          created_at?: string
          excluded_at?: string | null
          id?: string
          notes?: string | null
          observed_period_end?: string | null
          observed_period_start?: string | null
          relationship_id?: string
          source_id?: string
          source_kind?: string
          subject_participant?: string | null
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_sources_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "journey_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_summaries: {
        Row: {
          built_from_version: number
          content: Json
          coverage: Json
          created_at: string
          evidence_source_ids: string[]
          generated_at: string
          id: string
          is_stale: boolean
          model: string | null
          relationship_id: string | null
          scope: string
          updated_at: string
          usage_json: Json
          user_id: string
        }
        Insert: {
          built_from_version: number
          content: Json
          coverage?: Json
          created_at?: string
          evidence_source_ids?: string[]
          generated_at?: string
          id?: string
          is_stale?: boolean
          model?: string | null
          relationship_id?: string | null
          scope: string
          updated_at?: string
          usage_json?: Json
          user_id: string
        }
        Update: {
          built_from_version?: number
          content?: Json
          coverage?: Json
          created_at?: string
          evidence_source_ids?: string[]
          generated_at?: string
          id?: string
          is_stale?: boolean
          model?: string | null
          relationship_id?: string | null
          scope?: string
          updated_at?: string
          usage_json?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_summaries_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "journey_relationships"
            referencedColumns: ["id"]
          },
        ]
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
      recipient_perspectives: {
        Row: {
          created_at: string
          id: string
          participant_index: number
          participant_label: string | null
          share_link_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_index: number
          participant_label?: string | null
          share_link_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_index?: number
          participant_label?: string | null
          share_link_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipient_perspectives_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "group_share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      roast_share_links: {
        Row: {
          created_at: string
          id: string
          include_names: boolean
          include_quotes: boolean
          revoked_at: string | null
          roast_id: string
          snapshot_json: Json
          token_hash: string
          updated_at: string
          visit_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          include_names?: boolean
          include_quotes?: boolean
          revoked_at?: string | null
          roast_id: string
          snapshot_json: Json
          token_hash: string
          updated_at?: string
          visit_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          include_names?: boolean
          include_quotes?: boolean
          revoked_at?: string | null
          roast_id?: string
          snapshot_json?: Json
          token_hash?: string
          updated_at?: string
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "roast_share_links_roast_id_fkey"
            columns: ["roast_id"]
            isOneToOne: false
            referencedRelation: "roasts"
            referencedColumns: ["id"]
          },
        ]
      }
      roasts: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          result_json: Json | null
          safety_blocked: boolean
          session_id: string
          source_id: string
          source_type: string
          status: string
          tone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          result_json?: Json | null
          safety_blocked?: boolean
          session_id: string
          source_id: string
          source_type: string
          status?: string
          tone?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          result_json?: Json | null
          safety_blocked?: boolean
          session_id?: string
          source_id?: string
          source_type?: string
          status?: string
          tone?: string
          updated_at?: string
          user_id?: string | null
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
      testimonial_candidates: {
        Row: {
          analysis_id: string | null
          attribution: string
          consented_at: string | null
          created_at: string
          id: string
          is_test: boolean
          moderated_at: string | null
          moderation_status: string
          publication_consent: boolean
          quote: string
          session_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          analysis_id?: string | null
          attribution?: string
          consented_at?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          moderated_at?: string | null
          moderation_status?: string
          publication_consent?: boolean
          quote: string
          session_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          analysis_id?: string | null
          attribution?: string
          consented_at?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          moderated_at?: string | null
          moderation_status?: string
          publication_consent?: boolean
          quote?: string
          session_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonial_candidates_analysis_id_fkey"
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
      approved_testimonials: {
        Row: {
          attribution: string | null
          id: string | null
          quote: string | null
        }
        Insert: {
          attribution?: string | null
          id?: string | null
          quote?: string | null
        }
        Update: {
          attribution?: string | null
          id?: string | null
          quote?: string | null
        }
        Relationships: []
      }
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
      claim_webhook_event: {
        Args: {
          p_environment: string
          p_event_id: string
          p_event_type: string
        }
        Returns: boolean
      }
      count_completed_decodes: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: number
      }
      count_group_reads_since_cutoff: {
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
      get_analysis_share_for_owner: {
        Args: { p_analysis_id: string; p_session_id: string }
        Returns: {
          created_at: string
          id: string
          include_names: boolean
          include_quotes: boolean
          revoked_at: string
          visit_count: number
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
      get_group_read_for_session: {
        Args: { p_id: string; p_session_id: string }
        Returns: {
          category: string
          created_at: string
          error_message: string
          id: string
          message_count: number
          participant_count: number
          result_json: Json
          session_id: string
          stats_json: Json
          status: string
          user_id: string
        }[]
      }
      get_group_roast_for_owner: { Args: { p_id: string }; Returns: Json }
      get_group_roast_share_for_owner: {
        Args: { p_group_roast_id: string }
        Returns: {
          created_at: string
          id: string
          include_names: boolean
          include_quotes: boolean
          revoked_at: string
          visit_count: number
        }[]
      }
      get_group_share_for_owner: {
        Args: { p_group_read_id: string; p_session_id: string }
        Returns: {
          created_at: string
          id: string
          include_names: boolean
          include_quotes: boolean
          revoked_at: string
          visit_count: number
        }[]
      }
      get_roast_for_session: {
        Args: { p_id: string; p_session_id: string }
        Returns: {
          created_at: string
          error_message: string
          id: string
          result_json: Json
          safety_blocked: boolean
          session_id: string
          source_id: string
          source_type: string
          status: string
          tone: string
          user_id: string
        }[]
      }
      get_roast_for_source: {
        Args: {
          p_session_id: string
          p_source_id: string
          p_source_type: string
        }
        Returns: {
          created_at: string
          id: string
          safety_blocked: boolean
          status: string
          tone: string
        }[]
      }
      get_roast_share_for_owner: {
        Args: { p_roast_id: string; p_session_id: string }
        Returns: {
          created_at: string
          id: string
          include_names: boolean
          include_quotes: boolean
          revoked_at: string
          visit_count: number
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
      has_group_read_unlock: {
        Args: { p_group_read_id: string }
        Returns: boolean
      }
      has_group_roast_unlock: {
        Args: { p_group_roast_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      journey_delete_all: { Args: never; Returns: undefined }
      journey_write_summary: {
        Args: {
          p_content: Json
          p_coverage: Json
          p_evidence_source_ids: string[]
          p_job_id: string
          p_model: string
          p_relationship_id: string
          p_scope: string
          p_usage: Json
        }
        Returns: boolean
      }
      list_approved_testimonials: {
        Args: never
        Returns: {
          attribution: string
          id: string
          quote: string
        }[]
      }
      list_roastable_sources: {
        Args: { p_session_id: string }
        Returns: {
          category: string
          created_at: string
          is_unlocked: boolean
          label: string
          source_id: string
          source_type: string
        }[]
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
      resolve_analysis_share: { Args: { p_token_hash: string }; Returns: Json }
      resolve_group_roast_share: {
        Args: { p_token_hash: string }
        Returns: Json
      }
      resolve_group_share: { Args: { p_token_hash: string }; Returns: Json }
      resolve_roast_share: { Args: { p_token_hash: string }; Returns: Json }
      save_analysis_recipient_perspective: {
        Args: {
          p_participant_index: number
          p_participant_label: string
          p_token_hash: string
        }
        Returns: string
      }
      save_recipient_perspective: {
        Args: {
          p_participant_index: number
          p_participant_label: string
          p_token_hash: string
        }
        Returns: string
      }
      set_couple_type_image_url: {
        Args: {
          p_image_url: string
          p_relationship_type: string
          p_type_id: number
        }
        Returns: undefined
      }
      submit_feedback: {
        Args: {
          p_analysis_id: string
          p_email: string
          p_question_variant?: string
          p_score: number
          p_session_id?: string
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
      submit_testimonial_candidate: {
        Args: {
          p_analysis_id: string
          p_attribution: string
          p_publication_consent: boolean
          p_quote: string
          p_session_id: string
        }
        Returns: string
      }
      user_has_active_subscription: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      user_has_full_plan: { Args: { p_user_id: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
