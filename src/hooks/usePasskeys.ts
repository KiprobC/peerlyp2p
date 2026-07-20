import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
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

    try {
      if (!browserSupportsWebAuthn()) {
        setPasskeys([]);
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.warn("No authenticated user.");
        setPasskeys([]);
        setLoading(false);
        return;
      }

      console.group("PASSKEY FETCH");
      console.log("Current user:", user.id);

      const { data, error } = await supabase
        .from("passkeys")
        .select(`
          id,
          credential_id,
          device_name,
          last_used_at,
          created_at
        `)
        .eq("user_id", user.id);

      console.log("Rows:", data?.length ?? 0);
      console.log("Data:", data);
      console.log("Error:", error);
      console.groupEnd();

      if (error) {
        console.error(error);
        toast.error("Unable to load passkeys.");
        setPasskeys([]);
      } else {
        setPasskeys(data ?? []);
      }
    } catch (err) {
      console.error(err);
      setPasskeys([]);
    } finally {
      setLoading(false);
    }
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
        console.group("PASSKEY REGISTER");

        const { data: begin, error: bErr } =
          await supabase.functions.invoke("passkey-register-begin");

        console.log("Begin response:", begin);
        console.log("Begin error:", bErr);

        if (bErr || !begin?.options) {
          throw new Error(
            bErr?.message || "Failed to start passkey registration"
          );
        }

        console.log("Starting WebAuthn registration...");

        const attestation = await startRegistration({
          optionsJSON: begin.options,
        });

        console.log("Attestation:", attestation);

        const { data: finish, error: fErr } =
          await supabase.functions.invoke(
            "passkey-register-finish",
            {
              body: {
                response: attestation,
                deviceName,
              },
            }
          );

        console.log("Finish response:", finish);
        console.log("Finish error:", fErr);

        console.groupEnd();

        if (fErr || !finish?.verified) {
          throw new Error(
            fErr?.message ||
              finish?.error ||
              "Passkey verification failed"
          );
        }

        toast.success("Passkey registered successfully");

        await fetchPasskeys();

        return true;
      } catch (e: any) {
        console.groupEnd();

        console.error("REGISTER ERROR:", e);

        switch (e.name) {
          case "NotAllowedError":
            toast.error("Registration cancelled.");
            break;

          case "InvalidStateError":
            toast.error("This passkey is already registered.");
            break;

          case "UnknownError":
            toast.error(
              "Credential Manager returned an unknown error."
            );
            break;

          case "SecurityError":
            toast.error("Security error while creating passkey.");
            break;

          case "NotSupportedError":
            toast.error("Passkeys are not supported on this device.");
            break;

          default:
            toast.error(
              e.message || "Failed to register passkey."
            );
        }

        return false;
      }
    },
    [fetchPasskeys]
  );

  const renamePasskey = useCallback(
    async (id: string, name: string) => {
      const { error } = await supabase
        .from("passkeys")
        .update({
          device_name: name,
        })
        .eq("id", id);

      if (error) {
        toast.error("Failed to rename passkey");
        return;
      }

      toast.success("Passkey renamed");

      fetchPasskeys();
    },
    [fetchPasskeys]
  );

  const deletePasskey = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("passkeys")
        .delete()
        .eq("id", id);

      if (error) {
        toast.error("Failed to remove passkey");
        return;
      }

      toast.success("Passkey removed");

      fetchPasskeys();
    },
    [fetchPasskeys]
  );

  const stepUpVerify = useCallback(async (): Promise<boolean> => {
    if (!browserSupportsWebAuthn()) return false;

    try {
      const { data: begin, error: bErr } =
        await supabase.functions.invoke(
          "passkey-auth-begin",
          {
            body: {
              purpose: "step_up",
            },
          }
        );

      if (bErr || !begin?.hasPasskey || !begin?.options) {
        return false;
      }

      const assertion = await startAuthentication({
        optionsJSON: begin.options,
      });

      const { data: finish, error: fErr } =
        await supabase.functions.invoke(
          "passkey-auth-finish",
          {
            body: {
              response: assertion,
              purpose: "step_up",
            },
          }
        );

      if (fErr || !finish?.verified) {
        toast.error(
          fErr?.message || "Passkey verification failed"
        );
        return false;
      }

      return true;
    } catch (e: any) {
      console.error("STEP UP ERROR", e);

      if (e.name !== "NotAllowedError") {
        toast.error(
          e.message || "Passkey verification failed"
        );
      }

      return false;
    }
  }, []);

  return {
    passkeys,
    loading,
    fetchPasskeys,
    registerPasskey,
    renamePasskey,
    deletePasskey,
    stepUpVerify,
  };
};

export const loginWithPasskey = async (
  email: string
): Promise<{ verified: boolean; userId?: string }> => {
  if (!browserSupportsWebAuthn()) {
    return { verified: false };
  }

  const { data: begin } =
    await supabase.functions.invoke(
      "passkey-auth-begin",
      {
        body: {
          email,
          purpose: "authentication",
        },
      }
    );

  if (!begin?.hasPasskey || !begin?.options) {
    return { verified: false };
  }

  try {
    const assertion = await startAuthentication({
      optionsJSON: begin.options,
    });

    const { data: finish, error } =
      await supabase.functions.invoke(
        "passkey-auth-finish",
        {
          body: {
            response: assertion,
            email,
            purpose: "authentication",
          },
        }
      );

    if (error || !finish?.verified) {
      return { verified: false };
    }

    return {
      verified: true,
      userId: finish.userId,
    };
  } catch {
    return {
      verified: false,
    };
  }
};

export const checkHasPasskey = async (
  email: string
): Promise<boolean> => {
  try {
    const { data } =
      await supabase.functions.invoke(
        "passkey-auth-begin",
        {
          body: {
            email,
            purpose: "authentication",
          },
        }
      );

    return !!data?.hasPasskey;
  } catch {
    return false;
  }
};