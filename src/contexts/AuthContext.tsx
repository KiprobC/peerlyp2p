import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isTrustedDevice, trustThisDevice, clearTrustedDevice } from "@/lib/trustedDevice";
import { checkHasPasskey, loginWithPasskey } from "@/lib/passkeyAuth";

/**
 * Deterministic authentication state machine.
 *
 * loading ─────────► unauthenticated
 *    │                  │  signIn()
 *    │                  ▼
 *    │            pending_mfa ──completeMFAChallenge()──┐
 *    │                  │                               │
 *    │            pending_passkey ─completePasskey()────┤
 *    │                  │                               ▼
 *    └──────────────────┴──────────────────────────► authenticated
 *
 * There is exactly ONE function that transitions into "authenticated":
 * `promoteToAuthenticated()`. Nothing else may set that state.
 */
export type AuthState =
  | "loading"
  | "unauthenticated"
  | "pending_mfa"
  | "pending_passkey"
  | "authenticated";

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
  loading: boolean;
  mfaChallenge: MFAChallenge | null;
  passkeyChallenge: PasskeyChallenge | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; mfaRequired?: boolean; passkeyRequired?: boolean }>;
  completeMFAChallenge: (code: string, trustDevice: boolean) => Promise<{ error: Error | null }>;
  completePasskeyChallenge: () => Promise<{ error: Error | null }>;
  acceptPasskeyFallback: () => void;
  cancelMFAChallenge: () => Promise<void>;
  cancelPasskeyChallenge: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "auth_session_sync";
const SESSION_EXPIRED_KEY = "session_expired";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

/** True when the session token is expired or within the 60s refresh buffer. */
const isExpiring = (session: Session | null): boolean => {
  if (!session?.expires_at) return false;
  return Date.now() >= session.expires_at * 1000 - 60_000;
};

/**
 * Decides whether a valid Supabase session still needs second-factor
 * verification. Pure read — never mutates state.
 */
