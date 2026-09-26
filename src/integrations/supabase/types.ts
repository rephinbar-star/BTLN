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
      ai_feedback: {
        Row: {
          comment: string | null
          created_at: string
          generation_id: string | null
          id: string
          model: string | null
          outcome: string | null
          outcome_note: string | null
          owner_key: string | null
          personalization_consent: boolean
          product_improvement_consent: boolean
          prompt_version: string | null
          rating: string
          reason_codes: string[]
          session_id: string | null
          source_id: string
          source_kind: string
          target_key: string
          target_kind: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          generation_id?: string | null
          id?: string
          model?: string | null
          outcome?: string | null
          outcome_note?: string | null
          owner_key?: string | null
          personalization_consent?: boolean
          product_improvement_consent?: boolean
          prompt_version?: string | null
          rating: string
          reason_codes?: string[]
          session_id?: string | null
          source_id: string
          source_kind: string
          target_key?: string
          target_kind: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          generation_id?: string | null
          id?: string
          model?: string | null
          outcome?: string | null
          outcome_note?: string | null
          owner_key?: string | null
          personalization_consent?: boolean
          product_improvement_consent?: boolean
          prompt_version?: string | null
          rating?: string
          reason_codes?: string[]
          session_id?: string | null
          source_id?: string
          source_kind?: string
          target_key?: string
          target_kind?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
      extraction_budget: {
        Row: {
          bucket_key: string
          image_count: number
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          image_count?: number
          request_count?: number
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          image_count?: number
          request_count?: number
          updated_at?: string
          window_start?: string
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
          humor_intensity: string
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
          humor_intensity?: string
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
          humor_intensity?: string
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
      interactive_events: {
        Row: {
          client_request_id: string
          completed_at: string | null
          content_hash: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          input_method: string
          model: string | null
          provenance: Json
          result_json: Json | null
          speaker_order: Json
          started_from_version: number
          status: string
          thread_id: string
          updated_at: string
          usage_json: Json
          user_id: string
        }
        Insert: {
          client_request_id: string
          completed_at?: string | null
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          input_method: string
          model?: string | null
          provenance?: Json
          result_json?: Json | null
          speaker_order?: Json
          started_from_version: number
          status?: string
          thread_id: string
          updated_at?: string
          usage_json?: Json
          user_id: string
        }
        Update: {
          client_request_id?: string
          completed_at?: string | null
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          input_method?: string
          model?: string | null
          provenance?: Json
          result_json?: Json | null
          speaker_order?: Json
          started_from_version?: number
          status?: string
          thread_id?: string
          updated_at?: string
          usage_json?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactive_events_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "interactive_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      interactive_threads: {
        Row: {
          context_version: number
          created_at: string
          decode_id: string
          id: string
          last_event_at: string | null
          status: string
          structured_context: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          context_version?: number
          created_at?: string
          decode_id: string
          id?: string
          last_event_at?: string | null
          status?: string
          structured_context?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          context_version?: number
          created_at?: string
          decode_id?: string
          id?: string
          last_event_at?: string | null
          status?: string
          structured_context?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactive_threads_decode_id_fkey"
            columns: ["decode_id"]
            isOneToOne: false
            referencedRelation: "decodes"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_jobs: {
        Row: {
          attempt_count: number
          completed_at: string | null
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
          attempt_count?: number
          completed_at?: string | null
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
          attempt_count?: number
          completed_at?: string | null
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
      journey_mapping_rejections: {
        Row: {
          conversation_key: string
          created_at: string
          id: string
          relationship_id: string
          user_id: string
        }
        Insert: {
          conversation_key: string
          created_at?: string
          id?: string
          relationship_id: string
          user_id: string
        }
        Update: {
          conversation_key?: string
          created_at?: string
          id?: string
          relationship_id?: string
          user_id?: string
        }
        Relationships: []
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
          activation_consent_at: string | null
          auto_include_enabled: boolean
          consent_version: number
          created_at: string
          data_version: number
          opted_in_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activation_consent_at?: string | null
          auto_include_enabled?: boolean
          consent_version?: number
          created_at?: string
          data_version?: number
          opted_in_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activation_consent_at?: string | null
          auto_include_enabled?: boolean
          consent_version?: number
          created_at?: string
          data_version?: number
          opted_in_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journey_reflections: {
        Row: {
          created_at: string
          excluded_at: string | null
          id: string
          journey_summary_id: string | null
          outcome: string | null
          recommendation_id: string | null
          reflection_kind: string
          relationship_id: string | null
          response_text: string
          self_reported_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          excluded_at?: string | null
          id?: string
          journey_summary_id?: string | null
          outcome?: string | null
          recommendation_id?: string | null
          reflection_kind: string
          relationship_id?: string | null
          response_text: string
          self_reported_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          excluded_at?: string | null
          id?: string
          journey_summary_id?: string | null
          outcome?: string | null
          recommendation_id?: string | null
          reflection_kind?: string
          relationship_id?: string | null
          response_text?: string
          self_reported_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_reflections_journey_summary_id_fkey"
            columns: ["journey_summary_id"]
            isOneToOne: false
            referencedRelation: "journey_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_reflections_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "journey_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_relationships: {
        Row: {
          created_at: string
          data_version: number
          id: string
          is_confirmed: boolean
          kind: string
          label: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_version?: number
          id?: string
          is_confirmed?: boolean
          kind: string
          label: string
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_version?: number
          id?: string
          is_confirmed?: boolean
          kind?: string
          label?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journey_sources: {
        Row: {
          adapter_version: number
          consent_at: string
          conversation_key: string | null
          created_at: string
          date_note: string | null
          date_precision: string
          date_provenance: string
          dated_count: number
          excluded_at: string | null
          id: string
          identity_status: string
          notes: string | null
          observed_period_end: string | null
          observed_period_start: string | null
          relationship_id: string
          source_id: string
          source_kind: string
          subject_participant: string | null
          subject_participant_id: string | null
          undated_count: number
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          adapter_version?: number
          consent_at?: string
          conversation_key?: string | null
          created_at?: string
          date_note?: string | null
          date_precision?: string
          date_provenance?: string
          dated_count?: number
          excluded_at?: string | null
          id?: string
          identity_status?: string
          notes?: string | null
          observed_period_end?: string | null
          observed_period_start?: string | null
          relationship_id: string
          source_id: string
          source_kind: string
          subject_participant?: string | null
          subject_participant_id?: string | null
          undated_count?: number
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          adapter_version?: number
          consent_at?: string
          conversation_key?: string | null
          created_at?: string
          date_note?: string | null
          date_precision?: string
          date_provenance?: string
          dated_count?: number
          excluded_at?: string | null
          id?: string
          identity_status?: string
          notes?: string | null
          observed_period_end?: string | null
          observed_period_start?: string | null
          relationship_id?: string
          source_id?: string
          source_kind?: string
          subject_participant?: string | null
          subject_participant_id?: string | null
          undated_count?: number
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
          input_fingerprint: string | null
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
          input_fingerprint?: string | null
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
          input_fingerprint?: string | null
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
      prompt_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      prompt_datasets: {
        Row: {
          cases: Json
          content_hash: string
          created_at: string
          id: string
          mode: string
          name: string
          origin: string
          revision: number
        }
        Insert: {
          cases: Json
          content_hash: string
          created_at?: string
          id?: string
          mode: string
          name: string
          origin?: string
          revision: number
        }
        Update: {
          cases?: Json
          content_hash?: string
          created_at?: string
          id?: string
          mode?: string
          name?: string
          origin?: string
          revision?: number
        }
        Relationships: []
      }
      prompt_eval_jobs: {
        Row: {
          baseline_id: string
          binding_hash: string
          calls_failed: number
          calls_made: number
          candidate_id: string
          cases_total: number
          completed_at: string | null
          completion_tokens: number
          cost_usd: number
          created_at: string
          dataset_id: string
          error_message: string | null
          id: string
          mode: string
          prompt_tokens: number
          rubric_id: string
          started_by: string | null
          status: string
          summary: Json | null
        }
        Insert: {
          baseline_id: string
          binding_hash: string
          calls_failed?: number
          calls_made?: number
          candidate_id: string
          cases_total?: number
          completed_at?: string | null
          completion_tokens?: number
          cost_usd?: number
          created_at?: string
          dataset_id: string
          error_message?: string | null
          id?: string
          mode: string
          prompt_tokens?: number
          rubric_id: string
          started_by?: string | null
          status?: string
          summary?: Json | null
        }
        Update: {
          baseline_id?: string
          binding_hash?: string
          calls_failed?: number
          calls_made?: number
          candidate_id?: string
          cases_total?: number
          completed_at?: string | null
          completion_tokens?: number
          cost_usd?: number
          created_at?: string
          dataset_id?: string
          error_message?: string | null
          id?: string
          mode?: string
          prompt_tokens?: number
          rubric_id?: string
          started_by?: string | null
          status?: string
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_eval_jobs_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions_eval"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_eval_jobs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions_eval"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_eval_jobs_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "prompt_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_eval_jobs_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "prompt_rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_eval_results: {
        Row: {
          attempts: number
          case_id: string
          checks: Json
          completion_tokens: number
          created_at: string
          disagreement: boolean
          error_message: string | null
          id: string
          job_id: string
          judge: Json | null
          output: Json | null
          prompt_tokens: number
          screen_passed: boolean | null
          status: string
          variant: string
        }
        Insert: {
          attempts?: number
          case_id: string
          checks?: Json
          completion_tokens?: number
          created_at?: string
          disagreement?: boolean
          error_message?: string | null
          id?: string
          job_id: string
          judge?: Json | null
          output?: Json | null
          prompt_tokens?: number
          screen_passed?: boolean | null
          status: string
          variant: string
        }
        Update: {
          attempts?: number
          case_id?: string
          checks?: Json
          completion_tokens?: number
          created_at?: string
          disagreement?: boolean
          error_message?: string | null
          id?: string
          job_id?: string
          judge?: Json | null
          output?: Json | null
          prompt_tokens?: number
          screen_passed?: boolean | null
          status?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_eval_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "prompt_eval_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_reviews: {
        Row: {
          binding_hash: string
          candidate_id: string
          created_at: string
          decision: string
          id: string
          is_test_record: boolean
          job_id: string
          rationale: string
          reviewer_id: string
        }
        Insert: {
          binding_hash: string
          candidate_id: string
          created_at?: string
          decision: string
          id?: string
          is_test_record?: boolean
          job_id: string
          rationale: string
          reviewer_id: string
        }
        Update: {
          binding_hash?: string
          candidate_id?: string
          created_at?: string
          decision?: string
          id?: string
          is_test_record?: boolean
          job_id?: string
          rationale?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_reviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions_eval"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "prompt_eval_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_rubrics: {
        Row: {
          content_hash: string
          created_at: string
          criteria: Json
          frozen: boolean
          id: string
          mode: string
          version: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          criteria: Json
          frozen?: boolean
          id?: string
          mode: string
          version: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          criteria?: Json
          frozen?: boolean
          id?: string
          mode?: string
          version?: string
        }
        Relationships: []
      }
      prompt_runtime_selection: {
        Row: {
          binding_hash: string | null
          environment: string
          mode: string
          previous_version_id: string | null
          review_id: string | null
          selected_at: string
          selected_by: string
          version_id: string
        }
        Insert: {
          binding_hash?: string | null
          environment: string
          mode: string
          previous_version_id?: string | null
          review_id?: string | null
          selected_at?: string
          selected_by: string
          version_id: string
        }
        Update: {
          binding_hash?: string | null
          environment?: string
          mode?: string
          previous_version_id?: string | null
          review_id?: string | null
          selected_at?: string
          selected_by?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_runtime_selection_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions_eval"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_runtime_selection_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "prompt_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_runtime_selection_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions_eval"
            referencedColumns: ["id"]
          },
        ]
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
      prompt_versions_eval: {
        Row: {
          config: Json
          content_hash: string
          created_at: string
          created_by: string | null
          id: string
          is_test_record: boolean
          issue_ref: Json
          kind: string
          label: string
          mode: string
          model: string
          parent_id: string | null
          prompt_text: string
          rationale: string | null
        }
        Insert: {
          config?: Json
          content_hash: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_test_record?: boolean
          issue_ref?: Json
          kind: string
          label: string
          mode: string
          model: string
          parent_id?: string | null
          prompt_text: string
          rationale?: string | null
        }
        Update: {
          config?: Json
          content_hash?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_test_record?: boolean
          issue_ref?: Json
          kind?: string
          label?: string
          mode?: string
          model?: string
          parent_id?: string | null
          prompt_text?: string
          rationale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_eval_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions_eval"
            referencedColumns: ["id"]
          },
        ]
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
      report_ingest_meta: {
        Row: {
          conversation_key: string | null
          created_at: string
          date_note: string | null
          date_precision: string
          date_provenance: string
          dated_count: number
          id: string
          observed_end: string | null
          observed_start: string | null
          participant_fingerprint: string | null
          source_id: string
          source_kind: string
          timezone_ambiguous: boolean
          undated_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          conversation_key?: string | null
          created_at?: string
          date_note?: string | null
          date_precision?: string
          date_provenance?: string
          dated_count?: number
          id?: string
          observed_end?: string | null
          observed_start?: string | null
          participant_fingerprint?: string | null
          source_id: string
          source_kind: string
          timezone_ambiguous?: boolean
          undated_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          conversation_key?: string | null
          created_at?: string
          date_note?: string | null
          date_precision?: string
          date_provenance?: string
          dated_count?: number
          id?: string
          observed_end?: string | null
          observed_start?: string | null
          participant_fingerprint?: string | null
          source_id?: string
          source_kind?: string
          timezone_ambiguous?: boolean
          undated_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      subscription_entitlements: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          entitlement: string
          id: string
          metadata: Json
          parent_provider_subscription_id: string | null
          provider: string
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          entitlement: string
          id?: string
          metadata?: Json
          parent_provider_subscription_id?: string | null
          provider?: string
          provider_subscription_id?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          entitlement?: string
          id?: string
          metadata?: Json
          parent_provider_subscription_id?: string | null
          provider?: string
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      admin_ai_feedback_aggregate: {
        Args: { p_days?: number }
        Returns: {
          down_count: number
          model: string
          prompt_version: string
          reason_code: string
          sample_size: number
          source_kind: string
          target_kind: string
          up_count: number
        }[]
      }
      ai_feedback_owns_source: {
        Args: {
          p_session_id: string
          p_source_id: string
          p_source_kind: string
        }
        Returns: boolean
      }
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
      claim_extraction_budget: {
        Args: {
          p_bucket: string
          p_images: number
          p_max_images: number
          p_max_requests: number
        }
        Returns: Json
      }
      claim_webhook_event: {
        Args: {
          p_environment: string
          p_event_id: string
          p_event_type: string
        }
        Returns: boolean
      }
      clear_ai_feedback: {
        Args: {
          p_session_id?: string
          p_source_id: string
          p_source_kind: string
          p_target_key: string
          p_target_kind: string
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
      delete_my_ai_feedback: { Args: never; Returns: number }
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
      get_coaching_feedback_context: {
        Args: { p_limit?: number }
        Returns: Json
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
      has_entitlement: { Args: { p_entitlement: string }; Returns: boolean }
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
      journey_activate: {
        Args: { p_auto_include: boolean }
        Returns: undefined
      }
      journey_assign_source: {
        Args: { p_relationship_id: string; p_source_id: string }
        Returns: boolean
      }
      journey_auto_include: { Args: never; Returns: number }
      journey_confirm_identity: {
        Args: { p_participant: string; p_source_id: string }
        Returns: boolean
      }
      journey_confirm_relationship: {
        Args: { p_kind: string; p_label: string; p_relationship_id: string }
        Returns: boolean
      }
      journey_delete_all: { Args: never; Returns: undefined }
      journey_export: { Args: never; Returns: Json }
      journey_mark_absent: { Args: { p_source_id: string }; Returns: boolean }
      journey_merge_relationships: {
        Args: { p_from: string; p_into: string }
        Returns: boolean
      }
      journey_opt_out: { Args: never; Returns: undefined }
      journey_set_reflection_excluded: {
        Args: { p_excluded: boolean; p_reflection_id: string }
        Returns: boolean
      }
      journey_set_source_excluded: {
        Args: { p_excluded: boolean; p_source_id: string }
        Returns: boolean
      }
      journey_set_source_period: {
        Args: { p_end: string; p_source_id: string; p_start: string }
        Returns: boolean
      }
      journey_source_participants: {
        Args: { p_source_id: string; p_source_kind: string }
        Returns: string[]
      }
      journey_split_source: {
        Args: { p_label: string; p_source_id: string }
        Returns: string
      }
      journey_suggest_relationships: {
        Args: { p_source_id: string }
        Returns: {
          id: string
          is_confirmed: boolean
          kind: string
          label: string
          reason: string
          scope: string
          source_count: number
        }[]
      }
      journey_touch_relationship: {
        Args: { p_rel: string; p_user: string }
        Returns: undefined
      }
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
      list_ai_feedback_for_source: {
        Args: {
          p_session_id?: string
          p_source_id: string
          p_source_kind: string
        }
        Returns: {
          comment: string
          outcome: string
          rating: string
          reason_codes: string[]
          target_key: string
          target_kind: string
        }[]
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
      reset_coaching_personalization: { Args: never; Returns: number }
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
      submit_ai_feedback: {
        Args: {
          p_comment?: string
          p_generation_id?: string
          p_model?: string
          p_outcome?: string
          p_outcome_note?: string
          p_personalization_consent?: boolean
          p_product_improvement_consent?: boolean
          p_prompt_version?: string
          p_rating: string
          p_reason_codes?: string[]
          p_session_id?: string
          p_source_id: string
          p_source_kind: string
          p_target_key: string
          p_target_kind: string
        }
        Returns: string
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
