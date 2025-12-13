import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PlatformFee {
  id: string;
  fee_type: string;
  percentage: number;
  min_amount: number | null;
  max_amount: number | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const usePlatformFees = () => {
  const [fees, setFees] = useState<PlatformFee[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchFees = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_fees")
        .select("*")
        .order("fee_type");

      if (error) throw error;
      setFees(data || []);
    } catch (error) {
      console.error("Error fetching fees:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateFee = async (id: string, updates: Partial<PlatformFee>) => {
    try {
      const { error } = await supabase
        .from("platform_fees")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      
      setFees(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
      toast({ title: "Fee updated successfully" });
      return true;
    } catch (error) {
      console.error("Error updating fee:", error);
      toast({ title: "Failed to update fee", variant: "destructive" });
      return false;
    }
  };

  const getFeeByType = (type: string) => {
    return fees.find(f => f.fee_type === type && f.is_active);
  };

  const calculateFee = (type: string, amount: number): number => {
    const fee = getFeeByType(type);
    if (!fee) return 0;
    
    let calculatedFee = (amount * fee.percentage) / 100;
    
    if (fee.min_amount && calculatedFee < fee.min_amount) {
      calculatedFee = fee.min_amount;
    }
    if (fee.max_amount && calculatedFee > fee.max_amount) {
      calculatedFee = fee.max_amount;
    }
    
    return calculatedFee;
  };

  useEffect(() => {
    fetchFees();
  }, []);

  return {
    fees,
    loading,
    updateFee,
    getFeeByType,
    calculateFee,
    refetch: fetchFees,
  };
};
