import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface TradeAuthorizationResult {
  isAuthorized: boolean;
  isBuyer: boolean;
  isSeller: boolean;
  isAssignedModerator: boolean;
  isModeratorOrAdmin: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check if the current user is authorized to access a specific trade.
 * Only buyers, sellers, or assigned moderators/admins can access a trade.
 */
export const useTradeAuthorization = (tradeId: string | undefined): TradeAuthorizationResult => {
  const { user, authState } = useAuth();
  const [result, setResult] = useState<TradeAuthorizationResult>({
    isAuthorized: false,
    isBuyer: false,
    isSeller: false,
    isAssignedModerator: false,
    isModeratorOrAdmin: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const checkAuthorization = async () => {
      if (!tradeId) {
        setResult(prev => ({ ...prev, loading: false, error: "No trade ID provided" }));
        return;
      }

      if (authState === "loading") {
        return; // Wait for auth to resolve
      }

      if (!user) {
        setResult({
          isAuthorized: false,
          isBuyer: false,
          isSeller: false,
          isAssignedModerator: false,
          isModeratorOrAdmin: false,
          loading: false,
          error: "Not authenticated",
        });
        return;
      }

      try {
        // Fetch trade details
        const { data: trade, error: tradeError } = await supabase
          .from("trades")
          .select("buyer_id, seller_id, assigned_moderator_id")
          .eq("id", tradeId)
          .maybeSingle();

        if (tradeError) {
          setResult(prev => ({
            ...prev,
            loading: false,
            error: "Error fetching trade",
          }));
          return;
        }

        if (!trade) {
          setResult(prev => ({
            ...prev,
            loading: false,
            error: "Trade not found",
          }));
          return;
        }

        const isBuyer = trade.buyer_id === user.id;
        const isSeller = trade.seller_id === user.id;
        const isAssignedModerator = trade.assigned_moderator_id === user.id;

        // Check if user is moderator or admin
        const [modResult, adminResult] = await Promise.all([
          supabase.rpc("has_role", { _user_id: user.id, _role: "moderator" }),
          supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        ]);

        const isModerator = modResult.data === true;
        const isAdmin = adminResult.data === true;
        const isModeratorOrAdmin = isModerator || isAdmin;

        // User is authorized if they are buyer, seller, assigned moderator, or admin
        const isAuthorized = isBuyer || isSeller || isAssignedModerator || isAdmin;

        setResult({
          isAuthorized,
          isBuyer,
          isSeller,
          isAssignedModerator,
          isModeratorOrAdmin,
          loading: false,
          error: isAuthorized ? null : "You are not authorized to view this trade",
        });
      } catch (error) {
        console.error("Trade authorization error:", error);
        setResult(prev => ({
          ...prev,
          loading: false,
          error: "Authorization check failed",
        }));
      }
    };

    checkAuthorization();
  }, [tradeId, user, authState]);

  return result;
};

export default useTradeAuthorization;
