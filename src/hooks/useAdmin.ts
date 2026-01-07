import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Admin Role Hook
export const useAdminRole = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });

        if (error) throw error;
        setIsAdmin(data || false);
      } catch (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminRole();
  }, [user]);

  return { isAdmin, loading };
};

// Admin User Interface
export interface AdminUser {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  kyc_status: "pending" | "submitted" | "verified" | "rejected";
  is_verified: boolean;
  total_trades: number;
  successful_trades: number;
  rating: number;
  setup_completed: boolean;
  created_at: string;
  updated_at: string;
}

// Admin Trade Interface
export interface AdminTrade {
  id: string;
  offer_id: string;
  buyer_id: string;
  seller_id: string;
  crypto_type: string;
  crypto_amount: number;
  fiat_amount: number;
  fiat_currency: string;
  payment_method: string;
  status: string;
  escrow_locked: boolean;
  escrow_released: boolean;
  dispute_reason: string | null;
  disputed_by: string | null;
  disputed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Admin Offer Interface
export interface AdminOffer {
  id: string;
  user_id: string;
  type: "buy" | "sell";
  crypto_type: string;
  crypto_amount: number;
  price_per_unit: number;
  min_amount: number;
  max_amount: number;
  fiat_currency: string;
  payment_methods: string[];
  terms: string | null;
  is_active: boolean;
  total_trades: number;
  created_at: string;
}

// Admin Wallet Interface
export interface AdminWallet {
  id: string;
  user_id: string;
  crypto_type: string;
  balance: number;
  locked_balance: number;
  address: string | null;
  created_at: string;
}

// Admin Transaction Interface
export interface AdminTransaction {
  id: string;
  user_id: string;
  wallet_id: string;
  type: string;
  amount: number;
  fee: number;
  crypto_type: string;
  status: string;
  reference: string | null;
  mpesa_receipt: string | null;
  description: string | null;
  created_at: string;
}

// Platform Stats Interface
export interface PlatformStats {
  totalUsers: number;
  verifiedUsers: number;
  pendingKYC: number;
  totalTrades: number;
  activeTrades: number;
  completedTrades: number;
  disputedTrades: number;
  cancelledTrades: number;
  totalVolume: number;
  todayVolume: number;
  weekVolume: number;
  monthVolume: number;
  activeOffers: number;
  totalOffers: number;
  totalEscrowLocked: number;
}

// Admin Users Hook
export const useAdminUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all trades to calculate dynamic trade counts per user
      const { data: tradesData } = await supabase
        .from("trades")
        .select("buyer_id, seller_id, status");

      // Calculate trade counts per user
      const userTradeStats = new Map<string, { total: number; completed: number }>();
      tradesData?.forEach((trade) => {
        // Count for buyer
        const buyerStats = userTradeStats.get(trade.buyer_id) || { total: 0, completed: 0 };
        buyerStats.total += 1;
        if (trade.status === "completed") buyerStats.completed += 1;
        userTradeStats.set(trade.buyer_id, buyerStats);

        // Count for seller
        const sellerStats = userTradeStats.get(trade.seller_id) || { total: 0, completed: 0 };
        sellerStats.total += 1;
        if (trade.status === "completed") sellerStats.completed += 1;
        userTradeStats.set(trade.seller_id, sellerStats);
      });

      // Merge dynamic trade counts with profiles
      const usersWithDynamicStats = (profilesData || []).map((profile) => {
        const stats = userTradeStats.get(profile.user_id) || { total: 0, completed: 0 };
        return {
          ...profile,
          total_trades: stats.total,
          successful_trades: stats.completed,
        };
      });

