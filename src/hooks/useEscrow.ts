import { supabase } from "@/integrations/supabase/client";

export interface EscrowResult {
  success: boolean;
  error?: string;
}

// Helper to normalize crypto type to uppercase
const normalizeCryptoType = (cryptoType: string): string => {
  return cryptoType.toUpperCase().trim();
};

// Helper to get or create a wallet for a user
const getOrCreateWallet = async (
  userId: string,
  cryptoType: string
): Promise<{ wallet: any; error?: string }> => {
  const normalizedCrypto = normalizeCryptoType(cryptoType);

  // Try to get existing wallet
  const { data: existingWallet, error: fetchError } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .eq("crypto_type", normalizedCrypto)
    .maybeSingle();

  if (fetchError) {
    console.error("Error fetching wallet:", fetchError);
    return { wallet: null, error: fetchError.message };
  }

  if (existingWallet) {
    return { wallet: existingWallet };
  }

  // Wallet doesn't exist, create it
  const { data: newWallet, error: createError } = await supabase
    .from("wallets")
    .insert({
      user_id: userId,
      crypto_type: normalizedCrypto,
      balance: 0,
      locked_balance: 0,
    })
    .select()
    .maybeSingle();

  if (createError) {
    // Handle unique constraint violation (wallet was created by another request)
    if (createError.code === "23505") {
      // Retry fetching the wallet
      const { data: retryWallet, error: retryError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .eq("crypto_type", normalizedCrypto)
        .maybeSingle();

      if (retryError || !retryWallet) {
        return { wallet: null, error: "Failed to get wallet after creation conflict" };
      }
      return { wallet: retryWallet };
    }

    console.error("Error creating wallet:", createError);
    return { wallet: null, error: createError.message };
  }

  return { wallet: newWallet };
};

// Hook for managing escrow operations
export const useEscrow = () => {
  // Lock funds in escrow when trade is confirmed
  const lockEscrow = async (
    sellerId: string,
    cryptoType: string,
    amount: number,
    tradeId: string
  ): Promise<EscrowResult> => {
    try {
      const normalizedCrypto = normalizeCryptoType(cryptoType);

      // Get or create seller's wallet (lazy creation).
      // Balance checks below will still prevent escrow locking unless sufficient available balance exists.
      const { wallet, error: walletFetchError } = await getOrCreateWallet(sellerId, normalizedCrypto);

      if (walletFetchError || !wallet) {
        return { success: false, error: walletFetchError || "Failed to get seller wallet" };
      }

      // Check if seller has enough available balance (balance - locked_balance)
      const availableBalance = Number(wallet.balance) - Number(wallet.locked_balance);
      if (availableBalance < amount) {
        return { 
          success: false, 
          error: `Insufficient balance. Available: ${availableBalance.toFixed(8)} ${normalizedCrypto}, Required: ${amount.toFixed(8)} ${normalizedCrypto}` 
        };
      }

      // Lock the amount in escrow (increase locked_balance)
      const { error: updateError } = await supabase
        .from("wallets")
        .update({
          locked_balance: Number(wallet.locked_balance) + amount,
        })
        .eq("id", wallet.id);

      if (updateError) throw updateError;

      // Log the escrow transaction
      const { error: txError } = await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        user_id: sellerId,
        type: "escrow_lock",
        amount: amount,
        crypto_type: normalizedCrypto,
        status: "completed",
        trade_id: tradeId,
        description: `Escrow locked for trade ${tradeId.slice(0, 8)}`,
      });

      if (txError) console.error("Failed to log escrow transaction:", txError);

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
