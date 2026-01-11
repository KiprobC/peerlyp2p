import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type OTPActionType = 
  | "password_change"
  | "crypto_send"
  | "crypto_withdraw"
  | "enable_2fa"
  | "disable_2fa"
  | "change_phone"
  | "delete_account"
  | "sensitive_action";

interface OTPState {
  loading: boolean;
  codeSent: boolean;
  verified: boolean;
  error: string | null;
  attemptsRemaining: number | null;
  lockedUntil: Date | null;
  cooldownUntil: Date | null;
  devCode?: string; // For development only
}

interface OTPVerificationResult {
  success: boolean;
  error?: string;
  attemptsRemaining?: number;
  lockedUntil?: string;
}

export const useOTPVerification = () => {
  const [state, setState] = useState<OTPState>({
    loading: false,
    codeSent: false,
    verified: false,
    error: null,
    attemptsRemaining: null,
    lockedUntil: null,
    cooldownUntil: null,
  });

  const reset = useCallback(() => {
    setState({
      loading: false,
      codeSent: false,
      verified: false,
      error: null,
      attemptsRemaining: null,
      lockedUntil: null,
      cooldownUntil: null,
    });
  }, []);

  const requestCode = useCallback(async (
    actionType: OTPActionType,
    metadata?: Record<string, unknown>
  ): Promise<boolean> => {
    // Check cooldown
    if (state.cooldownUntil && new Date() < state.cooldownUntil) {
      const remainingSecs = Math.ceil((state.cooldownUntil.getTime() - Date.now()) / 1000);
      toast.error(`Please wait ${remainingSecs} seconds before requesting another code`);
      return false;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("verify-otp", {
        body: {
          action: "generate",
          actionType,
          metadata,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      if (!result.success) {
        if (result.lockedUntil) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: result.error,
            lockedUntil: new Date(result.lockedUntil),
          }));
        } else {
          setState(prev => ({ ...prev, loading: false, error: result.error }));
        }
        toast.error(result.error);
        return false;
      }

      // Set cooldown (30 seconds between requests)
      const cooldownTime = new Date(Date.now() + 30 * 1000);

      setState(prev => ({
        ...prev,
        loading: false,
        codeSent: true,
        cooldownUntil: cooldownTime,
        devCode: result.devCode, // For development testing
      }));

      toast.success("Verification code sent to your email");
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send code";
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      toast.error(errorMessage);
      return false;
    }
  }, [state.cooldownUntil]);

  const verifyCode = useCallback(async (
    code: string,
    actionType: OTPActionType
  ): Promise<boolean> => {
    // Check if locked
    if (state.lockedUntil && new Date() < state.lockedUntil) {
      toast.error("Too many failed attempts. Please wait and try again.");
      return false;
    }

    if (code.length !== 6) {
      setState(prev => ({ ...prev, error: "Code must be 6 digits" }));
      return false;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await supabase.functions.invoke("verify-otp", {
        body: {
          action: "verify",
          actionType,
          code,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result: OTPVerificationResult = response.data;

      if (!result.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: result.error || "Verification failed",
          attemptsRemaining: result.attemptsRemaining ?? null,
          lockedUntil: result.lockedUntil ? new Date(result.lockedUntil) : null,
        }));
        
        if (result.attemptsRemaining !== undefined && result.attemptsRemaining > 0) {
          toast.error(`Invalid code. ${result.attemptsRemaining} attempts remaining.`);
        } else if (result.lockedUntil) {
          toast.error("Too many failed attempts. Please request a new code.");
        } else {
          toast.error(result.error || "Invalid code");
        }
        return false;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        verified: true,
        error: null,
        attemptsRemaining: null,
      }));

      toast.success("Verification successful");
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Verification failed";
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      toast.error(errorMessage);
      return false;
    }
  }, [state.lockedUntil]);

  const resendCode = useCallback(async (actionType: OTPActionType): Promise<boolean> => {
    setState(prev => ({ ...prev, codeSent: false }));
    return requestCode(actionType);
  }, [requestCode]);

  const isLocked = state.lockedUntil ? new Date() < state.lockedUntil : false;
  const isOnCooldown = state.cooldownUntil ? new Date() < state.cooldownUntil : false;

  return {
    ...state,
    isLocked,
    isOnCooldown,
    requestCode,
    verifyCode,
    resendCode,
    reset,
  };
};