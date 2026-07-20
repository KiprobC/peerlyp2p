import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Passkey {
  id: string;
  credential_id: string;
  device_name: string;
  last_used_at: string |null;
  created_at: string;
}

interface PasskeyContextType {
  passkeys: Passkey[];
  loading: boolean;
  fetchPasskeys: () => Promise<void>;
  registerPasskey: (deviceName: string) => Promise<boolean>;
  renamePasskey: (id: string, name: string) => Promise<void>;
  deletePasskey: (id: string) => Promise<void>;
  stepUpVerify: () => Promise<boolean>;
}

const PasskeyContext = createContext<PasskeyContextType | undefined>(undefined);

export function PasskeyProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);

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
        setPasskeys([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("passkeys")
        .select(
          `
          id,
          credential_id,
          device_name,
          last_used_at,
          created_at
        `
        )
        .eq("user_id", user.id);

      if (error) {
        console.error(error);
        setPasskeys([]);
      } else {
        setPasskeys(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPasskeys();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchPasskeys();
    });

    return () => subscription.unsubscribe();
  }, [fetchPasskeys]);

  const registerPasskey = useCallback(
    async (deviceName: string) => {
      try {
        const { data: begin } =
          await supabase.functions.invoke(
            "passkey-register-begin"
          );

        if (!begin?.options) {
          throw new Error("Registration failed");
        }

        const attestation =
          await startRegistration({
            optionsJSON: begin.options,
          });

        const { data: finish } =
          await supabase.functions.invoke(
            "passkey-register-finish",
            {
              body: {
                response: attestation,
                deviceName,
              },
            }
          );

        if (!finish?.verified) {
          throw new Error("Verification failed");
        }

        await fetchPasskeys();

        toast.success("Passkey registered");

        return true;
      } catch (e: any) {
        toast.error(e.message);
        return false;
      }
    },
    [fetchPasskeys]
  );

  const renamePasskey = useCallback(
    async (id: string, name: string) => {
      await supabase
        .from("passkeys")
        .update({
          device_name: name,
        })
        .eq("id", id);

      await fetchPasskeys();
    },
    [fetchPasskeys]
  );

  const deletePasskey = useCallback(
    async (id: string) => {
      await supabase
        .from("passkeys")
        .delete()
        .eq("id", id);

      await fetchPasskeys();
    },
    [fetchPasskeys]
  );

  const stepUpVerify = useCallback(async () => {
    try {
      const { data: begin } =
        await supabase.functions.invoke(
          "passkey-auth-begin",
          {
            body: {
              purpose: "step_up",
            },
          }
        );

      if (!begin?.options) return false;

      const assertion =
        await startAuthentication({
          optionsJSON: begin.options,
        });

      const { data: finish } =
        await supabase.functions.invoke(
          "passkey-auth-finish",
          {
            body: {
              response: assertion,
              purpose: "step_up",
            },
          }
        );

      return !!finish?.verified;
    } catch {
      return false;
    }
  }, []);

  return (
    <PasskeyContext.Provider
      value={{
        passkeys,
        loading,
        fetchPasskeys,
        registerPasskey,
        renamePasskey,
        deletePasskey,
        stepUpVerify,
      }}
    >
      {children}
    </PasskeyContext.Provider>
  );
}

export function usePasskeyContext() {
  const ctx = useContext(PasskeyContext);

  if (!ctx) {
    throw new Error(
      "usePasskeyContext must be used inside PasskeyProvider"
    );
  }

  return ctx;
}