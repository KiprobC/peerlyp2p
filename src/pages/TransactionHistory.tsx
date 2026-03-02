import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Unlock,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cryptoInfo } from "@/hooks/useWallets";
import { format } from "date-fns";

const PAGE_SIZE = 20;

type TxType = "all" | "deposit" | "withdrawal" | "escrow_lock" | "escrow_release" | "trade";
type TxStatus = "all" | "pending" | "completed" | "failed";

const txTypeLabels: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  escrow_lock: "Escrow Lock",
  escrow_release: "Escrow Release",
  trade: "Trade",
};

const txTypeIcons: Record<string, typeof ArrowDownLeft> = {
  deposit: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  escrow_lock: Lock,
  escrow_release: Unlock,
  trade: RefreshCw,
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  completed: "bg-green-500/15 text-green-600 border-green-500/30",
  failed: "bg-red-500/15 text-red-600 border-red-500/30",
};

const TransactionHistory = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TxType>("all");
  const [statusFilter, setStatusFilter] = useState<TxStatus>("all");
  const [cryptoFilter, setCryptoFilter] = useState<string>("all");

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from("wallet_transactions")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (cryptoFilter !== "all") {
        query = query.eq("crypto_type", cryptoFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      setTransactions(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [user, page, typeFilter, statusFilter, cryptoFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    setPage(0);
  }, [typeFilter, statusFilter, cryptoFilter]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <h1 className="text-base font-semibold">Transaction History</h1>
            </div>
            <Badge variant="outline" className="text-xs">
              {totalCount} transactions
            </Badge>
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-24 md:pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TxType)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposits</SelectItem>
                <SelectItem value="withdrawal">Withdrawals</SelectItem>
                <SelectItem value="escrow_lock">Escrow Lock</SelectItem>
                <SelectItem value="escrow_release">Escrow Release</SelectItem>
                <SelectItem value="trade">Trade</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TxStatus)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={cryptoFilter} onValueChange={setCryptoFilter}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Crypto</SelectItem>
                <SelectItem value="BTC">BTC</SelectItem>
                <SelectItem value="ETH">ETH</SelectItem>
                <SelectItem value="USDT">USDT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transaction List */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16">
              <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">No transactions found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const info = cryptoInfo[tx.crypto_type] || { name: tx.crypto_type, icon: "?", color: "#888" };
                const Icon = txTypeIcons[tx.type] || RefreshCw;
                const isCredit = ["deposit", "escrow_release"].includes(tx.type);
                
                return (
                  <div
                    key={tx.id}
                    className="glass-card p-3 flex items-center gap-3"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${info.color}15`, color: info.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {txTypeLabels[tx.type] || tx.type}
                        </span>
                        <span className={`text-sm font-semibold ${isCredit ? "text-green-500" : "text-foreground"}`}>
                          {isCredit ? "+" : "-"}{tx.amount} {tx.crypto_type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(new Date(tx.created_at), "MMM d, HH:mm")}</span>
                          {tx.fee > 0 && (
                            <span className="text-muted-foreground/70">Fee: {tx.fee}</span>
                          )}
                          {tx.trade_id && (
                            <Link 
                              to={`/trade/${tx.trade_id}`} 
                              className="text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Trade
                            </Link>
                          )}
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] px-1.5 h-5 ${statusColors[tx.status] || ""}`}
                        >
                          {tx.status}
                        </Badge>
                      </div>
                      {tx.reference && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate font-mono">
                          Ref: {tx.reference}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 text-xs gap-1"
              >
                <ChevronLeft className="w-3 h-3" />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 text-xs gap-1"
              >
                Next
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TransactionHistory;
