import { supabase } from "@/integrations/supabase/client";

export interface EscrowResult {
  success: boolean;
  error?: string;
}

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
      // Get seller's wallet - use maybeSingle to handle 0 or 1 result
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", sellerId)
        .eq("crypto_type", cryptoType)
        .maybeSingle();

      if (walletError) throw walletError;
      if (!wallet) {
        return { success: false, error: `Wallet not found for ${cryptoType}` };
      }

      // Check if seller has enough balance
      const availableBalance = Number(wallet.balance) - Number(wallet.locked_balance);
      if (availableBalance < amount) {
        return { success: false, error: "Insufficient balance for escrow" };
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
        crypto_type: cryptoType,
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
      // Get seller's wallet
      const { data: sellerWallet, error: sellerError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", sellerId)
        .eq("crypto_type", cryptoType)
        .maybeSingle();

      if (sellerError) throw sellerError;
      if (!sellerWallet) {
        return { success: false, error: "Seller wallet not found" };
      }

      // Get buyer's wallet
      const { data: buyerWallet, error: buyerError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", buyerId)
        .eq("crypto_type", cryptoType)
        .maybeSingle();

      if (buyerError) throw buyerError;
      if (!buyerWallet) {
        return { success: false, error: "Buyer wallet not found" };
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
          crypto_type: cryptoType,
          status: "completed",
          trade_id: tradeId,
          description: `Escrow released for trade ${tradeId.slice(0, 8)}`,
        },
        {
          wallet_id: buyerWallet.id,
          user_id: buyerId,
          type: "trade",
          amount: amount,
          crypto_type: cryptoType,
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
      // Get seller's wallet
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", sellerId)
        .eq("crypto_type", cryptoType)
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
        crypto_type: cryptoType,
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
