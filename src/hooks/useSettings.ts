import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserSettings {
  id: string;
  user_id: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  transaction_alerts: boolean;
  two_factor_enabled: boolean;
  preferred_currency: string;
  theme: string;
  created_at: string;
  updated_at: string;
}

export const useSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      // Create settings if they don't exist
      if (!data) {
        const { data: newSettings, error: insertError } = await supabase
          .from("user_settings")
          .insert({ user_id: user.id })
          .select()
          .single();
        
        if (insertError) throw insertError;
        setSettings(newSettings);
      } else {
        setSettings(data);
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!user) return { error: new Error("Not authenticated") };

    try {
      const { error } = await supabase
        .from("user_settings")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;
      
      await fetchSettings();
      toast.success("Settings updated successfully");
      return { error: null };
    } catch (error: any) {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
      return { error };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  return { settings, loading, updateSettings, refetch: fetchSettings };
};
