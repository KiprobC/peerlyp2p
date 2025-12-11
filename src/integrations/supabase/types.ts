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
          created_at: string
          crypto_amount: number
          crypto_type: string
          fiat_currency: string | null
          id: string
          is_active: boolean | null
          max_amount: number
          min_amount: number
          payment_methods: string[]
          price_per_unit: number
          terms: string | null
          time_limit: number | null
          total_trades: number | null
          type: Database["public"]["Enums"]["offer_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crypto_amount: number
          crypto_type: string
          fiat_currency?: string | null
          id?: string
          is_active?: boolean | null
          max_amount: number
          min_amount: number
          payment_methods: string[]
          price_per_unit: number
          terms?: string | null
          time_limit?: number | null
          total_trades?: number | null
          type: Database["public"]["Enums"]["offer_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crypto_amount?: number
          crypto_type?: string
          fiat_currency?: string | null
          id?: string
          is_active?: boolean | null
          max_amount?: number
          min_amount?: number
          payment_methods?: string[]
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
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
