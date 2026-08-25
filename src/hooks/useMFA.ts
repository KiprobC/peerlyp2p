import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MFAFactor {
  id: string;
  factor_type: "totp";
  friendly_name?: string;
  created_at: string;
  updated_at: string;
  status: "verified" | "unverified";
}

export interface EnrollmentData {
  id: string;
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
}

interface MFAState {
  factors: MFAFactor[];
  /**
   * True only when the user has explicitly enabled 2FA in Settings *and*
   * there is at least one verified authenticator factor.
   */
  isEnabled: boolean;
  /** User preference flag stored in user_settings.two_factor_enabled */
  preferenceEnabled: boolean;
  loading: boolean;
  enrollmentData: EnrollmentData | null;
  enrolling: boolean;
  verifying: boolean;
}

export const useMFA = () => {
  const { user } = useAuth();
  const [state, setState] = useState<MFAState>({
    factors: [],
    isEnabled: false,
    preferenceEnabled: false,
    loading: true,
    enrollmentData: null,
    enrolling: false,
    verifying: false,
  });

  // Track MFA verification attempts for rate limiting
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const enrollmentVerificationInFlight = useRef(false);

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  const MFA_OPERATION_TIMEOUT_MS = 15_000;

  const withTimeout = async <T,>(operation: Promise<T>, message: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), MFA_OPERATION_TIMEOUT_MS);
    });

    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const checkRateLimit = useCallback(() => {
    if (lockedUntil && new Date() < lockedUntil) {
      const remainingMs = lockedUntil.getTime() - Date.now();
      const remainingMins = Math.ceil(remainingMs / 60000);
      toast.error(`Too many attempts. Try again in ${remainingMins} minute(s).`);
      return false;
    }
    
    if (lockedUntil && new Date() >= lockedUntil) {
      setLockedUntil(null);
      setAttempts(0);
    }
    
    return true;
  }, [lockedUntil]);

  const incrementAttempt = useCallback(() => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    
    if (newAttempts >= MAX_ATTEMPTS) {
      const lockTime = new Date(Date.now() + LOCKOUT_DURATION_MS);
      setLockedUntil(lockTime);
      toast.error("Too many failed attempts. Locked for 5 minutes.");
      return false;
    }
    
    return true;
  }, [attempts]);

  const resetAttempts = useCallback(() => {
    setAttempts(0);
    setLockedUntil(null);
  }, []);

  // Fetch current MFA factors
  const fetchFactors = useCallback(async () => {
    if (!user) {
      setState((prev) => ({
        ...prev,
        loading: false,
        factors: [],
        isEnabled: false,
        preferenceEnabled: false,
      }));
      return;
    }

    try {
      // User preference is the primary toggle ("off by default unless enabled in Security")
      let preferenceEnabled = false;
      const { data: settingsRow, error: settingsError } = await supabase
        .from("user_settings")
        .select("two_factor_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      if (!settingsRow) {
        // Ensure a settings row exists (defaults are applied in DB)
        const { data: created, error: createError } = await supabase
          .from("user_settings")
          .insert({ user_id: user.id })
          .select("two_factor_enabled")
          .single();
        if (createError) throw createError;
        preferenceEnabled = !!created?.two_factor_enabled;
      } else {
        preferenceEnabled = !!settingsRow.two_factor_enabled;
      }

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const verifiedFactors = data.totp.filter((f) => f.status === "verified");
      const isEnabled = preferenceEnabled && verifiedFactors.length > 0;

      setState((prev) => ({
        ...prev,
        factors: data.totp as MFAFactor[],
        preferenceEnabled,
        isEnabled,
        loading: false,
      }));
    } catch (error: any) {
      console.error("Error fetching MFA factors:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        // Fail-safe: never require 2FA if we can't confidently determine state
        isEnabled: false,
      }));
    }
  }, [user]);

  useEffect(() => {
    fetchFactors();
  }, [fetchFactors]);

  // Start MFA enrollment
  const startEnrollment = async (friendlyName?: string) => {
    if (!checkRateLimit()) return { success: false, error: "Rate limited" };
    
    setState(prev => ({ ...prev, enrolling: true }));

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: friendlyName || "Authenticator App",
      });

      if (error) throw error;

      setState(prev => ({
        ...prev,
        enrollmentData: data as EnrollmentData,
        enrolling: false,
      }));

      return { success: true, data };
    } catch (error: any) {
      console.error("Error starting MFA enrollment:", error);
      toast.error(error.message || "Failed to start MFA enrollment");
      setState(prev => ({ ...prev, enrolling: false }));
      return { success: false, error: error.message };
    }
  };

  // Verify enrollment with TOTP code
  const verifyEnrollment = async (factorId: string, code: string): Promise<{ success: boolean; error?: string; isEnabled?: boolean }> => {
    if (enrollmentVerificationInFlight.current) {
      return { success: false, error: "Verification already in progress" };
    }
    if (!checkRateLimit()) return { success: false, error: "Rate limited" };

    enrollmentVerificationInFlight.current = true;
    setState(prev => ({ ...prev, verifying: true }));

    try {
      // First create a challenge
      const { data: challengeData, error: challengeError } = await withTimeout(
        supabase.auth.mfa.challenge({ factorId }),
        "MFA verification timed out. Please try again."
      );

      if (challengeError) throw challengeError;
      if (!challengeData?.id) throw new Error("MFA challenge could not be created");

      // Then verify
      const { error } = await withTimeout(
        supabase.auth.mfa.verify({ factorId, challengeId: challengeData.id, code }),
        "MFA verification timed out. Please try again."
      );

      if (error) {
        incrementAttempt();
        throw error;
      }

      resetAttempts();

      // Persist user preference ("enabled in Security")
      if (!user) throw new Error("Your session expired. Please sign in again.");
      const { error: settingsError } = await withTimeout(
        supabase
          .from("user_settings")
          .update({ two_factor_enabled: true })
          .eq("user_id", user.id),
        "Saving MFA settings timed out. Please try again."
      );
      if (settingsError) throw settingsError;

      // Refresh factors FIRST to get updated state before closing dialog
      const { data: factorsData, error: factorsError } = await withTimeout(
        supabase.auth.mfa.listFactors(),
        "Refreshing MFA status timed out. Please try again."
      );
      if (factorsError) throw factorsError;
      const verifiedFactors = factorsData?.totp.filter((f) => f.status === "verified") || [];
      const isNowEnabled = verifiedFactors.length > 0;

      setState((prev) => ({
        ...prev,
        factors: (factorsData?.totp as MFAFactor[]) || [],
        preferenceEnabled: true,
        isEnabled: isNowEnabled,
        enrollmentData: null,
        verifying: false,
        loading: false,
      }));

      toast.success("Two-factor authentication enabled successfully!");

      return { success: true, isEnabled: isNowEnabled };
    } catch (error: unknown) {
      console.error("Error verifying MFA enrollment:", error);
      const message = error instanceof Error ? error.message : "MFA verification failed";
      toast.error(message);
      return { success: false, error: message };
    } finally {
      enrollmentVerificationInFlight.current = false;
      setState(prev => ({ ...prev, verifying: false }));
    }
  };

  // Cancel enrollment
  const cancelEnrollment = async () => {
    if (state.enrollmentData) {
      try {
        await supabase.auth.mfa.unenroll({
          factorId: state.enrollmentData.id,
        });
      } catch (error) {
        // Ignore errors when canceling unverified enrollment
      }
    }
    
    setState(prev => ({ ...prev, enrollmentData: null, enrolling: false }));
  };

  // Disable MFA (turn off preference + unenroll all factors)
  const disableMFA = async (_factorId: string) => {
    if (!checkRateLimit()) return { success: false, error: "Rate limited" };

    try {
      // Turn off preference first (fail-safe: should not require 2FA after this)
      if (user) {
        await supabase
          .from("user_settings")
          .update({ two_factor_enabled: false })
          .eq("user_id", user.id);
      }

      // Unenroll every existing factor to avoid "ghost" verified factors
      const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const allFactorIds = (factorsData?.totp || []).map((f) => f.id);
      for (const id of allFactorIds) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
        if (error) throw error;
      }

      await fetchFactors();
      toast.success("Two-factor authentication disabled");

      return { success: true };
    } catch (error: any) {
      console.error("Error disabling MFA:", error);
      toast.error(error.message || "Failed to disable MFA");
      return { success: false, error: error.message };
    }
  };

  // Create challenge and verify (for login or sensitive actions)
  const challengeAndVerify = async (code: string, factorId?: string) => {
    if (!checkRateLimit()) return { success: false, error: "Rate limited" };

    try {
      // Get factor if not provided
      let targetFactorId = factorId;
      if (!targetFactorId) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verifiedFactor = factors?.totp.find(f => f.status === "verified");
        if (!verifiedFactor) {
          // No MFA factor found - this means MFA is not enabled for this user
          // Return success to allow the action to proceed without MFA
          console.log("No verified MFA factor found - MFA not required");
          return { success: true, data: null, mfaNotEnabled: true };
        }
        targetFactorId = verifiedFactor.id;
      }

      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: targetFactorId,
      });

      if (challengeError) throw challengeError;

      // Verify
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: targetFactorId,
        challengeId: challengeData.id,
        code,
      });

      if (error) {
        incrementAttempt();
        throw error;
      }

      resetAttempts();
      return { success: true, data };
    } catch (error: any) {
      console.error("Error verifying MFA:", error);
      return { success: false, error: error.message };
    }
  };

  // Check if MFA is required for current session
  const getAssuranceLevel = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error("Error getting assurance level:", error);
      return null;
    }
  };

  return {
    ...state,
    attempts,
    lockedUntil,
    isLocked: lockedUntil ? new Date() < lockedUntil : false,
    fetchFactors,
    startEnrollment,
    verifyEnrollment,
    cancelEnrollment,
    disableMFA,
    challengeAndVerify,
    getAssuranceLevel,
    resetAttempts,
  };
};
