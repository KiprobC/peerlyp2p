import { supabase } from "@/integrations/supabase/client";

export interface EscrowResult {
  success: boolean;
  error?: string;
}

// Helper to normalize crypto type to uppercase
const normalizeCryptoType = (cryptoType: string): string => {
  return cryptoType.toUpperCase().trim();
};

// Helper to get or create a wallet using SECURITY DEFINER database function
// This bypasses RLS and ensures wallet creation always succeeds
const getOrCreateWallet = async (
  userId: string,
  cryptoType: string
): Promise<{ walletId: string; error?: string }> => {
  const normalizedCrypto = normalizeCryptoType(cryptoType);

  // Call the SECURITY DEFINER function to get or create wallet
  const { data: walletId, error: rpcError } = await supabase
    .rpc("get_or_create_wallet", {
      p_user_id: userId,
      p_crypto_type: normalizedCrypto,
    });

  if (rpcError) {
    console.error("Error in get_or_create_wallet RPC:", rpcError);
    return { walletId: "", error: rpcError.message };
  }

  if (!walletId) {
    return { walletId: "", error: "Failed to get or create wallet" };
  }

  return { walletId };
};

// Hook for managing escrow operations
export const useEscrow = () => {
  // Lock funds in escrow when trade is confirmed using SECURITY DEFINER function
  const lockEscrow = async (
    sellerId: string,
    cryptoType: string,
    amount: number,
    tradeId: string
  ): Promise<EscrowResult> => {
    try {
      const normalizedCrypto = normalizeCryptoType(cryptoType);

      // Use the SECURITY DEFINER lock_escrow function which handles:
      // - Wallet auto-creation (bypasses RLS)
      // - Balance checking
      // - Locking funds
      // - Transaction logging
      const { data, error } = await supabase.rpc("lock_escrow", {
        p_seller_id: sellerId,
        p_crypto_type: normalizedCrypto,
        p_amount: amount,
        p_trade_id: tradeId,
      });

      if (error) {
        console.error("Error calling lock_escrow RPC:", error);
        return { success: false, error: error.message };
      }

      // Parse the JSONB response
      const result = data as { success: boolean; error?: string; wallet_id?: string };
      
      if (!result.success) {
        return { success: false, error: result.error || "Failed to lock escrow" };
      }

      return { success: true };
    } catch (error: any) {
      console.error("Error locking escrow:", error);
      return { success: false, error: error.message };
    }
  };

  // Release escrow to buyer with 0.99% seller fee (atomic server-side)
  const releaseEscrow = async (
    sellerId: string,
    buyerId: string,
    cryptoType: string,
    amount: number,
    tradeId: string
  ): Promise<EscrowResult & { fee_amount?: number; buyer_amount?: number }> => {
    try {
      const normalizedCrypto = normalizeCryptoType(cryptoType);

      const { data, error } = await (supabase.rpc as any)("release_escrow_with_fee", {
        p_trade_id: tradeId,
        p_seller_id: sellerId,
        p_buyer_id: buyerId,
        p_crypto_type: normalizedCrypto,
        p_escrow_amount: amount,
      });

      if (error) {
        console.error("Error calling release_escrow_with_fee:", error);
        return { success: false, error: error.message };
      }

      const result = data as {
        success: boolean;
        error?: string;
        fee_amount?: number;
        buyer_amount?: number;
      };

      if (!result.success) {
        return { success: false, error: result.error || "Failed to release escrow" };
      }

      return {
        success: true,
        fee_amount: result.fee_amount,
        buyer_amount: result.buyer_amount,
      };
    } catch (error: any) {
      console.error("Error releasing escrow:", error);
      return { success: false, error: error.message };
    }
  };

  // Return funds to seller if trade is cancelled (restores offer reservation)
  const returnEscrow = async (
    sellerId: string,
    cryptoType: string,
    amount: number,
    tradeId: string
  ): Promise<EscrowResult> => {
    try {
      const normalizedCrypto = normalizeCryptoType(cryptoType);

      // Use the new RPC function that handles reservation restoration
      const { data, error } = await (supabase.rpc as any)("return_escrow_with_reservation", {
        p_seller_id: sellerId,
        p_crypto_type: normalizedCrypto,
        p_amount: amount,
        p_trade_id: tradeId,
      });

      if (error) {
        console.error("Error calling return_escrow_with_reservation:", error);
        return { success: false, error: error.message };
      }

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        return { success: false, error: result.error || "Failed to return escrow" };
      }

      return { success: true };
    } catch (error: any) {
      console.error("Error returning escrow:", error);
      return { success: false, error: error.message };
    }
  };

  return { lockEscrow, releaseEscrow, returnEscrow };
};
