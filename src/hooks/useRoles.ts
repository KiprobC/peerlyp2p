import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "moderator" | "user";

interface RolesResult {
  role: AppRole;
  isAdmin: boolean;
  isModerator: boolean;
  isUser: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Unified hook to check user roles.
 * Fetches role from database on mount and caches result.
 */
export const useRoles = (): RolesResult => {
  const { user, authState } = useAuth();
  const [role, setRole] = useState<AppRole>("user");
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    if (!user) {
      setRole("user");
      setLoading(false);
      return;
    }

    try {
      // Check roles in parallel for efficiency
      const [adminResult, modResult] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "moderator" }),
      ]);

      if (adminResult.data === true) {
        setRole("admin");
      } else if (modResult.data === true) {
        setRole("moderator");
      } else {
        setRole("user");
      }
    } catch (error) {
      console.error("Error checking roles:", error);
      setRole("user");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authState === "loading") {
      return;
    }
    fetchRole();
  }, [authState, fetchRole]);

  return {
    role,
    isAdmin: role === "admin",
    isModerator: role === "moderator",
    isUser: role === "user",
    loading,
    refetch: fetchRole,
  };
};

export default useRoles;
