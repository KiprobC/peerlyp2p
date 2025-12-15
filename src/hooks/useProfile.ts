import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  username_changed: boolean;
  phone: string | null;
  date_of_birth: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  kyc_status: "pending" | "submitted" | "verified" | "rejected";
  kyc_submitted_at: string | null;
  kyc_verified_at: string | null;
  id_type: string | null;
  id_number: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  selfie_url: string | null;
  mpesa_phone: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  avatar_url: string | null;
  bio: string | null;
  total_trades: number;
  successful_trades: number;
  rating: number;
  is_verified: boolean;
  setup_step: number;
  setup_completed: boolean;
  created_at: string;
  updated_at: string;
}

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error("Not authenticated") };

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;
      
      await fetchProfile();
      return { error: null };
    } catch (error: any) {
      console.error("Error updating profile:", error);
      return { error };
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  return { profile, loading, updateProfile, refetch: fetchProfile };
};
