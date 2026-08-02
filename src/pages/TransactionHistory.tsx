import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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
  Copy,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cryptoInfo } from "@/hooks/useWallets";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { polishTxDescription } from "@/lib/treasuryCopy";

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

const statusIcons: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2,
  pending: Clock,
  failed: XCircle,
};

const TransactionHistory = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get("type") || "all") as TxType;
  const initialStatus = (searchParams.get("status") || "all") as TxStatus;
  const deepLinkTxId = searchParams.get("tx");

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TxType>(initialType);
  const [statusFilter, setStatusFilter] = useState<TxStatus>(initialStatus);
  const [cryptoFilter, setCryptoFilter] = useState<string>("all");
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  // Deep link: open the exact transaction referenced by a notification.
  useEffect(() => {
    const openDeepLink = async () => {
      if (!deepLinkTxId || !user) return;
      const local = transactions.find((t) => t.id === deepLinkTxId);
      if (local) {
        setSelectedTx(local);
        return;
      }
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("id", deepLinkTxId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setSelectedTx(data);
    };
    openDeepLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkTxId, user, transactions.length]);


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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Copied to clipboard" });
  };

  const DetailRow = ({ label, value, copyable }: { label: string; value: string | React.ReactNode; copyable?: boolean }) => (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-foreground text-right truncate">
          {value}
        </span>
        {copyable && typeof value === "string" && (
          <button onClick={() => copyToClipboard(value)} className="shrink-0 text-muted-foreground hover:text-foreground">
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );

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
                    className="glass-card p-3 flex items-center gap-3 cursor-pointer hover:bg-secondary/50 transition-colors active:scale-[0.99]"
                    onClick={() => setSelectedTx(tx)}
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
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(tx.created_at), "MMM d, HH:mm")}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] px-1.5 h-5 ${statusColors[tx.status] || ""}`}
                        >
                          {tx.status}
                        </Badge>
                      </div>
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

      {/* Transaction Detail Sheet */}
      <Sheet open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          {selectedTx && (() => {
            const info = cryptoInfo[selectedTx.crypto_type] || { name: selectedTx.crypto_type, icon: "?", color: "#888" };
            const Icon = txTypeIcons[selectedTx.type] || RefreshCw;
            const StatusIcon = statusIcons[selectedTx.status] || Clock;
            const isCredit = ["deposit", "escrow_release"].includes(selectedTx.type);

            return (
              <>
                <SheetHeader className="pb-4">
                  <SheetTitle className="sr-only">Transaction Details</SheetTitle>
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${info.color}15`, color: info.color }}
                    >
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">
                        {txTypeLabels[selectedTx.type] || selectedTx.type}
                      </p>
                      <p className={`text-2xl font-bold mt-1 ${isCredit ? "text-green-500" : "text-foreground"}`}>
                        {isCredit ? "+" : "-"}{selectedTx.amount} {selectedTx.crypto_type}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`gap-1.5 ${statusColors[selectedTx.status] || ""}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {selectedTx.status?.charAt(0).toUpperCase() + selectedTx.status?.slice(1)}
                    </Badge>
                  </div>
                </SheetHeader>

                <Separator />

                <div className="py-3 space-y-0.5">
                  <DetailRow label="Type" value={txTypeLabels[selectedTx.type] || selectedTx.type} />
                  <DetailRow label="Asset" value={`${info.icon} ${info.name} (${selectedTx.crypto_type})`} />
                  <DetailRow
                    label="Amount"
                    value={`${selectedTx.amount} ${selectedTx.crypto_type}`}
                  />
                  {selectedTx.fee > 0 && (
                    <DetailRow label="Fee" value={`${selectedTx.fee} ${selectedTx.crypto_type}`} />
                  )}
                  <DetailRow
                    label="Date"
                    value={format(new Date(selectedTx.created_at), "MMM d, yyyy 'at' HH:mm:ss")}
                  />
                </div>

                <Separator />

                <div className="py-3 space-y-0.5">
                  {selectedTx.description && (
                    <DetailRow label="Description" value={polishTxDescription(selectedTx.description)} />
                  )}
                  {selectedTx.reference && (
                    <DetailRow label="Reference" value={selectedTx.reference} copyable />
                  )}
                  {selectedTx.mpesa_receipt && (
                    <DetailRow label="M-Pesa Receipt" value={selectedTx.mpesa_receipt} copyable />
                  )}
                  <DetailRow label="Transaction ID" value={selectedTx.id?.slice(0, 16) + "..."} copyable />
                </div>

                {selectedTx.trade_id && (
                  <>
                    <Separator />
                    <div className="py-3">
                      <Link to={`/trade/${selectedTx.trade_id}`} onClick={() => setSelectedTx(null)}>
                        <Button variant="outline" className="w-full gap-2 h-10">
                          <ExternalLink className="w-4 h-4" />
                          View Related Trade
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TransactionHistory;
