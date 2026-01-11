import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DepositAddress {
  id: string;
  user_id: string;
  crypto_type: string;
  address: string;
  network: string;
  is_active: boolean;
  address_generated_at: string;
  last_monitored_at: string | null;
  total_deposited: number;
  pending_amount: number;
  last_deposit_at: string | null;
}

export const useDepositAddresses = () => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Record<string, DepositAddress>>({});
  const [loading, setLoading] = useState(true);

  const fetchAddresses = async () => {
    if (!user) {
      setAddresses({});
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("deposit_addresses")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (error) throw error;

      const addressMap: Record<string, DepositAddress> = {};
      (data || []).forEach((addr) => {
        addressMap[addr.crypto_type] = addr as DepositAddress;
      });
      setAddresses(addressMap);
    } catch (error) {
      console.error("Error fetching deposit addresses:", error);
    } finally {
      setLoading(false);
    }
  };

  const getOrCreateAddress = async (cryptoType: string): Promise<string | null> => {
    if (!user) return null;

    try {
      // First check if we already have it cached
      if (addresses[cryptoType.toUpperCase()]) {
        return addresses[cryptoType.toUpperCase()].address;
      }

      // Call the database function to get or create
      const { data, error } = await supabase.rpc("get_or_create_deposit_address", {
        p_user_id: user.id,
        p_crypto_type: cryptoType,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        // Refresh addresses to update cache
        await fetchAddresses();
        return data[0].address;
      }

      return null;
    } catch (error) {
      console.error("Error getting/creating deposit address:", error);
      return null;
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, [user]);

  return {
    addresses,
    loading,
    getOrCreateAddress,
    refetch: fetchAddresses,
  };
};
