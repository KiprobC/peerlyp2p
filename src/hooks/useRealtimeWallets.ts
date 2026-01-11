import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook that sets up real-time subscriptions for wallet and offer changes.
 * Automatically invalidates relevant queries when data changes.
 */
export const useRealtimeWallets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleWalletChange = useCallback(() => {
    // Invalidate wallet-related queries
    queryClient.invalidateQueries({ queryKey: ["wallets"] });
    queryClient.invalidateQueries({ queryKey: ["available-balance"] });
    queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
  }, [queryClient]);

  const handleOfferChange = useCallback(() => {
    // Invalidate offer-related queries
    queryClient.invalidateQueries({ queryKey: ["offers"] });
    queryClient.invalidateQueries({ queryKey: ["my-offers"] });
    queryClient.invalidateQueries({ queryKey: ["available-balance"] });
  }, [queryClient]);

  useEffect(() => {
    if (!user) return;

    // Subscribe to wallet changes for the current user
    const walletChannel = supabase
      .channel(`wallets-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Wallet change detected:", payload.eventType);
          handleWalletChange();
        }
      )
      .subscribe();

    // Subscribe to offer changes for the current user
    const offerChannel = supabase
      .channel(`offers-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "offers",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Offer change detected:", payload.eventType);
          handleOfferChange();
        }
      )
      .subscribe();

    // Subscribe to all offer changes for marketplace updates
    const marketplaceChannel = supabase
      .channel("marketplace-offers")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "offers",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["offers"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletChannel);
      supabase.removeChannel(offerChannel);
      supabase.removeChannel(marketplaceChannel);
    };
  }, [user, handleWalletChange, handleOfferChange, queryClient]);
};
