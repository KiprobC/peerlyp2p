import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SecurityEvent {
  id: string;
  user_id: string;
  action_type: string;
  method: string | null;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const useSecurityEvents = (limit = 50) => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["security-events", user?.id, limit],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("security_events")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as SecurityEvent[];
    },
    enabled: !!user,
  });

  return {
    events: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Hook for admins to view all security events
export const useAdminSecurityEvents = (filters?: {
  userId?: string;
  actionType?: string;
  status?: string;
  limit?: number;
}) => {
  const query = useQuery({
    queryKey: ["admin-security-events", filters],
    queryFn: async () => {
      let queryBuilder = supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.userId) {
        queryBuilder = queryBuilder.eq("user_id", filters.userId);
      }
      if (filters?.actionType) {
        queryBuilder = queryBuilder.eq("action_type", filters.actionType);
      }
      if (filters?.status) {
        queryBuilder = queryBuilder.eq("status", filters.status);
      }

      queryBuilder = queryBuilder.limit(filters?.limit ?? 100);

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data as SecurityEvent[];
    },
  });

  return {
    events: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};