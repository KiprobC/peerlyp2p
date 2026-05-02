import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

      // SECURITY DEFINER + idempotency-key overload prevents double-locking
      // when the user double-clicks or a request retries.
      const { data, error } = await (supabase.rpc as any)("lock_escrow", {
        p_seller_id: sellerId,
        p_crypto_type: normalizedCrypto,
        p_amount: amount,
        p_trade_id: tradeId,
        p_idempotency_key: `escrow_lock_${tradeId}`,
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
  // Then trigger on-chain USDT transfer via Tatum
  const releaseEscrow = async (
    sellerId: string,
    buyerId: string,
    cryptoType: string,
    amount: number,
    tradeId: string
  ): Promise<EscrowResult & { fee_amount?: number; buyer_amount?: number; tx_hash?: string }> => {
    try {
      const normalizedCrypto = normalizeCryptoType(cryptoType);

      // Step 1: Internal balance update (atomic DB transaction + idempotency)
      const { data, error } = await (supabase.rpc as any)("release_escrow_with_fee", {
        p_trade_id: tradeId,
        p_seller_id: sellerId,
        p_buyer_id: buyerId,
        p_crypto_type: normalizedCrypto,
        p_escrow_amount: amount,
        p_idempotency_key: `release_${tradeId}`,
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

      // Step 2: Trigger on-chain USDT transfer (only for USDT trades)
      let txHash: string | undefined;
      if (normalizedCrypto === "USDT") {
        try {
          const { data: sendData, error: sendError } = await supabase.functions.invoke(
            "tatum-send-usdt",
            { body: { trade_id: tradeId } }
          );

          if (sendError) {
            console.error("On-chain USDT transfer failed:", sendError);
            toast.error("Internal release succeeded, but on-chain transfer failed. Contact support.");
          } else if (sendData?.success) {
            txHash = sendData.tx_hash;
            console.log("On-chain USDT transfer successful:", txHash);
          } else if (sendData?.already_released) {
            console.log("On-chain transfer already completed");
          } else {
            console.error("On-chain transfer returned unexpected result:", sendData);
            toast.error("On-chain transfer issue. Contact support if funds not received.");
          }
        } catch (onChainError: any) {
          // Don't fail the whole release - internal balance is already updated
          console.error("On-chain transfer exception:", onChainError);
          toast.error("Internal release succeeded, but on-chain transfer failed. Contact support.");
        }
      }

      return {
        success: true,
        fee_amount: result.fee_amount,
        buyer_amount: result.buyer_amount,
        tx_hash: txHash,
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

      // Idempotent overload: same trade can't be refunded twice.
      const { data, error } = await (supabase.rpc as any)("return_escrow_with_reservation", {
        p_seller_id: sellerId,
        p_crypto_type: normalizedCrypto,
        p_amount: amount,
        p_trade_id: tradeId,
        p_idempotency_key: `refund_${tradeId}`,
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