const resolveRequiredVerification = async (
  userId: string
): Promise<{ kind: "mfa"; factorId: string } | { kind: "none" }> => {
  try {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("two_factor_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (!settings?.two_factor_enabled) return { kind: "none" };

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.find((f) => f.status === "verified");
    if (!verified) return { kind: "none" };

    if (isTrustedDevice()) return { kind: "none" };

    return { kind: "mfa", factorId: verified.id };
  } catch (e) {
    console.error("[auth] verification resolution failed", e);
    return { kind: "none" };
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallenge | null>(null);
  const [passkeyChallenge, setPasskeyChallenge] = useState<PasskeyChallenge | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Mirror of authState readable inside async callbacks / listeners.
  const stateRef = useRef<AuthState>("loading");
  const setState = useCallback((next: AuthState) => {
    stateRef.current = next;
    setAuthState(next);
  }, []);

  /** THE single transition into "authenticated". */
  const promoteToAuthenticated = useCallback(
    (newSession: Session) => {
      setSession(newSession);
      setUser(newSession.user);
      setMfaChallenge(null);
      setPasskeyChallenge(null);
      setState("authenticated");
    },
    [setState]
  );

  const clearAuth = useCallback(() => {
    setSession(null);
    setUser(null);
    setMfaChallenge(null);
    setPasskeyChallenge(null);
    setState("unauthenticated");
  }, [setState]);

  /** Pulls the current session and promotes. Used after a challenge succeeds. */
  const promoteFromCurrentSession = useCallback(async (): Promise<boolean> => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;
    promoteToAuthenticated(data.session);
    return true;
  }, [promoteToAuthenticated]);

  const handleSessionExpired = useCallback(async () => {
    const currentPath = window.location.pathname;
    if (!["/", "/login", "/signup"].includes(currentPath)) {
      sessionStorage.setItem("redirectAfterLogin", currentPath);
    }
    await supabase.auth.signOut();
    clearAuth();
    toast.error("Your session has expired. Please log in again.", { duration: 5000 });
    localStorage.setItem(SESSION_EXPIRED_KEY, Date.now().toString());
  }, [clearAuth]);

  const refreshSession = useCallback(async () => {
    // Refresh must never promote a pending user.
    if (stateRef.current !== "authenticated") return;
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        await handleSessionExpired();
        return;
      }
      promoteToAuthenticated(data.session);
    } catch (e) {
      console.error("[auth] session refresh failed", e);
    }
  }, [handleSessionExpired, promoteToAuthenticated]);

  // ── Initialization ────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        let current = data.session;

        if (current && isExpiring(current)) {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshed.session) {
            if (mounted) await handleSessionExpired();
            return;
          }
          current = refreshed.session;
        }

        if (!mounted) return;

        if (!current) {
          clearAuth();
          return;
        }

        // A session alone is NOT authentication — re-check the second factor.
        const required = await resolveRequiredVerification(current.user.id);
        if (!mounted) return;

        if (required.kind === "mfa") {
          setSession(current);
          setUser(current.user);
          setMfaChallenge({ factorId: required.factorId, email: current.user.email ?? "" });
          setState("pending_mfa");
          return;
        }

        promoteToAuthenticated(current);
      } catch (e) {
        console.error("[auth] initialization error", e);
        if (mounted) clearAuth();
      } finally {
        if (mounted) setInitialized(true);
      }
    };

    initializeAuth();
    return () => {
      mounted = false;
    };
  }, [clearAuth, handleSessionExpired, promoteToAuthenticated, setState]);

  // ── Auth state listener ───────────────────────────────────────────────────
  useEffect(() => {
    if (!initialized) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      const pending =
        stateRef.current === "pending_mfa" || stateRef.current === "pending_passkey";

      if (event === "SIGNED_OUT") {
        clearAuth();
        localStorage.setItem(AUTH_STORAGE_KEY, `logout_${Date.now()}`);
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        // Only authenticated users may be re-promoted by a refresh.
        if (newSession && stateRef.current === "authenticated") {
          promoteToAuthenticated(newSession);
        } else if (newSession) {
          setSession(newSession);
        }
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        if (!newSession) return;
        if (pending) {
          // Keep the raw session but do NOT authenticate — a challenge is open.
          setSession(newSession);
          setUser(newSession.user);
          return;
        }
        promoteToAuthenticated(newSession);
        if (event === "SIGNED_IN") {
          localStorage.setItem(AUTH_STORAGE_KEY, `login_${Date.now()}`);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [initialized, clearAuth, promoteToAuthenticated]);

  // ── Cross-tab synchronization ─────────────────────────────────────────────
  useEffect(() => {
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY) {
        if (e.newValue?.startsWith("logout_")) {
          clearAuth();
        } else if (e.newValue?.startsWith("login_")) {
          if (stateRef.current === "pending_mfa" || stateRef.current === "pending_passkey") return;
          const { data } = await supabase.auth.getSession();
          if (!data.session) return;
          const required = await resolveRequiredVerification(data.session.user.id);
          if (required.kind === "mfa") {
            setMfaChallenge({ factorId: required.factorId, email: data.session.user.email ?? "" });
            setState("pending_mfa");
            return;
          }
          promoteToAuthenticated(data.session);
        }
      } else if (e.key === SESSION_EXPIRED_KEY) {
        clearAuth();
        toast.error("Your session has expired. Please log in again.", { duration: 5000 });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [clearAuth, promoteToAuthenticated, setState]);

  // ── Periodic expiry check ─────────────────────────────────────────────────
  useEffect(() => {
    if (authState !== "authenticated" || !session) return;
    const interval = setInterval(() => {
      if (isExpiring(session)) refreshSession();
    }, 60_000);
    return () => clearInterval(interval);
  }, [authState, session, refreshSession]);

  // ── Public API ────────────────────────────────────────────────────────────
  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    if (!data.session) return { error: new Error("No session returned") };

    // 1. MFA always takes precedence over passkeys.
    const required = await resolveRequiredVerification(data.user.id);
    if (required.kind === "mfa") {
      setSession(data.session);
      setUser(data.user);
      setMfaChallenge({ factorId: required.factorId, email });
      setState("pending_mfa");
      return { error: null, mfaRequired: true, passkeyRequired: false };
    }

    // 2. Passkey gate (only when MFA is not required/configured/trusted).
    const hasPasskey = await checkHasPasskey(email);
    if (hasPasskey) {
      setSession(data.session);
      setUser(data.user);
      setPasskeyChallenge({ email });
      setState("pending_passkey");
      return { error: null, mfaRequired: false, passkeyRequired: true };
    }

    // 3. Fully authenticated.
    import("@/lib/fingerprint")
      .then(({ collectFingerprint }) => collectFingerprint("login"))
      .catch(() => {});

    promoteToAuthenticated(data.session);
    return { error: null, mfaRequired: false, passkeyRequired: false };
  };

  const completeMFAChallenge = async (code: string, trustDevice: boolean) => {
    if (!mfaChallenge) return { error: new Error("No MFA challenge pending") };

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaChallenge.factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaChallenge.factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;

      if (trustDevice) trustThisDevice();

      const promoted = await promoteFromCurrentSession();
      if (!promoted) throw new Error("Session unavailable after verification");

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const completePasskeyChallenge = async () => {
    if (!passkeyChallenge) return { error: new Error("No passkey challenge pending") };
    try {
      const result = await loginWithPasskey(passkeyChallenge.email);
      if (!result.verified) return { error: new Error(result.error || "Authentication failed") };

      const promoted = await promoteFromCurrentSession();
      if (!promoted) throw new Error("Session unavailable after verification");

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  /** Alternative verification (email OTP) satisfied the passkey gate. */
  const acceptPasskeyFallback = () => {
    if (stateRef.current !== "pending_passkey") return;
    void promoteFromCurrentSession();
  };

  const abandonChallenge = useCallback(async () => {
    clearTrustedDevice();
    clearAuth();
    await supabase.auth.signOut();
  }, [clearAuth]);

  const cancelMFAChallenge = abandonChallenge;
  const cancelPasskeyChallenge = abandonChallenge;

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuth();
  };

  if (!initialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        authState,
        loading: authState === "loading",
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
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
