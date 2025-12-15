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
): Promise<{ wallet: any; error?: string }> => {
  const normalizedCrypto = normalizeCryptoType(cryptoType);

  // Call the SECURITY DEFINER function to get or create wallet
  const { data: walletId, error: rpcError } = await supabase
    .rpc("get_or_create_wallet", {
      p_user_id: userId,
      p_crypto_type: normalizedCrypto,
    });

  if (rpcError) {
    console.error("Error in get_or_create_wallet RPC:", rpcError);
    return { wallet: null, error: rpcError.message };
  }

  if (!walletId) {
    return { wallet: null, error: "Failed to get or create wallet" };
  }

  // Fetch the full wallet data
  const { data: wallet, error: fetchError } = await supabase
    .from("wallets")
    .select("*")
    .eq("id", walletId)
    .single();

  if (fetchError) {
    console.error("Error fetching wallet after creation:", fetchError);
    return { wallet: null, error: fetchError.message };
  }

  return { wallet };
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

  // Release escrow to buyer when trade completes
  const releaseEscrow = async (
    sellerId: string,
    buyerId: string,
    cryptoType: string,
    amount: number,
    tradeId: string
  ): Promise<EscrowResult> => {
    try {
      const normalizedCrypto = normalizeCryptoType(cryptoType);

      // Get seller's wallet
      const { data: sellerWallet, error: sellerError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", sellerId)
        .eq("crypto_type", normalizedCrypto)
        .maybeSingle();

      if (sellerError) throw sellerError;
      if (!sellerWallet) {
        return { success: false, error: "Seller wallet not found" };
      }

      // Get or create buyer's wallet (auto-create if doesn't exist)
      const { wallet: buyerWallet, error: buyerError } = await getOrCreateWallet(buyerId, normalizedCrypto);

      if (buyerError || !buyerWallet) {
        return { success: false, error: buyerError || "Failed to get buyer wallet" };
      }

      // Verify locked balance
      if (Number(sellerWallet.locked_balance) < amount) {
        return { success: false, error: "Insufficient locked balance" };
      }

      // Deduct from seller (both balance and locked_balance)
      const { error: sellerUpdateError } = await supabase
        .from("wallets")
        .update({
          balance: Number(sellerWallet.balance) - amount,
          locked_balance: Number(sellerWallet.locked_balance) - amount,
        })
        .eq("id", sellerWallet.id);

      if (sellerUpdateError) throw sellerUpdateError;

      // Credit to buyer
      const { error: buyerUpdateError } = await supabase
        .from("wallets")
        .update({
          balance: Number(buyerWallet.balance) + amount,
        })
        .eq("id", buyerWallet.id);

      if (buyerUpdateError) throw buyerUpdateError;

      // Log transactions
      await supabase.from("wallet_transactions").insert([
        {
          wallet_id: sellerWallet.id,
          user_id: sellerId,
          type: "escrow_release",
          amount: -amount,
          crypto_type: normalizedCrypto,
          status: "completed",
          trade_id: tradeId,
          description: `Escrow released for trade ${tradeId.slice(0, 8)}`,
        },
        {
          wallet_id: buyerWallet.id,
          user_id: buyerId,
          type: "trade",
          amount: amount,
          crypto_type: normalizedCrypto,
          status: "completed",
          trade_id: tradeId,
          description: `Received from trade ${tradeId.slice(0, 8)}`,
        },
      ]);

      return { success: true };
    } catch (error: any) {
      console.error("Error releasing escrow:", error);
      return { success: false, error: error.message };
    }
  };

  // Return funds to seller if trade is cancelled
  const returnEscrow = async (
    sellerId: string,
    cryptoType: string,
    amount: number,
    tradeId: string
  ): Promise<EscrowResult> => {
    try {
      const normalizedCrypto = normalizeCryptoType(cryptoType);

      // Get seller's wallet
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", sellerId)
        .eq("crypto_type", normalizedCrypto)
        .maybeSingle();

      if (walletError) throw walletError;
      if (!wallet) {
        return { success: false, error: "Wallet not found" };
      }

      // Return funds from escrow (reduce locked_balance)
      const { error: updateError } = await supabase
        .from("wallets")
        .update({
          locked_balance: Math.max(0, Number(wallet.locked_balance) - amount),
        })
        .eq("id", wallet.id);

      if (updateError) throw updateError;

      // Log the return transaction
      await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        user_id: sellerId,
        type: "escrow_release",
        amount: 0,
        crypto_type: normalizedCrypto,
        status: "completed",
        trade_id: tradeId,
        description: `Escrow returned - trade cancelled ${tradeId.slice(0, 8)}`,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error returning escrow:", error);
      return { success: false, error: error.message };
    }
  };

  return { lockEscrow, releaseEscrow, returnEscrow };
};
