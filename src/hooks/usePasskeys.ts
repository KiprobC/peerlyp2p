import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { toast } from "sonner";

export interface Passkey {
  id: string;
  credential_id: string;
  device_name: string;
  last_used_at: string | null;
  created_at: string;
}

export const usePasskeys = () => {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("passkeys" as any)
      .select("id, credential_id, device_name, last_used_at, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setPasskeys(data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  const registerPasskey = useCallback(
    async (deviceName: string) => {
      if (!browserSupportsWebAuthn()) {
        toast.error("Your browser doesn't support passkeys");
        return false;
      }
      try {
        const { data: begin, error: bErr } = await supabase.functions.invoke("passkey-register-begin");
        if (bErr || !begin?.options) throw new Error(bErr?.message || "Failed to start registration");
        const attestation = await startRegistration({ optionsJSON: begin.options });
        const { data: finish, error: fErr } = await supabase.functions.invoke("passkey-register-finish", {
          body: { response: attestation, deviceName },
        });
        if (fErr || !finish?.verified) throw new Error(fErr?.message || finish?.error || "Verification failed");
        toast.success("Passkey registered");
        await fetchPasskeys();
        return true;
      } catch (e: any) {
        if (e.name === "NotAllowedError") {
          toast.error("Registration cancelled");
        } else {
          toast.error(e.message || "Failed to register passkey");
        }
        return false;
      }
    },
    [fetchPasskeys]
  );

  const renamePasskey = useCallback(
    async (id: string, name: string) => {
      const { error } = await supabase.from("passkeys" as any).update({ device_name: name }).eq("id", id);
      if (error) {
        toast.error("Failed to rename");
        return;
      }
      toast.success("Renamed");
      fetchPasskeys();
    },
    [fetchPasskeys]
  );

  const deletePasskey = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("passkeys" as any).delete().eq("id", id);
      if (error) {
        toast.error("Failed to remove");
        return;
      }
      toast.success("Passkey removed");
      fetchPasskeys();
    },
    [fetchPasskeys]
  );

  /** Step-up auth using passkey. Returns true if verified. */
  const stepUpVerify = useCallback(async (): Promise<boolean> => {
    if (!browserSupportsWebAuthn()) return false;
    try {
      const { data: begin, error: bErr } = await supabase.functions.invoke("passkey-auth-begin", {
        body: { purpose: "step_up" },
      });
      if (bErr || !begin?.hasPasskey || !begin?.options) return false;
      const assertion = await startAuthentication({ optionsJSON: begin.options });
      const { data: finish, error: fErr } = await supabase.functions.invoke("passkey-auth-finish", {
        body: { response: assertion, purpose: "step_up" },
      });
      if (fErr || !finish?.verified) {
        toast.error(fErr?.message || "Passkey verification failed");
        return false;
      }
      return true;
    } catch (e: any) {
      if (e.name !== "NotAllowedError") toast.error(e.message || "Passkey verification failed");
      return false;
    }
  }, []);

  return { passkeys, loading, fetchPasskeys, registerPasskey, renamePasskey, deletePasskey, stepUpVerify };
};

/** Login-time passkey: verifies and returns true if user proven by passkey. */
export const loginWithPasskey = async (email: string): Promise<{ verified: boolean; userId?: string }> => {
  if (!browserSupportsWebAuthn()) return { verified: false };
  const { data: begin } = await supabase.functions.invoke("passkey-auth-begin", {
    body: { email, purpose: "authentication" },
  });
  if (!begin?.hasPasskey || !begin?.options) return { verified: false };
  try {
    const assertion = await startAuthentication({ optionsJSON: begin.options });
    const { data: finish, error } = await supabase.functions.invoke("passkey-auth-finish", {
      body: { response: assertion, email, purpose: "authentication" },
    });
    if (error || !finish?.verified) return { verified: false };
    return { verified: true, userId: finish.userId };
  } catch {
    return { verified: false };
  }
};

export const checkHasPasskey = async (email: string): Promise<boolean> => {
  try {
    const { data } = await supabase.functions.invoke("passkey-auth-begin", {
      body: { email, purpose: "authentication" },
    });
    return !!data?.hasPasskey;
  } catch {
    return false;
  }
};
