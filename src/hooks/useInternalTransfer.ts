import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RecipientPreview {
  user_id: string;
  username: string;
  avatar_url: string | null;
  rating: number;
  total_trades: number;
  is_verified: boolean;
  member_since: string;
}

export interface InternalTransfer {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_username: string;
  recipient_username: string;
  crypto_type: string;
  amount: number;
  status: string;
  reversed_at: string | null;
  reversal_reason: string | null;
  created_at: string;
}

export const useInternalTransfer = () => {
  const [loading, setLoading] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreview | null>(null);
  const [transfers, setTransfers] = useState<InternalTransfer[]>([]);
  const { toast } = useToast();

  const lookupUsername = async (username: string): Promise<RecipientPreview | null> => {
    if (!username.trim()) {
      setRecipientPreview(null);
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_user_by_username", {
        p_username: username.replace("@", "").trim(),
      });

      if (error) throw error;
      
      if (data && typeof data === 'object') {
        const preview = data as unknown as RecipientPreview;
        setRecipientPreview(preview);
        return preview;
      } else {
        setRecipientPreview(null);
        return null;
      }
    } catch (error) {
      console.error("Error looking up username:", error);
      setRecipientPreview(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const executeTransfer = async (
    recipientUsername: string,
    cryptoType: string,
    amount: number
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("execute_internal_transfer", {
        p_recipient_username: recipientUsername.replace("@", "").trim(),
        p_crypto_type: cryptoType,
        p_amount: amount,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; transfer_id?: string };

      if (result.success) {
        toast({
          title: "Transfer Successful",
          description: `Sent ${amount} ${cryptoType} to @${recipientUsername}`,
        });
        return true;
      } else {
        toast({
          title: "Transfer Failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      console.error("Transfer error:", error);
      toast({
        title: "Transfer Failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const fetchTransfers = async () => {
    try {
      const { data, error } = await supabase
        .from("internal_transfers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransfers((data as InternalTransfer[]) || []);
    } catch (error) {
      console.error("Error fetching transfers:", error);
    }
  };

  const clearRecipientPreview = () => {
    setRecipientPreview(null);
  };

  return {
    loading,
    recipientPreview,
    transfers,
    lookupUsername,
    executeTransfer,
    fetchTransfers,
    clearRecipientPreview,
  };
};
