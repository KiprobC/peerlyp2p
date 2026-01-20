import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export interface PlatformSetting {
  id: string;
  value: {
    enabled: boolean;
    disabled_assets?: string[];
  };
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface FrozenUser {
  id: string;
  user_id: string;
  frozen_by: string;
  reason: string | null;
  frozen_at: string;
}

export interface CountryRiskSetting {
  id: string;
  country_code: string;
  trading_enabled: boolean;
  min_kyc_tier: 'unverified' | 'level_1' | 'level_2' | 'level_3';
  risk_level: 'low' | 'medium' | 'high' | 'blocked';
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodRestriction {
  id: string;
  country_code: string;
  payment_method: string;
  is_allowed: boolean;
  min_kyc_tier: 'unverified' | 'level_1' | 'level_2' | 'level_3';
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskFlag {
  id: string;
  flag_type: 'country_mismatch' | 'high_volume' | 'new_account' | 'payment_pattern' | 'custom';
  condition: Record<string, unknown>;
  action: 'block' | 'require_review' | 'flag' | 'increase_kyc';
  severity: 'low' | 'medium' | 'high' | 'critical';
  is_active: boolean;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const usePlatformSettings = () => {
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .order("id");

      if (error) throw error;
      setSettings((data || []).map(d => ({
        ...d,
        value: d.value as PlatformSetting['value']
      })));
    } catch (error) {
      console.error("Error fetching platform settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSetting = async (settingId: string, enabled: boolean) => {
    try {
      const { data, error } = await supabase.rpc('toggle_platform_setting', {
        p_setting_id: settingId,
        p_enabled: enabled
      });

      if (error) throw error;
      
      toast({
        title: enabled ? "Feature enabled" : "Feature disabled",
        description: `${settingId.replace(/_/g, ' ')} has been ${enabled ? 'enabled' : 'disabled'}`,
      });
      
      await fetchSettings();
      return true;
    } catch (error: any) {
      console.error("Error toggling setting:", error);
      toast({
        title: "Failed to update setting",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, toggleSetting, refetch: fetchSettings };
};

export const useFrozenUsers = () => {
  const [frozenUsers, setFrozenUsers] = useState<FrozenUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchFrozenUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("user_transfer_freeze")
        .select("*")
        .order("frozen_at", { ascending: false });

      if (error) throw error;
      setFrozenUsers(data || []);
    } catch (error) {
      console.error("Error fetching frozen users:", error);
    } finally {
      setLoading(false);
    }
  };

  const freezeUser = async (userId: string, reason?: string) => {
    try {
      const { data, error } = await supabase.rpc('freeze_user', {
        p_user_id: userId,
        p_reason: reason || null
      });

      if (error) throw error;
      
      toast({ title: "User frozen", description: "The user account has been restricted" });
      await fetchFrozenUsers();
      return true;
    } catch (error: any) {
      console.error("Error freezing user:", error);
      toast({ title: "Failed to freeze user", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const unfreezeUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('unfreeze_user', {
        p_user_id: userId
      });

      if (error) throw error;
      
      toast({ title: "User unfrozen", description: "The user account has been restored" });
      await fetchFrozenUsers();
      return true;
    } catch (error: any) {
      console.error("Error unfreezing user:", error);
      toast({ title: "Failed to unfreeze user", description: error.message, variant: "destructive" });
      return false;
    }
  };

  useEffect(() => {
    fetchFrozenUsers();
  }, []);

  return { frozenUsers, loading, freezeUser, unfreezeUser, refetch: fetchFrozenUsers };
};

export const useCountryRiskSettings = () => {
  const [countrySettings, setCountrySettings] = useState<CountryRiskSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCountrySettings = async () => {
    try {
      const { data, error } = await supabase
        .from("country_risk_settings")
        .select("*")
        .order("country_code");

      if (error) throw error;
      setCountrySettings((data || []).map(d => ({
        ...d,
        min_kyc_tier: d.min_kyc_tier as CountryRiskSetting['min_kyc_tier'],
        risk_level: d.risk_level as CountryRiskSetting['risk_level']
      })));
    } catch (error) {
      console.error("Error fetching country settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const upsertCountrySetting = async (setting: Partial<CountryRiskSetting> & { country_code: string }) => {
    try {
      const { error } = await supabase
        .from("country_risk_settings")
        .upsert({
          ...setting,
          updated_at: new Date().toISOString()
        }, { onConflict: 'country_code' });

      if (error) throw error;
      
      toast({ title: "Country settings saved" });
      await fetchCountrySettings();
      return true;
    } catch (error: any) {
      console.error("Error saving country setting:", error);
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const deleteCountrySetting = async (id: string) => {
    try {
      const { error } = await supabase
        .from("country_risk_settings")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast({ title: "Country setting removed" });
      await fetchCountrySettings();
      return true;
    } catch (error: any) {
      console.error("Error deleting country setting:", error);
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return false;
    }
  };

  useEffect(() => {
    fetchCountrySettings();
  }, []);

  return { countrySettings, loading, upsertCountrySetting, deleteCountrySetting, refetch: fetchCountrySettings };
};

export const usePaymentMethodRestrictions = () => {
  const [restrictions, setRestrictions] = useState<PaymentMethodRestriction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRestrictions = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_method_restrictions")
        .select("*")
        .order("country_code");

      if (error) throw error;
      setRestrictions((data || []).map(d => ({
        ...d,
        min_kyc_tier: d.min_kyc_tier as PaymentMethodRestriction['min_kyc_tier']
      })));
    } catch (error) {
      console.error("Error fetching restrictions:", error);
    } finally {
      setLoading(false);
    }
  };

  const upsertRestriction = async (restriction: Partial<PaymentMethodRestriction> & { country_code: string; payment_method: string }) => {
    try {
      const { error } = await supabase
        .from("payment_method_restrictions")
        .upsert({
          ...restriction,
          updated_at: new Date().toISOString()
        }, { onConflict: 'country_code,payment_method' });

      if (error) throw error;
      
      toast({ title: "Restriction saved" });
      await fetchRestrictions();
      return true;
    } catch (error: any) {
      console.error("Error saving restriction:", error);
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const deleteRestriction = async (id: string) => {
    try {
      const { error } = await supabase
        .from("payment_method_restrictions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast({ title: "Restriction removed" });
      await fetchRestrictions();
      return true;
    } catch (error: any) {
      console.error("Error deleting restriction:", error);
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return false;
    }
  };

  useEffect(() => {
    fetchRestrictions();
  }, []);

  return { restrictions, loading, upsertRestriction, deleteRestriction, refetch: fetchRestrictions };
};

export const useRiskFlags = () => {
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRiskFlags = async () => {
    try {
      const { data, error } = await supabase
        .from("risk_flags")
        .select("*")
        .order("severity", { ascending: false });

      if (error) throw error;
      setRiskFlags((data || []).map(d => ({
        ...d,
        flag_type: d.flag_type as RiskFlag['flag_type'],
        action: d.action as RiskFlag['action'],
        severity: d.severity as RiskFlag['severity'],
        condition: d.condition as Record<string, unknown>
      })));
    } catch (error) {
      console.error("Error fetching risk flags:", error);
    } finally {
      setLoading(false);
    }
  };

  const createRiskFlag = async (flag: Omit<RiskFlag, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    try {
      const { error } = await supabase
        .from("risk_flags")
        .insert({
          flag_type: flag.flag_type,
          condition: flag.condition as Json,
          action: flag.action,
          severity: flag.severity,
          is_active: flag.is_active,
          description: flag.description
        });

      if (error) throw error;
      
      toast({ title: "Risk flag created" });
      await fetchRiskFlags();
      return true;
    } catch (error: any) {
      console.error("Error creating risk flag:", error);
      toast({ title: "Failed to create", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const updateRiskFlag = async (id: string, updates: Partial<RiskFlag>) => {
    try {
      const { is_active, description, severity, action } = updates;
      const { error } = await supabase
        .from("risk_flags")
        .update({ is_active, description, severity, action, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      
      toast({ title: "Risk flag updated" });
      await fetchRiskFlags();
      return true;
    } catch (error: any) {
      console.error("Error updating risk flag:", error);
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const deleteRiskFlag = async (id: string) => {
    try {
      const { error } = await supabase
        .from("risk_flags")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast({ title: "Risk flag deleted" });
      await fetchRiskFlags();
      return true;
    } catch (error: any) {
      console.error("Error deleting risk flag:", error);
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return false;
    }
  };

  useEffect(() => {
    fetchRiskFlags();
  }, []);

  return { riskFlags, loading, createRiskFlag, updateRiskFlag, deleteRiskFlag, refetch: fetchRiskFlags };
};

export const useAdminOfferControl = () => {
  const { toast } = useToast();

  const disableOffer = async (offerId: string, reason?: string) => {
    try {
      const { data, error } = await supabase.rpc('admin_disable_offer', {
        p_offer_id: offerId,
        p_reason: reason || null
      });

      if (error) throw error;
      
      toast({ title: "Offer disabled", description: "The offer has been deactivated" });
      return true;
    } catch (error: any) {
      console.error("Error disabling offer:", error);
      toast({ title: "Failed to disable offer", description: error.message, variant: "destructive" });
      return false;
    }
  };

  return { disableOffer };
};
