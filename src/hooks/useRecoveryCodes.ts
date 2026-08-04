import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generateRecoveryCodes } from "@/lib/recoveryCodes";

/**
 * Recovery codes are shown exactly once, at generation time.
 * The server only ever stores SHA-256 hashes, so a set can never be re-displayed —
 * it can only be regenerated (which invalidates the previous set).
 */
export const useRecoveryCodes = () => {
  const { user } = useAuth();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setRemaining(null);
      return;
    }
    const { data, error } = await (supabase.rpc as any)("count_unused_recovery_codes");
    if (error) {
      console.error("Failed to count recovery codes:", error.message);
      return;
    }
    setRemaining(Number(data ?? 0));
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Generates a fresh set, persists hashes, and returns the plaintext once. */
  const regenerate = useCallback(async (): Promise<
    { codes: string[]; error: null } | { codes: null; error: string }
  > => {
    setLoading(true);
    try {
      const codes = generateRecoveryCodes();
      const { error } = await (supabase.rpc as any)("regenerate_recovery_codes", {
        p_codes: codes,
      });
      if (error) throw error;
      await refresh();
      return { codes, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to generate recovery codes";
      return { codes: null, error: message };
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  return { remaining, loading, refresh, regenerate };
};
