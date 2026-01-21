import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface TradeEvidence {
  id: string;
  trade_id: string;
  uploader_id: string;
  uploader_role: "buyer" | "seller" | "moderator";
  evidence_type: "payment_proof" | "dispute_evidence" | "additional_info" | "chat_attachment";
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  is_locked: boolean;
  locked_at: string | null;
  created_at: string;
}

export const useTradeEvidence = (tradeId: string) => {
  const { user } = useAuth();
  const [evidence, setEvidence] = useState<TradeEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchEvidence = useCallback(async () => {
    if (!tradeId) return;

    try {
      const { data, error } = await supabase
        .from("trade_evidence")
        .select("*")
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setEvidence((data || []) as TradeEvidence[]);
    } catch (error) {
      console.error("Error fetching evidence:", error);
    } finally {
      setLoading(false);
    }
  }, [tradeId]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  // Real-time subscription
  useEffect(() => {
    if (!tradeId) return;

    const channel = supabase
      .channel(`trade-evidence-${tradeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trade_evidence",
          filter: `trade_id=eq.${tradeId}`,
        },
        () => {
          fetchEvidence();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tradeId, fetchEvidence]);

  const uploadEvidence = async (
    file: File,
    evidenceType: TradeEvidence["evidence_type"],
    uploaderRole: "buyer" | "seller",
    description?: string
  ): Promise<{ success: boolean; error?: string; fileUrl?: string }> => {
    if (!user || !tradeId) {
      return { success: false, error: "Not authenticated" };
    }

    setUploading(true);

    try {
      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${tradeId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("trade-evidence")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("trade-evidence")
        .getPublicUrl(fileName);

      // Insert evidence record
      const { error: insertError } = await supabase
        .from("trade_evidence")
        .insert({
          trade_id: tradeId,
          uploader_id: user.id,
          uploader_role: uploaderRole,
          evidence_type: evidenceType,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          description,
        });

      if (insertError) throw insertError;

      const successMsg = evidenceType === "chat_attachment" ? "File attached" : "Evidence uploaded successfully";
      toast.success(successMsg);
      await fetchEvidence();
      return { success: true, fileUrl: urlData.publicUrl };
    } catch (error: any) {
      console.error("Error uploading evidence:", error);
      toast.error("Failed to upload evidence");
      return { success: false, error: error.message };
    } finally {
      setUploading(false);
    }
  };

  const lockEvidence = async (uploaderRole: string): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc("lock_trade_evidence", {
        p_trade_id: tradeId,
        p_uploader_role: uploaderRole,
      });

      if (error) throw error;
      await fetchEvidence();
      return true;
    } catch (error) {
      console.error("Error locking evidence:", error);
      return false;
    }
  };

  const buyerEvidence = evidence.filter((e) => e.uploader_role === "buyer");
  const sellerEvidence = evidence.filter((e) => e.uploader_role === "seller");
  const moderatorEvidence = evidence.filter((e) => e.uploader_role === "moderator");
  const paymentProofs = evidence.filter((e) => e.evidence_type === "payment_proof");

  return {
    evidence,
    buyerEvidence,
    sellerEvidence,
    moderatorEvidence,
    paymentProofs,
    loading,
    uploading,
    uploadEvidence,
    lockEvidence,
    refetch: fetchEvidence,
  };
};
