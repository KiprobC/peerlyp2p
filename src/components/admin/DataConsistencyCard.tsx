import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, AlertTriangle, RefreshCw, Database, Eye, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConsistencyCheck {
  name: string;
  status: "pass" | "warning" | "critical";
  expected: string;
  actual: string;
  message: string;
  details?: string;
  fixable?: boolean;
  fixAction?: () => Promise<void>;
}

export const DataConsistencyCard = () => {
  const [checks, setChecks] = useState<ConsistencyCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<ConsistencyCheck | null>(null);
  const [fixing, setFixing] = useState(false);

  const runConsistencyChecks = useCallback(async () => {
    setLoading(true);
    const results: ConsistencyCheck[] = [];

    try {
      // --- Check 1: Escrow locked balance matches active trades ---
      const { data: wallets } = await supabase
        .from("wallets")
        .select("locked_balance, balance, crypto_type, user_id, id");

      const { data: activeTrades } = await supabase
        .from("trades")
        .select("crypto_amount, crypto_type, escrow_locked, escrow_released, status, seller_id")
        .eq("escrow_locked", true)
        .eq("escrow_released", false)
        .in("status", ["pending", "confirmed", "payment_sent", "disputed"]);

      const walletLockedByType: Record<string, number> = {};
      const tradeLockedByType: Record<string, number> = {};

      wallets?.forEach(w => {
        const crypto = w.crypto_type.toUpperCase();
        walletLockedByType[crypto] = (walletLockedByType[crypto] || 0) + Number(w.locked_balance);
      });

      activeTrades?.forEach(t => {
        const crypto = t.crypto_type.toUpperCase();
        tradeLockedByType[crypto] = (tradeLockedByType[crypto] || 0) + Number(t.crypto_amount);
      });

      const allCryptos = new Set([...Object.keys(walletLockedByType), ...Object.keys(tradeLockedByType)]);

      allCryptos.forEach(crypto => {
        const walletLocked = walletLockedByType[crypto] || 0;
        const tradeLocked = tradeLockedByType[crypto] || 0;
        const diff = Math.abs(walletLocked - tradeLocked);
        const tolerance = 0.00000001;

        results.push({
          name: `${crypto} Escrow Balance`,
          status: diff < tolerance ? "pass" : diff < 0.001 ? "warning" : "critical",
          expected: tradeLocked.toFixed(8),
          actual: walletLocked.toFixed(8),
          message: diff < tolerance
            ? "Wallet locked balances match active escrow trades"
            : `Mismatch of ${diff.toFixed(8)} ${crypto} detected`,
          details: diff >= tolerance
            ? `Sum of wallet locked_balance for ${crypto}: ${walletLocked.toFixed(8)}\nSum of active trade escrow amounts for ${crypto}: ${tradeLocked.toFixed(8)}\nDifference: ${diff.toFixed(8)} ${crypto}\n\nThis could indicate orphaned escrow locks or trades that weren't properly settled.`
            : undefined,
        });
      });

      // --- Check 2: No negative wallet balances ---
      const negativeBalances = wallets?.filter(w => Number(w.balance) < 0 || Number(w.locked_balance) < 0) || [];
      results.push({
        name: "Negative Balance Check",
        status: negativeBalances.length === 0 ? "pass" : "critical",
        expected: "0 wallets",
        actual: `${negativeBalances.length} wallets`,
        message: negativeBalances.length === 0
          ? "No wallets have negative balances"
          : `${negativeBalances.length} wallet(s) have negative balance or locked_balance`,
        details: negativeBalances.length > 0
          ? negativeBalances.map(w => `Wallet ${w.id} (user: ${w.user_id}, ${w.crypto_type}): balance=${w.balance}, locked=${w.locked_balance}`).join("\n")
          : undefined,
      });

      // --- Check 3: Escrow without active trade (orphaned) ---
      const { data: escrowTrades } = await supabase
        .from("trades")
        .select("id, escrow_locked, escrow_released, status")
        .eq("escrow_locked", true)
        .eq("escrow_released", false);

      const orphanedEscrow = escrowTrades?.filter(t =>
        !["pending", "confirmed", "payment_sent", "disputed"].includes(t.status || "")
      ) || [];

      results.push({
        name: "Orphaned Escrow Check",
        status: orphanedEscrow.length === 0 ? "pass" : "critical",
        expected: "0 orphaned",
        actual: `${orphanedEscrow.length} orphaned`,
        message: orphanedEscrow.length === 0
          ? "No trades have locked escrow in terminal status"
          : `${orphanedEscrow.length} trade(s) have locked escrow but are in completed/cancelled status`,
        details: orphanedEscrow.length > 0
          ? orphanedEscrow.map(t => `Trade ${t.id}: status=${t.status}, escrow_locked=${t.escrow_locked}`).join("\n")
          : undefined,
      });

      // --- Check 4: KYC status consistency ---
      const { data: profiles } = await supabase
        .from("profiles")
        .select("kyc_status, is_verified, user_id");

      let kycInconsistent = 0;
      const kycDetails: string[] = [];
      profiles?.forEach(p => {
        if (p.kyc_status === "verified" && !p.is_verified) {
          kycInconsistent++;
          kycDetails.push(`User ${p.user_id}: kyc_status=verified but is_verified=false`);
        }
        if (p.kyc_status !== "verified" && p.is_verified) {
          kycInconsistent++;
          kycDetails.push(`User ${p.user_id}: kyc_status=${p.kyc_status} but is_verified=true`);
        }
      });

      results.push({
        name: "KYC Status Consistency",
        status: kycInconsistent === 0 ? "pass" : "warning",
        expected: "0 inconsistencies",
        actual: `${kycInconsistent} inconsistencies`,
        message: kycInconsistent === 0
          ? "All KYC statuses are consistent with verification flags"
          : `${kycInconsistent} profiles have mismatched KYC status`,
        details: kycDetails.length > 0 ? kycDetails.join("\n") : undefined,
        fixable: kycInconsistent > 0,
      });

      // --- Check 5: Released escrow = completed/cancelled ---
      const { data: releasedNotDone } = await supabase
        .from("trades")
        .select("id, status")
        .eq("escrow_released", true)
        .not("status", "in", '("completed","cancelled")');

      results.push({
        name: "Escrow Release Status",
        status: (releasedNotDone?.length || 0) === 0 ? "pass" : "critical",
        expected: "0 trades",
        actual: `${releasedNotDone?.length || 0} trades`,
        message: (releasedNotDone?.length || 0) === 0
          ? "All released escrows have proper final status"
          : `${releasedNotDone?.length} trades have released escrow but aren't completed/cancelled`,
        details: releasedNotDone?.map(t => `Trade ${t.id}: status=${t.status}`).join("\n"),
      });

      // --- Check 6: Fee wallet vs ledger ---
      const { data: feeWallets } = await supabase
        .from("platform_wallets")
        .select("balance, crypto_type")
        .eq("wallet_type", "fees");

      const { data: feeEntries } = await supabase
        .from("treasury_ledger")
        .select("amount, crypto_type")
        .eq("ledger_type", "fee_collected");

      const feeWalletByType: Record<string, number> = {};
      const feeLedgerByType: Record<string, number> = {};

      feeWallets?.forEach(w => {
        feeWalletByType[w.crypto_type] = Number(w.balance);
      });
      feeEntries?.forEach(e => {
        feeLedgerByType[e.crypto_type] = (feeLedgerByType[e.crypto_type] || 0) + Number(e.amount);
      });

      Object.keys(feeWalletByType).forEach(crypto => {
        const walletBalance = feeWalletByType[crypto] || 0;
        const ledgerTotal = feeLedgerByType[crypto] || 0;
        const diff = Math.abs(walletBalance - ledgerTotal);

        results.push({
          name: `${crypto} Fee Wallet vs Ledger`,
          status: diff < 0.00000001 ? "pass" : diff < 0.01 ? "warning" : "critical",
          expected: ledgerTotal.toFixed(8),
          actual: walletBalance.toFixed(8),
          message: diff < 0.00000001
            ? "Fee wallet matches collected fees in ledger"
            : `Difference of ${diff.toFixed(8)} ${crypto} between fee wallet and ledger`,
          details: `Fee wallet balance: ${walletBalance.toFixed(8)} ${crypto}\nSum of fee_collected ledger entries: ${ledgerTotal.toFixed(8)} ${crypto}`,
        });
      });
    } catch (error) {
      console.error("Error running consistency checks:", error);
      results.push({
        name: "System Check",
        status: "critical",
        expected: "All checks pass",
        actual: "Check failed",
        message: "Error running consistency checks. See console for details.",
      });
    }

    setChecks(results);
    setLastChecked(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    runConsistencyChecks();
  }, [runConsistencyChecks]);

  const passCount = checks.filter(c => c.status === "pass").length;
  const warningCount = checks.filter(c => c.status === "warning").length;
  const criticalCount = checks.filter(c => c.status === "critical").length;

  const handleFix = async (check: ConsistencyCheck) => {
    if (!check.fixAction) return;
    setFixing(true);
    try {
      await check.fixAction();
      toast.success(`Fixed: ${check.name}`);
      await runConsistencyChecks();
    } catch {
      toast.error("Fix failed");
    } finally {
      setFixing(false);
      setSelectedCheck(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-primary" />
                Data Consistency & Integrity
              </CardTitle>
              <CardDescription>
                Automated financial integrity checks with severity levels
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={runConsistencyChecks}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Recheck
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-secondary/50">
            <Badge variant="default" className="bg-green-500/20 text-green-500">
              {passCount} Pass
            </Badge>
            {warningCount > 0 && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                {warningCount} Warning
              </Badge>
            )}
            {criticalCount > 0 && (
              <Badge variant="destructive">
                {criticalCount} Critical
              </Badge>
            )}
            {lastChecked && (
              <span className="text-xs text-muted-foreground ml-auto">
                Last checked: {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Check Results */}
          <div className="space-y-2">
            {checks.map((check, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  check.status === "pass"
                    ? "border-green-500/30 bg-green-500/5"
                    : check.status === "warning"
                    ? "border-yellow-500/30 bg-yellow-500/5"
                    : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  {check.status === "pass" ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle
                      className={`h-4 w-4 mt-0.5 shrink-0 ${
                        check.status === "warning" ? "text-yellow-500" : "text-destructive"
                      }`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{check.name}</span>
                      {check.status !== "pass" && (
                        <Badge
                          variant={check.status === "critical" ? "destructive" : "outline"}
                          className={check.status === "warning" ? "border-yellow-500 text-yellow-500" : ""}
                        >
                          {check.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{check.message}</p>
                    {check.status !== "pass" && (
                      <div className="flex gap-4 mt-2 text-xs">
                        <span>
                          Expected: <span className="font-mono">{check.expected}</span>
                        </span>
                        <span>
                          Actual: <span className="font-mono">{check.actual}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  {check.status !== "pass" && (
                    <div className="flex gap-1 shrink-0">
                      {check.details && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setSelectedCheck(check)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {check.fixable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary"
                          onClick={() => handleFix(check)}
                          disabled={fixing}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedCheck} onOpenChange={() => setSelectedCheck(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${
                selectedCheck?.status === "critical" ? "text-destructive" : "text-yellow-500"
              }`} />
              {selectedCheck?.name}
            </DialogTitle>
            <DialogDescription>{selectedCheck?.message}</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div className="flex gap-4 mb-4 text-sm">
              <div>
                <span className="text-muted-foreground">Expected:</span>{" "}
                <span className="font-mono font-medium">{selectedCheck?.expected}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Actual:</span>{" "}
                <span className="font-mono font-medium">{selectedCheck?.actual}</span>
              </div>
            </div>
            <pre className="p-4 rounded-lg bg-muted text-xs font-mono whitespace-pre-wrap overflow-auto max-h-64">
              {selectedCheck?.details}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