      setUsers(usersWithDynamicStats);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUserKYC = async (userId: string, status: "pending" | "submitted" | "verified" | "rejected") => {
    try {
      const updates: Record<string, unknown> = { kyc_status: status };
      if (status === "verified") {
        updates.is_verified = true;
        updates.kyc_verified_at = new Date().toISOString();
      } else if (status === "rejected") {
        updates.is_verified = false;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId);

      if (error) throw error;
      await fetchUsers();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const addUserNote = async (userId: string, note: string) => {
    // Store notes in a custom way - using bio field for now or create notifications
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        title: "Admin Note",
        message: note,
        type: "system",
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, updateUserKYC, addUserNote, refetch: fetchUsers };
};

// Admin Trades Hook
export const useAdminTrades = () => {
  const [trades, setTrades] = useState<AdminTrade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error("Error fetching trades:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const activeTrades = trades.filter((t) => ["pending", "confirmed", "payment_sent"].includes(t.status));
  const completedTrades = trades.filter((t) => t.status === "completed");
  const disputedTrades = trades.filter((t) => t.status === "disputed");
  const cancelledTrades = trades.filter((t) => t.status === "cancelled");

  const updateTradeStatus = async (
    tradeId: string, 
    status: "pending" | "confirmed" | "payment_sent" | "completed" | "disputed" | "cancelled", 
    updates: Record<string, unknown> = {}
  ) => {
    try {
      const { error } = await supabase
        .from("trades")
        .update({ status, ...updates, updated_at: new Date().toISOString() })
        .eq("id", tradeId);

      if (error) throw error;
      await fetchTrades();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const releaseEscrow = async (tradeId: string) => {
    try {
      // Get the trade details
      const trade = trades.find(t => t.id === tradeId);
      if (!trade) throw new Error("Trade not found");

      const normalizedCrypto = trade.crypto_type.toUpperCase().trim();

      // Get seller's wallet
      const { data: sellerWallet, error: sellerError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", trade.seller_id)
        .eq("crypto_type", normalizedCrypto)
        .maybeSingle();

      if (sellerError || !sellerWallet) throw new Error("Seller wallet not found");

      // Get or create buyer's wallet
      let buyerWallet;
      const { data: existingBuyerWallet, error: buyerError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", trade.buyer_id)
        .eq("crypto_type", normalizedCrypto)
        .maybeSingle();

      if (buyerError) throw buyerError;

      if (!existingBuyerWallet) {
        // Create buyer's wallet
        const { data: newWallet, error: createError } = await supabase
          .from("wallets")
          .insert({
            user_id: trade.buyer_id,
            crypto_type: normalizedCrypto,
            balance: 0,
            locked_balance: 0,
          })
          .select()
          .maybeSingle();

        if (createError && createError.code !== "23505") throw createError;
        
        // If creation failed due to conflict, fetch again
        if (createError?.code === "23505") {
          const { data: retryWallet } = await supabase
            .from("wallets")
            .select("*")
            .eq("user_id", trade.buyer_id)
            .eq("crypto_type", normalizedCrypto)
            .maybeSingle();
          buyerWallet = retryWallet;
        } else {
          buyerWallet = newWallet;
        }
      } else {
        buyerWallet = existingBuyerWallet;
      }

      if (!buyerWallet) throw new Error("Failed to get buyer wallet");

      const amount = Number(trade.crypto_amount);

      // Deduct from seller (both balance and locked_balance)
      const { error: sellerUpdateError } = await supabase
        .from("wallets")
        .update({
          balance: Math.max(0, Number(sellerWallet.balance) - amount),
          locked_balance: Math.max(0, Number(sellerWallet.locked_balance) - amount),
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
          user_id: trade.seller_id,
          type: "escrow_release",
          amount: -amount,
          crypto_type: normalizedCrypto,
          status: "completed",
          trade_id: tradeId,
          description: `Admin escrow release for trade ${tradeId.slice(0, 8)}`,
        },
        {
          wallet_id: buyerWallet.id,
          user_id: trade.buyer_id,
          type: "trade",
          amount: amount,
          crypto_type: normalizedCrypto,
          status: "completed",
          trade_id: tradeId,
          description: `Received from trade ${tradeId.slice(0, 8)} (admin release)`,
        },
      ]);

      // Update trade status
      return updateTradeStatus(tradeId, "completed", {
        escrow_released: true,
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      return { error };
    }
  };

  const lockEscrow = async (tradeId: string) => {
    return updateTradeStatus(tradeId, "disputed", {
      escrow_locked: true,
      disputed_at: new Date().toISOString(),
      dispute_reason: "Admin locked for investigation",
    });
  };

  const cancelTrade = async (tradeId: string, reason: string) => {
    try {
      // Get the trade details
      const trade = trades.find(t => t.id === tradeId);
      if (!trade) throw new Error("Trade not found");

      const normalizedCrypto = trade.crypto_type.toUpperCase().trim();

      // If escrow was locked, return funds to seller
      if (trade.escrow_locked) {
        const { data: sellerWallet, error: walletError } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", trade.seller_id)
          .eq("crypto_type", normalizedCrypto)
          .maybeSingle();

        if (!walletError && sellerWallet) {
          // Return funds from escrow (reduce locked_balance only, balance stays same)
          await supabase
            .from("wallets")
            .update({
              locked_balance: Math.max(0, Number(sellerWallet.locked_balance) - Number(trade.crypto_amount)),
            })
            .eq("id", sellerWallet.id);

          // Log the return transaction
          await supabase.from("wallet_transactions").insert({
            wallet_id: sellerWallet.id,
            user_id: trade.seller_id,
            type: "escrow_release",
            amount: 0,
            crypto_type: normalizedCrypto,
            status: "completed",
            trade_id: tradeId,
            description: `Escrow returned - trade cancelled by admin: ${reason}`,
          });
        }
      }

      return updateTradeStatus(tradeId, "cancelled", {
        cancelled_at: new Date().toISOString(),
        dispute_reason: reason,
      });
    } catch (error) {
      return { error };
    }
  };

  useEffect(() => {
    fetchTrades();

    // Real-time subscription
    const channel = supabase
      .channel("admin-trades")
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, () => {
        fetchTrades();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTrades]);

  return {
    trades,
    activeTrades,
    completedTrades,
    disputedTrades,
    cancelledTrades,
    loading,
    updateTradeStatus,
    releaseEscrow,
    lockEscrow,
    cancelTrade,
    refetch: fetchTrades,
  };
};

// Admin Offers Hook
export const useAdminOffers = () => {
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (error) {
      console.error("Error fetching offers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const activeOffers = offers.filter((o) => o.is_active);

  const updateOffer = async (offerId: string, updates: Partial<AdminOffer>) => {
    try {
      const { error } = await supabase
        .from("offers")
        .update(updates)
        .eq("id", offerId);

      if (error) throw error;
      await fetchOffers();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deactivateOffer = async (offerId: string) => {
    return updateOffer(offerId, { is_active: false });
  };

  const deleteOffer = async (offerId: string) => {
    try {
      const { error } = await supabase.from("offers").delete().eq("id", offerId);
      if (error) throw error;
      await fetchOffers();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  return { offers, activeOffers, loading, updateOffer, deactivateOffer, deleteOffer, refetch: fetchOffers };
};

// Admin Wallets Hook
export const useAdminWallets = () => {
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWallets(data || []);
    } catch (error) {
      console.error("Error fetching wallets:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const totalEscrowLocked = wallets.reduce((sum, w) => sum + Number(w.locked_balance), 0);

  const adjustWalletBalance = async (
    walletId: string,
    userId: string,
    amount: number,
    type: "credit" | "debit",
    reason: string
  ) => {
    try {
      // Get current wallet
      const wallet = wallets.find((w) => w.id === walletId);
      if (!wallet) throw new Error("Wallet not found");

      const newBalance = type === "credit" 
        ? Number(wallet.balance) + amount 
        : Number(wallet.balance) - amount;

      if (newBalance < 0) throw new Error("Insufficient balance");

      // Update wallet
      const { error: walletError } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("id", walletId);

      if (walletError) throw walletError;

      // Log transaction
      const { error: txError } = await supabase.from("wallet_transactions").insert({
        wallet_id: walletId,
        user_id: userId,
        type: type === "credit" ? "deposit" : "withdrawal",
        amount: amount,
        crypto_type: wallet.crypto_type,
        status: "completed",
        description: `Admin ${type}: ${reason}`,
      });

      if (txError) throw txError;

      await fetchWallets();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  return { wallets, totalEscrowLocked, loading, adjustWalletBalance, refetch: fetchWallets };
};

// Admin Transactions Hook
export const useAdminTransactions = () => {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const mpesaTransactions = transactions.filter((t) => t.mpesa_receipt);
  const pendingTransactions = transactions.filter((t) => t.status === "pending");

  const updateTransactionStatus = async (txId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("wallet_transactions")
        .update({ status })
        .eq("id", txId);

      if (error) throw error;
      await fetchTransactions();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, mpesaTransactions, pendingTransactions, loading, updateTransactionStatus, refetch: fetchTransactions };
};

// Platform Stats Hook
export const usePlatformStats = () => {
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    verifiedUsers: 0,
    pendingKYC: 0,
    totalTrades: 0,
    activeTrades: 0,
    completedTrades: 0,
    disputedTrades: 0,
    cancelledTrades: 0,
    totalVolume: 0,
    todayVolume: 0,
    weekVolume: 0,
    monthVolume: 0,
    activeOffers: 0,
    totalOffers: 0,
    totalEscrowLocked: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Fetch users
        const { data: usersData } = await supabase.from("profiles").select("is_verified, kyc_status");
        const totalUsers = usersData?.length || 0;
        const verifiedUsers = usersData?.filter((u) => u.is_verified).length || 0;
        const pendingKYC = usersData?.filter((u) => u.kyc_status === "submitted").length || 0;

        // Fetch trades
        const { data: tradesData } = await supabase.from("trades").select("status, fiat_amount, created_at");
        const totalTrades = tradesData?.length || 0;
        const activeTrades = tradesData?.filter((t) => ["pending", "confirmed", "payment_sent"].includes(t.status || "")).length || 0;
        const completedTrades = tradesData?.filter((t) => t.status === "completed").length || 0;
        const disputedTrades = tradesData?.filter((t) => t.status === "disputed").length || 0;
        const cancelledTrades = tradesData?.filter((t) => t.status === "cancelled").length || 0;
        const totalVolume = tradesData?.reduce((sum, t) => sum + Number(t.fiat_amount), 0) || 0;
        const todayVolume = tradesData?.filter((t) => t.created_at >= todayStart).reduce((sum, t) => sum + Number(t.fiat_amount), 0) || 0;
        const weekVolume = tradesData?.filter((t) => t.created_at >= weekStart).reduce((sum, t) => sum + Number(t.fiat_amount), 0) || 0;
        const monthVolume = tradesData?.filter((t) => t.created_at >= monthStart).reduce((sum, t) => sum + Number(t.fiat_amount), 0) || 0;

        // Fetch offers
        const { data: offersData } = await supabase.from("offers").select("is_active");
        const totalOffers = offersData?.length || 0;
        const activeOffers = offersData?.filter((o) => o.is_active).length || 0;

        // Fetch wallets for escrow
        const { data: walletsData } = await supabase.from("wallets").select("locked_balance");
        const totalEscrowLocked = walletsData?.reduce((sum, w) => sum + Number(w.locked_balance), 0) || 0;

        setStats({
          totalUsers,
          verifiedUsers,
          pendingKYC,
          totalTrades,
          activeTrades,
          completedTrades,
          disputedTrades,
          cancelledTrades,
          totalVolume,
          todayVolume,
          weekVolume,
          monthVolume,
          activeOffers,
          totalOffers,
          totalEscrowLocked,
        });
      } catch (error) {
        console.error("Error fetching platform stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return { stats, loading };
};

// Trade Messages Hook for Disputes - Enhanced with usernames
export const useAdminTradeMessages = (tradeId: string) => {
  const [messages, setMessages] = useState<Array<{
    id: string;
    trade_id: string;
    sender_id: string;
    sender_username?: string;
    sender_avatar?: string;
    message: string;
    is_system: boolean;
    created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tradeId) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("trade_messages")
          .select("*")
          .eq("trade_id", tradeId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        // Fetch sender profiles for usernames
        if (data && data.length > 0) {
          const senderIds = [...new Set(data.map(m => m.sender_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, username, full_name, avatar_url")
            .in("user_id", senderIds);

          const enrichedMessages = data.map(msg => {
            const profile = profiles?.find(p => p.user_id === msg.sender_id);
            return {
              ...msg,
              sender_username: profile?.username || profile?.full_name || msg.sender_id.slice(0, 8),
              sender_avatar: profile?.avatar_url || null,
            };
          });
          setMessages(enrichedMessages);
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [tradeId]);

  return { messages, loading };
};

// Trade Details Hook for Disputes - Fetch full trade with trader profiles
export const useAdminTradeDetails = (tradeId: string) => {
  const [trade, setTrade] = useState<AdminTrade & {
    buyer_username?: string;
    seller_username?: string;
    buyer_rating?: number;
    seller_rating?: number;
    buyer_trades?: number;
    seller_trades?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tradeId) return;

    const fetchTradeDetails = async () => {
      try {
        const { data: tradeData, error } = await supabase
          .from("trades")
          .select("*")
          .eq("id", tradeId)
          .single();

        if (error) throw error;

        if (tradeData) {
          // Fetch buyer and seller profiles
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, username, full_name, rating")
            .in("user_id", [tradeData.buyer_id, tradeData.seller_id]);

          // Fetch trade counts
          const { data: allTrades } = await supabase
            .from("trades")
            .select("buyer_id, seller_id, status")
            .or(`buyer_id.eq.${tradeData.buyer_id},seller_id.eq.${tradeData.buyer_id},buyer_id.eq.${tradeData.seller_id},seller_id.eq.${tradeData.seller_id}`);

          const buyerProfile = profiles?.find(p => p.user_id === tradeData.buyer_id);
          const sellerProfile = profiles?.find(p => p.user_id === tradeData.seller_id);

          const buyerTrades = allTrades?.filter(t => 
            t.buyer_id === tradeData.buyer_id || t.seller_id === tradeData.buyer_id
          ).length || 0;
          const sellerTrades = allTrades?.filter(t => 
            t.buyer_id === tradeData.seller_id || t.seller_id === tradeData.seller_id
          ).length || 0;

          setTrade({
            ...tradeData,
            buyer_username: buyerProfile?.username || buyerProfile?.full_name || 'Unknown',
            seller_username: sellerProfile?.username || sellerProfile?.full_name || 'Unknown',
            buyer_rating: buyerProfile?.rating || 0,
            seller_rating: sellerProfile?.rating || 0,
            buyer_trades: buyerTrades,
            seller_trades: sellerTrades,
          });
        }
      } catch (error) {
        console.error("Error fetching trade details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTradeDetails();
  }, [tradeId]);

  return { trade, loading };
};

// Admin Notifications Hook
export const useAdminNotifications = () => {
  const sendSystemNotification = async (
    userId: string, 
    title: string, 
    message: string,
    type: "system" | "trade" | "payment" | "kyc" | "message" = "system"
  ) => {
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message,
        type,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const sendBulkNotification = async (
    userIds: string[], 
    title: string, 
    message: string,
    type: "system" | "trade" | "payment" | "kyc" | "message" = "system"
  ) => {
    try {
      const notifications = userIds.map((userId) => ({
        user_id: userId,
        title,
        message,
        type,
      }));

      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  return { sendSystemNotification, sendBulkNotification };
};
