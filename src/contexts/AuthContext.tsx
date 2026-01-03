import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface MFAChallenge {
  factorId: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  mfaChallenge: MFAChallenge | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; mfaRequired?: boolean }>;
  completeMFAChallenge: (code: string) => Promise<{ error: Error | null }>;
  cancelMFAChallenge: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  const [loading, setLoading] = useState(true);
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallenge | null>(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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

    // Check if MFA is required
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    
    if (aal?.nextLevel === "aal2" && aal?.currentLevel === "aal1") {
      // MFA is required but not yet completed
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factors?.totp.find(f => f.status === "verified");
      
      if (verifiedFactor) {
        setMfaChallenge({
          factorId: verifiedFactor.id,
          email,
        });
        return { error: null, mfaRequired: true };
      }
    }

    return { error: null, mfaRequired: false };
  };

  const completeMFAChallenge = async (code: string) => {
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
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      mfaChallenge,
      signUp, 
      signIn, 
      completeMFAChallenge,
      cancelMFAChallenge,
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
