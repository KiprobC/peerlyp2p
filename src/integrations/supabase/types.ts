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
      dispute_assignments: {
        Row: {
          assigned_by: string
          assigned_to: string
          created_at: string
          id: string
          notes: string | null
          priority: string
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          status: string
          trade_id: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          status?: string
          trade_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
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
          terms?: string | null
          time_limit?: number | null
          total_trades?: number | null
          type?: Database["public"]["Enums"]["offer_type"]
          updated_at?: string
          user_id?: string
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
          kyc_status: Database["public"]["Enums"]["kyc_status"] | null
          kyc_submitted_at: string | null
          kyc_verified_at: string | null
          last_seen: string | null
          mpesa_phone: string | null
          phone: string | null
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
          kyc_status?: Database["public"]["Enums"]["kyc_status"] | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          last_seen?: string | null
          mpesa_phone?: string | null
          phone?: string | null
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
          kyc_status?: Database["public"]["Enums"]["kyc_status"] | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          last_seen?: string | null
          mpesa_phone?: string | null
          phone?: string | null
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
      trades: {
        Row: {
          buyer_id: string
          buyer_rating: number | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          crypto_amount: number
          crypto_type: string
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          escrow_locked: boolean | null
          escrow_released: boolean | null
          fiat_amount: number
          fiat_currency: string | null
          id: string
          offer_id: string
          payment_confirmed_at: string | null
          payment_method: string
          seller_id: string
          seller_rating: number | null
          status: Database["public"]["Enums"]["trade_status"] | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          buyer_rating?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          crypto_amount: number
          crypto_type: string
          dispute_reason?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          escrow_locked?: boolean | null
          escrow_released?: boolean | null
          fiat_amount: number
          fiat_currency?: string | null
          id?: string
          offer_id: string
          payment_confirmed_at?: string | null
          payment_method: string
          seller_id: string
          seller_rating?: number | null
          status?: Database["public"]["Enums"]["trade_status"] | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          buyer_rating?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          crypto_amount?: number
          crypto_type?: string
          dispute_reason?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          escrow_locked?: boolean | null
          escrow_released?: boolean | null
          fiat_amount?: number
          fiat_currency?: string | null
          id?: string
          offer_id?: string
          payment_confirmed_at?: string | null
          payment_method?: string
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          crypto_type: string
          description: string | null
          fee: number | null
          id: string
          mpesa_receipt: string | null
          reference: string | null
          status: string | null
          trade_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          crypto_type: string
          description?: string | null
          fee?: number | null
          id?: string
          mpesa_receipt?: string | null
          reference?: string | null
          status?: string | null
          trade_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          crypto_type?: string
          description?: string | null
          fee?: number | null
          id?: string
          mpesa_receipt?: string | null
          reference?: string | null
          status?: string | null
          trade_id?: string | null
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
      assign_dispute_moderator: {
        Args: {
          p_moderator_id: string
          p_notes?: string
          p_priority?: string
          p_trade_id: string
        }
        Returns: string
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
      credit_buyer_wallet: {
        Args: { p_amount: number; p_wallet_id: string }
        Returns: undefined
      }
      generate_random_username: { Args: never; Returns: string }
      get_or_create_wallet: {
        Args: { p_crypto_type: string; p_user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lock_escrow: {
        Args: {
          p_amount: number
          p_crypto_type: string
          p_seller_id: string
          p_trade_id?: string
        }
        Returns: Json
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
      resolve_dispute: {
        Args: {
          p_resolution_notes: string
          p_resolution_type: string
          p_trade_id: string
        }
        Returns: Json
      }
      update_last_seen: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      kyc_status: "pending" | "submitted" | "verified" | "rejected"
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
