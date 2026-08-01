import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true when the given email has at least one registered passkey.
 * Never throws — a failure is treated as "no passkey" so login can proceed.
 */
export const checkHasPasskey = async (email: string): Promise<boolean> => {
  try {
    if (!browserSupportsWebAuthn()) return false;
    const { data, error } = await supabase.functions.invoke("passkey-auth-begin", {
      body: { email, purpose: "authentication" },
    });
    if (error) return false;
    return !!data?.hasPasskey && !!data?.options;
  } catch {
    return false;
  }
};

/** Runs a full WebAuthn assertion for login. */
export const loginWithPasskey = async (
  email: string
): Promise<{ verified: boolean; error?: string }> => {
  if (!browserSupportsWebAuthn()) {
    return { verified: false, error: "This device does not support passkeys" };
  }

  const { data: begin, error: beginError } = await supabase.functions.invoke(
    "passkey-auth-begin",
    { body: { email, purpose: "authentication" } }
  );

  if (beginError) return { verified: false, error: "Could not start passkey verification" };
  if (!begin?.options) return { verified: false, error: "Passkey not found for this account" };

  let assertion;
  try {
    assertion = await startAuthentication({ optionsJSON: begin.options });
  } catch {
    return { verified: false, error: "Verification cancelled" };
  }

  const { data: finish, error: finishError } = await supabase.functions.invoke(
    "passkey-auth-finish",
    { body: { response: assertion, email, purpose: "authentication" } }
  );

  if (finishError || !finish?.verified) {
    return { verified: false, error: "Authentication failed" };
  }

  return { verified: true };
};
