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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      abuse_flags: {
        Row: {
          action_type: string | null
          created_at: string
          details: Json | null
          flag_type: string
          id: string
          ip_address: string | null
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string
          details?: Json | null
          flag_type: string
          id?: string
          ip_address?: string | null
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string
          details?: Json | null
          flag_type?: string
          id?: string
          ip_address?: string | null
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      action_rate_limits: {
        Row: {
          action_type: string
          attempt_count: number
          backoff_level: number
          blocked_until: string | null
          created_at: string
          id: string
          ip_address: string | null
          last_attempt_at: string
          user_id: string | null
          window_start: string
        }
        Insert: {
          action_type: string
          attempt_count?: number
          backoff_level?: number
          blocked_until?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          last_attempt_at?: string
          user_id?: string | null
          window_start?: string
        }
        Update: {
          action_type?: string
          attempt_count?: number
          backoff_level?: number
          blocked_until?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          last_attempt_at?: string
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      admin_actions: {
        Row: {
          action_type: string
          actor_id: string
          actor_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          reason: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action_type: string
          actor_id: string
          actor_role: Database["public"]["Enums"]["app_role"]
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action_type?: string
          actor_id?: string
          actor_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string
          currency_code: string
          currency_symbol: string
          flag_emoji: string | null
          id: string
          is_active: boolean
          name: string
          phone_code: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency_code: string
          currency_symbol: string
          flag_emoji?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone_code: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          flag_emoji?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      country_payment_methods: {
        Row: {
          country_id: string
          created_at: string
          id: string
          is_active: boolean
          payment_method_id: string
          priority: number | null
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          payment_method_id: string
          priority?: number | null
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          payment_method_id?: string
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "country_payment_methods_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_payment_methods_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      country_risk_settings: {
        Row: {
          country_code: string
          created_at: string
          id: string
          min_kyc_tier: Database["public"]["Enums"]["kyc_tier"]
          notes: string | null
          risk_level: string
          trading_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          min_kyc_tier?: Database["public"]["Enums"]["kyc_tier"]
          notes?: string | null
          risk_level?: string
          trading_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          min_kyc_tier?: Database["public"]["Enums"]["kyc_tier"]
          notes?: string | null
          risk_level?: string
          trading_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      deposit_addresses: {
        Row: {
          address: string
          address_generated_at: string
          created_at: string
          crypto_type: string
          id: string
          is_active: boolean
          last_deposit_at: string | null
          last_monitored_at: string | null
          metadata: Json | null
          network: string | null
          pending_amount: number
          total_deposited: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          address_generated_at?: string
          created_at?: string
          crypto_type: string
          id?: string
          is_active?: boolean
          last_deposit_at?: string | null
          last_monitored_at?: string | null
          metadata?: Json | null
          network?: string | null
          pending_amount?: number
          total_deposited?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          address_generated_at?: string
          created_at?: string
          crypto_type?: string
          id?: string
          is_active?: boolean
          last_deposit_at?: string | null
          last_monitored_at?: string | null
          metadata?: Json | null
          network?: string | null
          pending_amount?: number
          total_deposited?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dispute_assignments: {
        Row: {
          assigned_by: string
          assigned_to: string
          created_at: string
          escalated: boolean
          escalated_at: string | null
          escalated_to: string | null
          escalation_reason: string | null
          first_response_at: string | null
          id: string
          notes: string | null
          priority: string
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          sla_breached: boolean
          sla_deadline: string | null
          status: string
          trade_id: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          created_at?: string
          escalated?: boolean
          escalated_at?: string | null
          escalated_to?: string | null
          escalation_reason?: string | null
          first_response_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          sla_breached?: boolean
          sla_deadline?: string | null
          status?: string
          trade_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          created_at?: string
          escalated?: boolean
          escalated_at?: string | null
          escalated_to?: string | null
          escalation_reason?: string | null
          first_response_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          sla_breached?: boolean
          sla_deadline?: string | null
          status?: string
          trade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_assignments_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: true
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          actor_id: string | null
          completed_at: string | null
          created_at: string
          error: string | null
          expires_at: string
          id: string
          key: string
          reference_id: string | null
          response_snapshot: Json | null
          scope: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          id?: string
          key: string
          reference_id?: string | null
          response_snapshot?: Json | null
          scope: string
          status?: string
        }
        Update: {
          actor_id?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          id?: string
          key?: string
          reference_id?: string | null
          response_snapshot?: Json | null
          scope?: string
          status?: string
        }
        Relationships: []
      }
      internal_transfers: {
        Row: {
          amount: number
          created_at: string
          crypto_type: string
          id: string
          recipient_id: string
          recipient_username: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          sender_id: string
          sender_username: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          crypto_type: string
          id?: string
          recipient_id: string
          recipient_username: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          sender_id: string
          sender_username: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          crypto_type?: string
          id?: string
          recipient_id?: string
          recipient_username?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          sender_id?: string
          sender_username?: string
          status?: string
        }
        Relationships: []
      }
      kyc_document_fingerprints: {
        Row: {
          created_at: string
          fingerprint: string
          id: string
          kind: string
          submission_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          id?: string
          kind: string
          submission_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          id?: string
          kind?: string
          submission_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_document_fingerprints_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "kyc_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_submissions: {
        Row: {
          bot_checks: Json | null
          bot_reason: string | null
          bot_score: number | null
          country_code: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string | null
          id: string
          id_back_hash: string | null
          id_back_url: string | null
          id_front_hash: string | null
          id_front_url: string | null
          id_number: string | null
          id_type: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          selfie_hash: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_checks?: Json | null
          bot_reason?: string | null
          bot_score?: number | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          id?: string
          id_back_hash?: string | null
          id_back_url?: string | null
          id_front_hash?: string | null
          id_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          selfie_hash?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_checks?: Json | null
          bot_reason?: string | null
          bot_score?: number | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          id?: string
          id_back_hash?: string | null
          id_back_url?: string | null
          id_front_hash?: string | null
          id_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          selfie_hash?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_tier_limits: {
        Row: {
          allowed_payment_methods: string[]
          can_create_buy_offers: boolean
          can_create_sell_offers: boolean
          created_at: string
          daily_trade_limit: number
          description: string | null
          id: string
          max_active_offers: number
          max_daily_trades: number
          max_single_trade_amount: number
          monthly_trade_limit: number
          tier: Database["public"]["Enums"]["kyc_tier"]
          updated_at: string
        }
        Insert: {
          allowed_payment_methods?: string[]
          can_create_buy_offers?: boolean
          can_create_sell_offers?: boolean
          created_at?: string
          daily_trade_limit?: number
          description?: string | null
          id?: string
          max_active_offers?: number
          max_daily_trades?: number
          max_single_trade_amount?: number
          monthly_trade_limit?: number
          tier: Database["public"]["Enums"]["kyc_tier"]
          updated_at?: string
        }
        Update: {
          allowed_payment_methods?: string[]
          can_create_buy_offers?: boolean
          can_create_sell_offers?: boolean
          created_at?: string
          daily_trade_limit?: number
          description?: string | null
          id?: string
          max_active_offers?: number
          max_daily_trades?: number
          max_single_trade_amount?: number
          monthly_trade_limit?: number
          tier?: Database["public"]["Enums"]["kyc_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      moderator_availability: {
        Row: {
          active_cases_count: number
          created_at: string
          id: string
          last_assigned_at: string | null
          max_cases: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_cases_count?: number
          created_at?: string
          id?: string
          last_assigned_at?: string | null
          max_cases?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_cases_count?: number
          created_at?: string
          id?: string
          last_assigned_at?: string | null
          max_cases?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          active_trade_count: number | null
          created_at: string
          crypto_amount: number
          crypto_type: string
          fiat_currency: string | null
          id: string
          is_active: boolean | null
          max_amount: number
          min_amount: number
          payment_methods: string[]
          price_margin: number | null
          price_per_unit: number
          reserved_amount: number
          terms: string | null
          time_limit: number | null
          total_trades: number | null
          type: Database["public"]["Enums"]["offer_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active_trade_count?: number | null
          created_at?: string
          crypto_amount: number
          crypto_type: string
          fiat_currency?: string | null
          id?: string
          is_active?: boolean | null
          max_amount: number
          min_amount: number
          payment_methods: string[]
          price_margin?: number | null
          price_per_unit: number
          reserved_amount?: number
          terms?: string | null
          time_limit?: number | null
          total_trades?: number | null
          type: Database["public"]["Enums"]["offer_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active_trade_count?: number | null
          created_at?: string
          crypto_amount?: number
          crypto_type?: string
          fiat_currency?: string | null
          id?: string
          is_active?: boolean | null
          max_amount?: number
          min_amount?: number
          payment_methods?: string[]
          price_margin?: number | null
          price_per_unit?: number
          reserved_amount?: number
          terms?: string | null
          time_limit?: number | null
          total_trades?: number | null
          type?: Database["public"]["Enums"]["offer_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          action_type: string
          attempts: number | null
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          max_attempts: number | null
          metadata: Json | null
          method: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          attempts?: number | null
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number | null
          metadata?: Json | null
          method?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          attempts?: number | null
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number | null
          metadata?: Json | null
          method?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      otp_rate_limits: {
        Row: {
          action_type: string
          attempt_count: number | null
          created_at: string
          first_attempt_at: string
          id: string
          identifier: string
          last_attempt_at: string
          locked_until: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          attempt_count?: number | null
          created_at?: string
          first_attempt_at?: string
          id?: string
          identifier: string
          last_attempt_at?: string
          locked_until?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          attempt_count?: number | null
          created_at?: string
          first_attempt_at?: string
          id?: string
          identifier?: string
          last_attempt_at?: string
          locked_until?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_method_restrictions: {
        Row: {
          country_code: string
          created_at: string
          id: string
          is_allowed: boolean
          min_kyc_tier: Database["public"]["Enums"]["kyc_tier"]
          notes: string | null
          payment_method: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          is_allowed?: boolean
          min_kyc_tier?: Database["public"]["Enums"]["kyc_tier"]
          notes?: string | null
          payment_method: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          is_allowed?: boolean
          min_kyc_tier?: Database["public"]["Enums"]["kyc_tier"]
          notes?: string | null
          payment_method?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      platform_fees: {
        Row: {
          created_at: string
          description: string | null
          fee_type: string
          id: string
          is_active: boolean
          max_amount: number | null
          min_amount: number | null
          percentage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fee_type: string
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          percentage?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fee_type?: string
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      platform_wallets: {
        Row: {
          balance: number
          created_at: string
          crypto_type: string
          description: string | null
          id: string
          updated_at: string
          wallet_type: string
        }
        Insert: {
          balance?: number
          created_at?: string
          crypto_type: string
          description?: string | null
          id?: string
          updated_at?: string
          wallet_type: string
        }
        Update: {
          balance?: number
          created_at?: string
          crypto_type?: string
          description?: string | null
          id?: string
          updated_at?: string
          wallet_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          id: string
          id_back_url: string | null
          id_front_url: string | null
          id_number: string | null
          id_type: string | null
          is_verified: boolean | null
          kyc_country: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"] | null
          kyc_submitted_at: string | null
          kyc_verified_at: string | null
          last_seen: string | null
          mpesa_phone: string | null
          phone: string | null
          preferred_currency: string | null
          rating: number | null
          selfie_url: string | null
          setup_completed: boolean | null
          setup_step: number | null
          successful_trades: number | null
          total_trades: number | null
          updated_at: string
          user_id: string
          username: string | null
          username_changed: boolean | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          is_verified?: boolean | null
          kyc_country?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"] | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          last_seen?: string | null
          mpesa_phone?: string | null
          phone?: string | null
          preferred_currency?: string | null
          rating?: number | null
          selfie_url?: string | null
          setup_completed?: boolean | null
          setup_step?: number | null
          successful_trades?: number | null
          total_trades?: number | null
          updated_at?: string
          user_id: string
          username?: string | null
          username_changed?: boolean | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          is_verified?: boolean | null
          kyc_country?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"] | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          last_seen?: string | null
          mpesa_phone?: string | null
          phone?: string | null
          preferred_currency?: string | null
          rating?: number | null
          selfie_url?: string | null
          setup_completed?: boolean | null
          setup_step?: number | null
          successful_trades?: number | null
          total_trades?: number | null
          updated_at?: string
          user_id?: string
          username?: string | null
          username_changed?: boolean | null
        }
        Relationships: []
      }
      rate_limit_config: {
        Row: {
          action_type: string
          base_cooldown_seconds: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_attempts: number
          max_cooldown_seconds: number
          window_seconds: number
        }
        Insert: {
          action_type: string
          base_cooldown_seconds?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_attempts?: number
          max_cooldown_seconds?: number
          window_seconds?: number
        }
        Update: {
          action_type?: string
          base_cooldown_seconds?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_attempts?: number
          max_cooldown_seconds?: number
          window_seconds?: number
        }
        Relationships: []
      }
      risk_flags: {
        Row: {
          action: string
          condition: Json
          created_at: string
          created_by: string | null
          description: string | null
          flag_type: string
          id: string
          is_active: boolean
          severity: string
          updated_at: string
        }
        Insert: {
          action: string
          condition: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          flag_type: string
          id?: string
          is_active?: boolean
          severity?: string
          updated_at?: string
        }
        Update: {
          action?: string
          condition?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          flag_type?: string
          id?: string
          is_active?: boolean
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          action_type: string
          created_at: string
          device_info: Json | null
          id: string
          ip_address: string | null
          metadata: Json | null
          method: string | null
          status: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          method?: string | null
          status: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          method?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          read_at: string | null
          sender_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          read_at?: string | null
          sender_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          read_at?: string | null
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_audit_trail: {
        Row: {
          action_type: string
          actor_id: string
          buyer_balance_after: number | null
          buyer_balance_before: number | null
          created_at: string
          escrow_amount: number | null
          id: string
          metadata: Json | null
          platform_fee: number | null
          seller_balance_after: number | null
          seller_balance_before: number | null
          seller_locked_after: number | null
          seller_locked_before: number | null
          trade_id: string
        }
        Insert: {
          action_type: string
          actor_id: string
          buyer_balance_after?: number | null
          buyer_balance_before?: number | null
          created_at?: string
          escrow_amount?: number | null
          id?: string
          metadata?: Json | null
          platform_fee?: number | null
          seller_balance_after?: number | null
          seller_balance_before?: number | null
          seller_locked_after?: number | null
          seller_locked_before?: number | null
          trade_id: string
        }
        Update: {
          action_type?: string
          actor_id?: string
          buyer_balance_after?: number | null
          buyer_balance_before?: number | null
          created_at?: string
          escrow_amount?: number | null
          id?: string
          metadata?: Json | null
          platform_fee?: number | null
          seller_balance_after?: number | null
          seller_balance_before?: number | null
          seller_locked_after?: number | null
          seller_locked_before?: number | null
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_audit_trail_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_evidence: {
        Row: {
          created_at: string
          description: string | null
          evidence_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_locked: boolean
          locked_at: string | null
          trade_id: string
          uploader_id: string
          uploader_role: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          evidence_type: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          trade_id: string
          uploader_id: string
          uploader_role: string
        }
        Update: {
          created_at?: string
          description?: string | null
          evidence_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          trade_id?: string
          uploader_id?: string
          uploader_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_evidence_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_messages: {
        Row: {
          created_at: string
          id: string
          is_system: boolean | null
          message: string
          read_at: string | null
          sender_id: string
          trade_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean | null
          message: string
          read_at?: string | null
          sender_id: string
          trade_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean | null
          message?: string
          read_at?: string | null
          sender_id?: string
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_messages_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rated_id: string
          rater_id: string
          rating: number
          trade_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rated_id: string
          rater_id: string
          rating: number
          trade_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rated_id?: string
          rater_id?: string
          rating?: number
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_ratings_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trader_behavior_metrics: {
        Row: {
          average_release_time_minutes: number | null
          cancelled_trades: number
          completed_trades: number
          disputes_raised_against: number
          disputes_started_by: number
          failed_payment_reports: number
          last_trade_at: string | null
          risk_level: string
          risk_score: number
          total_trades: number
          updated_at: string
          user_id: string
        }
        Insert: {
          average_release_time_minutes?: number | null
          cancelled_trades?: number
          completed_trades?: number
          disputes_raised_against?: number
          disputes_started_by?: number
          failed_payment_reports?: number
          last_trade_at?: string | null
          risk_level?: string
          risk_score?: number
          total_trades?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          average_release_time_minutes?: number | null
          cancelled_trades?: number
          completed_trades?: number
          disputes_raised_against?: number
          disputes_started_by?: number
          failed_payment_reports?: number
          last_trade_at?: string | null
          risk_level?: string
          risk_score?: number
          total_trades?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          assigned_moderator_id: string | null
          buyer_id: string
          buyer_rating: number | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          crypto_amount: number
          crypto_type: string
          dispute_reason: string | null
          dispute_resolution_summary: string | null
          disputed_at: string | null
          disputed_by: string | null
          escrow_locked: boolean | null
          escrow_released: boolean | null
          expires_at: string | null
          fiat_amount: number
          fiat_currency: string | null
          id: string
          offer_id: string
          payment_confirmed_at: string | null
          payment_method: string
          resolution_type: string | null
          seller_id: string
          seller_rating: number | null
          status: Database["public"]["Enums"]["trade_status"] | null
          updated_at: string
        }
        Insert: {
          assigned_moderator_id?: string | null
          buyer_id: string
          buyer_rating?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          crypto_amount: number
          crypto_type: string
          dispute_reason?: string | null
          dispute_resolution_summary?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          escrow_locked?: boolean | null
          escrow_released?: boolean | null
          expires_at?: string | null
          fiat_amount: number
          fiat_currency?: string | null
          id?: string
          offer_id: string
          payment_confirmed_at?: string | null
          payment_method: string
          resolution_type?: string | null
          seller_id: string
          seller_rating?: number | null
          status?: Database["public"]["Enums"]["trade_status"] | null
          updated_at?: string
        }
        Update: {
          assigned_moderator_id?: string | null
          buyer_id?: string
          buyer_rating?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          crypto_amount?: number
          crypto_type?: string
          dispute_reason?: string | null
          dispute_resolution_summary?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          escrow_locked?: boolean | null
          escrow_released?: boolean | null
          expires_at?: string | null
          fiat_amount?: number
          fiat_currency?: string | null
          id?: string
          offer_id?: string
          payment_confirmed_at?: string | null
          payment_method?: string
          resolution_type?: string | null
          seller_id?: string
          seller_rating?: number | null
          status?: Database["public"]["Enums"]["trade_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_ledger: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          crypto_type: string
          description: string | null
          id: string
          ledger_type: string
          metadata: Json | null
          platform_wallet_id: string | null
          trade_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          crypto_type: string
          description?: string | null
          id?: string
          ledger_type: string
          metadata?: Json | null
          platform_wallet_id?: string | null
          trade_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          crypto_type?: string
          description?: string | null
          id?: string
          ledger_type?: string
          metadata?: Json | null
          platform_wallet_id?: string | null
          trade_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_ledger_platform_wallet_id_fkey"
            columns: ["platform_wallet_id"]
            isOneToOne: false
            referencedRelation: "platform_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_ledger_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_fingerprints: {
        Row: {
          action_type: string
          browser: string | null
          created_at: string
          device_hash: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          operating_system: string | null
          screen_resolution: string | null
          timezone: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          browser?: string | null
          created_at?: string
          device_hash?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          operating_system?: string | null
          screen_resolution?: string | null
          timezone?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          browser?: string | null
          created_at?: string
          device_hash?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          operating_system?: string | null
          screen_resolution?: string | null
          timezone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_risk_alerts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_resolved: boolean
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          risk_type: string
          severity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_resolved?: boolean
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_type: string
          severity?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_resolved?: boolean
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_type?: string
          severity?: string
          user_id?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_settings: {
        Row: {
          created_at: string
          email_notifications: boolean | null
          id: string
          preferred_currency: string | null
          push_notifications: boolean | null
          sms_notifications: boolean | null
          theme: string | null
          transaction_alerts: boolean | null
          two_factor_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          preferred_currency?: string | null
          push_notifications?: boolean | null
          sms_notifications?: boolean | null
          theme?: string | null
          transaction_alerts?: boolean | null
          two_factor_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          preferred_currency?: string | null
          push_notifications?: boolean | null
          sms_notifications?: boolean | null
          theme?: string | null
          transaction_alerts?: boolean | null
          two_factor_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_trading_stats: {
        Row: {
          created_at: string
          daily_reset_at: string
          daily_trade_count: number
          daily_trade_volume: number
          id: string
          last_trade_at: string | null
          monthly_reset_at: string
          monthly_trade_count: number
          monthly_trade_volume: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_reset_at?: string
          daily_trade_count?: number
          daily_trade_volume?: number
          id?: string
          last_trade_at?: string | null
          monthly_reset_at?: string
          monthly_trade_count?: number
          monthly_trade_volume?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_reset_at?: string
          daily_trade_count?: number
          daily_trade_volume?: number
          id?: string
          last_trade_at?: string | null
          monthly_reset_at?: string
          monthly_trade_count?: number
          monthly_trade_volume?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_transfer_freeze: {
        Row: {
          frozen_at: string
          frozen_by: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          frozen_at?: string
          frozen_by: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          frozen_at?: string
          frozen_by?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_trusts: {
        Row: {
          created_at: string
          id: string
          trusted_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          trusted_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          trusted_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          confirmations: number | null
          created_at: string
          crypto_type: string
          description: string | null
          fee: number | null
          id: string
          mpesa_receipt: string | null
          network: string | null
          reference: string | null
          status: string | null
          trade_id: string | null
          tx_hash: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          confirmations?: number | null
          created_at?: string
          crypto_type: string
          description?: string | null
          fee?: number | null
          id?: string
          mpesa_receipt?: string | null
          network?: string | null
          reference?: string | null
          status?: string | null
          trade_id?: string | null
          tx_hash?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          confirmations?: number | null
          created_at?: string
          crypto_type?: string
          description?: string | null
          fee?: number | null
          id?: string
          mpesa_receipt?: string | null
          network?: string | null
          reference?: string | null
          status?: string | null
          trade_id?: string | null
          tx_hash?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          address: string | null
          balance: number
          created_at: string
          crypto_type: string
          id: string
          locked_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          balance?: number
          created_at?: string
          crypto_type: string
          id?: string
          locked_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          balance?: number
          created_at?: string
          crypto_type?: string
          id?: string
          locked_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_disable_offer: {
        Args: { p_offer_id: string; p_reason?: string }
        Returns: Json
      }
      assert_trade_transition: {
        Args: {
          p_new_status: Database["public"]["Enums"]["trade_status"]
          p_trade_id: string
        }
        Returns: Database["public"]["Enums"]["trade_status"]
      }
      assign_dispute_moderator: {
        Args: {
          p_moderator_id: string
          p_notes?: string
          p_priority?: string
          p_trade_id: string
        }
        Returns: string
      }
      auto_assign_dispute_moderator: {
        Args: { p_trade_id: string }
        Returns: Json
      }
      cancel_expired_trades: { Args: never; Returns: Json }
      check_country_trading: {
        Args: {
          p_country_code: string
          p_user_kyc_tier: Database["public"]["Enums"]["kyc_tier"]
        }
        Returns: Json
      }
      check_kyc_trade_limits: {
        Args: {
          p_action: string
          p_amount: number
          p_payment_method?: string
          p_user_id: string
        }
        Returns: Json
      }
      check_payment_method_allowed: {
        Args: {
          p_country_code: string
          p_payment_method: string
          p_user_kyc_tier: Database["public"]["Enums"]["kyc_tier"]
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: { p_action_type: string; p_ip_address: string; p_user_id: string }
        Returns: Json
      }
      claim_idempotency_key: {
        Args: {
          p_actor_id?: string
          p_key: string
          p_reference_id?: string
          p_scope: string
        }
        Returns: Json
      }
      claim_kyc_fingerprints: {
        Args: {
          p_fingerprints: Json
          p_submission_id: string
          p_user_id: string
        }
        Returns: Json
      }
      cleanup_expired_otps: { Args: never; Returns: number }
      cleanup_expired_rate_limits: { Args: never; Returns: number }
      cleanup_idempotency_keys: { Args: never; Returns: number }
      complete_idempotency_key: {
        Args: { p_key: string; p_response?: Json }
        Returns: undefined
      }
      create_notification: {
        Args: {
          p_data?: Json
          p_message: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      create_sell_offer_with_reservation: {
        Args: {
          p_crypto_amount: number
          p_crypto_type: string
          p_fiat_currency: string
          p_max_amount: number
          p_min_amount: number
          p_payment_methods: string[]
          p_price_margin: number
          p_price_per_unit: number
          p_terms: string
          p_time_limit: number
          p_user_id: string
        }
        Returns: Json
      }
      credit_buyer_wallet: {
        Args: { p_amount: number; p_wallet_id: string }
        Returns: undefined
      }
      credit_deposit: {
        Args: {
          p_amount: number
          p_crypto_type: string
          p_idempotency_key?: string
          p_network?: string
          p_simulated?: boolean
          p_tx_hash: string
          p_user_id: string
        }
        Returns: Json
      }
      escalate_breached_disputes: { Args: never; Returns: Json }
      execute_internal_transfer: {
        Args: {
          p_amount: number
          p_crypto_type: string
          p_recipient_username: string
        }
        Returns: Json
      }
      fail_idempotency_key: {
        Args: { p_error?: string; p_key: string }
        Returns: undefined
      }
      finalize_kyc_decision: {
        Args: {
          p_decision: string
          p_notes?: string
          p_reviewer: string
          p_submission_id: string
        }
        Returns: Json
      }
      freeze_user: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: Json
      }
      generate_otp_code: {
        Args: {
          p_action_type: string
          p_expiry_minutes?: number
          p_metadata?: Json
          p_method?: string
          p_user_id: string
        }
        Returns: Json
      }
      generate_random_username: { Args: never; Returns: string }
      get_available_balance: {
        Args: { p_crypto_type: string; p_user_id: string }
        Returns: number
      }
      get_or_create_deposit_address: {
        Args: { p_crypto_type: string; p_user_id: string }
        Returns: {
          address: string
          is_new: boolean
        }[]
      }
      get_or_create_wallet: {
        Args: { p_crypto_type: string; p_user_id: string }
        Returns: string
      }
      get_trader_public_stats: { Args: { p_user_id: string }; Returns: Json }
      get_trader_reviews: { Args: { p_user_id: string }; Returns: Json }
      get_user_by_username: { Args: { p_username: string }; Returns: Json }
      get_user_kyc_tier: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["kyc_tier"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_asset_transfer_disabled: {
        Args: { p_crypto_type: string }
        Returns: boolean
      }
      is_platform_enabled: { Args: { p_setting_id: string }; Returns: boolean }
      is_user_frozen: { Args: { p_user_id: string }; Returns: boolean }
      lock_escrow:
        | {
            Args: {
              p_amount: number
              p_crypto_type: string
              p_seller_id: string
              p_trade_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount: number
              p_crypto_type: string
              p_idempotency_key: string
              p_seller_id: string
              p_trade_id: string
            }
            Returns: Json
          }
      lock_trade_evidence: {
        Args: { p_trade_id: string; p_uploader_role: string }
        Returns: boolean
      }
      log_abuse_flag: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_flag_type: string
          p_ip_address: string
          p_severity: string
          p_user_id: string
        }
        Returns: string
      }
      log_admin_action: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_reason?: string
          p_target_id?: string
          p_target_type: string
        }
        Returns: string
      }
      log_buyer_transaction: {
        Args: {
          p_amount: number
          p_crypto_type: string
          p_trade_id: string
          p_user_id: string
          p_wallet_id: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          p_action_type: string
          p_ip_address?: string
          p_metadata?: Json
          p_method?: string
          p_status: string
          p_user_agent?: string
        }
        Returns: string
      }
      moderator_post_message: {
        Args: { p_is_system?: boolean; p_message: string; p_trade_id: string }
        Returns: string
      }
      recalculate_trader_risk: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      release_escrow_with_fee:
        | {
            Args: {
              p_buyer_id: string
              p_crypto_type: string
              p_escrow_amount: number
              p_seller_id: string
              p_trade_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_buyer_id: string
              p_crypto_type: string
              p_escrow_amount: number
              p_idempotency_key: string
              p_seller_id: string
              p_trade_id: string
            }
            Returns: Json
          }
      reset_trading_stats_if_needed: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      resolve_dispute: {
        Args: {
          p_resolution_notes: string
          p_resolution_type: string
          p_trade_id: string
        }
        Returns: Json
      }
      return_escrow_with_reservation:
        | {
            Args: {
              p_amount: number
              p_crypto_type: string
              p_seller_id: string
              p_trade_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount: number
              p_crypto_type: string
              p_idempotency_key: string
              p_seller_id: string
              p_trade_id: string
            }
            Returns: Json
          }
      reverse_internal_transfer: {
        Args: { p_reason: string; p_transfer_id: string }
        Returns: Json
      }
      toggle_platform_setting: {
        Args: { p_enabled: boolean; p_setting_id: string }
        Returns: Json
      }
      unfreeze_user: { Args: { p_user_id: string }; Returns: Json }
      update_last_seen: { Args: never; Returns: undefined }
      update_trading_stats: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      validate_trade_action: {
        Args: {
          p_action: string
          p_amount: number
          p_ip_address?: string
          p_payment_method: string
          p_user_id: string
        }
        Returns: Json
      }
      verify_otp_code: {
        Args: { p_action_type: string; p_code: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      kyc_status: "pending" | "submitted" | "verified" | "rejected"
      kyc_tier: "unverified" | "level_1" | "level_2" | "level_3"
      notification_type: "trade" | "payment" | "kyc" | "system" | "message"
      offer_type: "buy" | "sell"
      trade_status:
        | "pending"
        | "confirmed"
        | "payment_sent"
        | "completed"
        | "disputed"
        | "cancelled"
      transaction_type:
        | "deposit"
        | "withdrawal"
        | "escrow_lock"
        | "escrow_release"
        | "trade"
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
      kyc_status: ["pending", "submitted", "verified", "rejected"],
      kyc_tier: ["unverified", "level_1", "level_2", "level_3"],
      notification_type: ["trade", "payment", "kyc", "system", "message"],
      offer_type: ["buy", "sell"],
      trade_status: [
        "pending",
        "confirmed",
        "payment_sent",
        "completed",
        "disputed",
        "cancelled",
      ],
      transaction_type: [
        "deposit",
        "withdrawal",
        "escrow_lock",
        "escrow_release",
        "trade",
      ],
    },
  },
} as const
