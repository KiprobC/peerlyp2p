import { useState, useEffect, useCallback } from "react";
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
  isEnabled: boolean;
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
    loading: true,
    enrollmentData: null,
    enrolling: false,
    verifying: false,
  });

  // Track MFA verification attempts for rate limiting
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

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
      setState(prev => ({ ...prev, loading: false, factors: [], isEnabled: false }));
      return;
    }

    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) throw error;

      const verifiedFactors = data.totp.filter(f => f.status === "verified");
      
      setState(prev => ({
        ...prev,
        factors: data.totp as MFAFactor[],
        isEnabled: verifiedFactors.length > 0,
        loading: false,
      }));
    } catch (error: any) {
      console.error("Error fetching MFA factors:", error);
      setState(prev => ({ ...prev, loading: false }));
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
  const verifyEnrollment = async (factorId: string, code: string) => {
    if (!checkRateLimit()) return { success: false, error: "Rate limited" };
    
    setState(prev => ({ ...prev, verifying: true }));

    try {
      // First create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // Then verify
      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (error) {
        incrementAttempt();
        throw error;
      }

      resetAttempts();

      setState(prev => ({
        ...prev,
        enrollmentData: null,
        verifying: false,
      }));

      // Refresh factors to update isEnabled state from Supabase MFA
      await fetchFactors();
      toast.success("Two-factor authentication enabled successfully!");

      return { success: true, data };
    } catch (error: any) {
      console.error("Error verifying MFA enrollment:", error);
      toast.error(error.message || "Invalid verification code");
      setState(prev => ({ ...prev, verifying: false }));
      return { success: false, error: error.message };
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

  // Disable MFA (unenroll all factors)
  const disableMFA = async (factorId: string) => {
    if (!checkRateLimit()) return { success: false, error: "Rate limited" };

    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (error) throw error;

      // Refresh factors to update isEnabled state from Supabase MFA
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
          throw new Error("No verified MFA factor found");
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
