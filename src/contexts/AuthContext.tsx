import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Explicit auth states
export type AuthState = "loading" | "authenticated" | "unauthenticated";

interface MFAChallenge {
  factorId: string;
  email: string;
}

interface PasskeyChallenge {
  email: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  authState: AuthState;
  loading: boolean; // Keep for backward compatibility
  mfaChallenge: MFAChallenge | null;
  passkeyChallenge: PasskeyChallenge | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; mfaRequired?: boolean; passkeyRequired?: boolean }>;
  completeMFAChallenge: (code: string) => Promise<{ error: Error | null }>;
  completePasskeyChallenge: () => Promise<{ error: Error | null }>;
  acceptPasskeyFallback: () => void;
  cancelMFAChallenge: () => void;
  cancelPasskeyChallenge: () => void;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage key for cross-tab sync
const AUTH_STORAGE_KEY = "auth_session_sync";
const SESSION_EXPIRED_KEY = "session_expired";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallenge | null>(null);
  const [passkeyChallenge, setPasskeyChallenge] = useState<PasskeyChallenge | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Handle session state updates
  const updateAuthState = useCallback((newSession: Session | null, newUser: User | null) => {
    setSession(newSession);
    setUser(newUser);
    setAuthState(newUser ? "authenticated" : "unauthenticated");
  }, []);

  // Check for token expiration
  const checkTokenExpiration = useCallback((session: Session | null) => {
    if (!session?.expires_at) return false;
    
    const expiresAt = session.expires_at * 1000; // Convert to ms
    const now = Date.now();
    const bufferMs = 60 * 1000; // 1 minute buffer
    
    return now >= expiresAt - bufferMs;
  }, []);

  // Handle session expiration
  const handleSessionExpired = useCallback(async () => {
    // Store flag for redirect preservation
    const currentPath = window.location.pathname;
    if (currentPath !== "/" && currentPath !== "/login" && currentPath !== "/signup") {
      sessionStorage.setItem("redirectAfterLogin", currentPath);
    }
    
    // Clear session
    await supabase.auth.signOut();
    updateAuthState(null, null);
    
    // Show toast notification
    toast.error("Your session has expired. Please log in again.", {
      duration: 5000,
    });
    
    // Broadcast to other tabs
    localStorage.setItem(SESSION_EXPIRED_KEY, Date.now().toString());
  }, [updateAuthState]);

  // Refresh session manually
  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error("Error refreshing session:", error);
        await handleSessionExpired();
        return;
      }
      if (data.session) {
        updateAuthState(data.session, data.session.user);
      }
    } catch (error) {
      console.error("Session refresh failed:", error);
    }
  }, [updateAuthState, handleSessionExpired]);

  // Initialize auth state - runs once before rendering UI
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get existing session
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          if (mounted) {
            updateAuthState(null, null);
            setInitialized(true);
          }
          return;
        }

        // Check if session is expired or about to expire
        if (currentSession && checkTokenExpiration(currentSession)) {
          // Try to refresh
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshData.session) {
            if (mounted) {
              handleSessionExpired();
              setInitialized(true);
            }
            return;
          }
          if (mounted) {
            updateAuthState(refreshData.session, refreshData.session.user);
          }
        } else if (mounted) {
          updateAuthState(currentSession, currentSession?.user ?? null);
        }

        if (mounted) {
          setInitialized(true);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (mounted) {
          updateAuthState(null, null);
          setInitialized(true);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [updateAuthState, checkTokenExpiration, handleSessionExpired]);

  // Set up auth state listener after initialization
  useEffect(() => {
    if (!initialized) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("Auth state change:", event);

        if (event === "SIGNED_OUT") {
          updateAuthState(null, null);
          // Broadcast logout to other tabs
          localStorage.setItem(AUTH_STORAGE_KEY, `logout_${Date.now()}`);
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          if (newSession) {
            updateAuthState(newSession, newSession.user);
            // Broadcast sign in to other tabs
            localStorage.setItem(AUTH_STORAGE_KEY, `login_${Date.now()}`);
          }
        } else if (event === "USER_UPDATED") {
          if (newSession) {
            updateAuthState(newSession, newSession.user);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initialized, updateAuthState]);

  // Cross-tab logout synchronization
  useEffect(() => {
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY) {
        const value = e.newValue;
        if (value?.startsWith("logout_")) {
          // Another tab logged out - clear local state
          updateAuthState(null, null);
        } else if (value?.startsWith("login_")) {
          // Another tab logged in - refresh session
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            updateAuthState(data.session, data.session.user);
          }
        }
      } else if (e.key === SESSION_EXPIRED_KEY) {
        // Session expired in another tab
        updateAuthState(null, null);
        toast.error("Your session has expired. Please log in again.", {
          duration: 5000,
        });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [updateAuthState]);

  // Periodic token expiration check
  useEffect(() => {
    if (authState !== "authenticated" || !session) return;

    const checkExpiration = () => {
      if (checkTokenExpiration(session)) {
        refreshSession();
      }
    };

    // Check every minute
    const interval = setInterval(checkExpiration, 60 * 1000);
    return () => clearInterval(interval);
  }, [authState, session, checkTokenExpiration, refreshSession]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
    });
    return { error };
  };

   const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { error };
    }

    // Check whether THIS USER actually enabled 2FA

    const { data: settings } = await supabase
     .from("user_settings")
     .select("two_factor_enabled")
     .eq("user_id", data.user.id)
     .single();

    const { data: factors } =
     await supabase.auth.mfa.listFactors();

    const verifiedFactor =
     factors?.totp.find(f => f.status === "verified");

   // TEMPORARY DEBUG LOGS
   console.log("2FA enabled:", settings?.two_factor_enabled);
   console.log("Factors:", factors);
   console.log("Verified factor:", verifiedFactor);

    if (
       settings?.two_factor_enabled &&
       verifiedFactor
    ) {

    const trustedUntil =
     Number(localStorage.getItem("trusted_device_until") || 0);

    const trusted =
     trustedUntil > Date.now();
    
    console.log("trustedUntil:", trustedUntil);
    console.log("trusted:", trusted);

    if (trusted) {
     return {
        error:null,
        mfaRequired:false
      };
    }

    setMfaChallenge({
     factorId: verifiedFactor.id,
     email,
    });
  
    return {
     error: null,
     mfaRequired: true,
    };
  }

    // Check if user has a passkey registered → require passkey verification
    try {
      const { checkHasPasskey } = await import("@/hooks/usePasskeys");
      const hasPk = await checkHasPasskey(email);
      if (hasPk) {
        setPasskeyChallenge({ email });
        return { error: null, passkeyRequired: true };
      }
    } catch {
      // ignore — fall through to normal sign-in
    }

    // Collect fingerprint on login (non-blocking)
    import("@/lib/fingerprint").then(({ collectFingerprint }) => collectFingerprint("login")).catch(() => {});

    return { error: null, mfaRequired: false };
  };

  const completePasskeyChallenge = async () => {
    if (!passkeyChallenge) return { error: new Error("No passkey challenge pending") };
    try {
      const { loginWithPasskey } = await import("@/hooks/usePasskeys");
      const result = await loginWithPasskey(passkeyChallenge.email);
      if (!result.verified) return { error: new Error("Passkey verification failed") };
      setPasskeyChallenge(null);
      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  };

  const acceptPasskeyFallback = () => {
    // User completed alternative verification (e.g. email OTP) — clear challenge but keep session.
    setPasskeyChallenge(null);
  };

  const cancelPasskeyChallenge = () => {
    setPasskeyChallenge(null);
    supabase.auth.signOut();
  };

  const completeMFAChallenge = async (
    code: string,
    trustDevice:boolean
    ) => {
    if (!mfaChallenge) {
      return { error: new Error("No MFA challenge pending") };
    }

    try {
      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaChallenge.factorId,
      });

      if (challengeError) throw challengeError;

      // Verify
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaChallenge.factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      //Trust this device for 7 days
      if (trustDevice) {

        localStorage.setItem(
          "trusted_device_until",
          String(
            Date.now() +
            7 * 24 * 60 * 60 * 1000
          )
        )
      }

      setMfaChallenge(null);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const cancelMFAChallenge = () => {
    setMfaChallenge(null);
    // Sign out the partial session
    supabase.auth.signOut();
  };

  const signOut = async () => {
    setMfaChallenge(null);
    await supabase.auth.signOut();
    // Cross-tab sync is handled in the auth state listener
  };

  // Don't render children until auth is initialized
  if (!initialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      authState,
      loading: authState === "loading", // Backward compatibility
      mfaChallenge,
      passkeyChallenge,
      signUp, 
      signIn, 
      completeMFAChallenge,
      completePasskeyChallenge,
      acceptPasskeyFallback,
      cancelMFAChallenge,
      cancelPasskeyChallenge,
      signOut,
      refreshSession
    }}>
      {children}
    </AuthContext.Provider>
  );
};
