import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, RefreshCw, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ConsistencyCheck {
  name: string;
  status: "pass" | "warning" | "error";
  expected: string;
  actual: string;
  message: string;
}

export const DataConsistencyCard = () => {
  const [checks, setChecks] = useState<ConsistencyCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runConsistencyChecks = async () => {
    setLoading(true);
    const results: ConsistencyCheck[] = [];

    try {
      // Check 1: Escrow locked balance matches trades with escrow_locked
      const { data: wallets } = await supabase
        .from("wallets")
        .select("locked_balance, crypto_type");
      
      const { data: activeTrades } = await supabase
        .from("trades")
        .select("crypto_amount, crypto_type, escrow_locked, escrow_released, status")
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
        const tolerance = 0.00000001; // Small tolerance for floating point

        results.push({
          name: `${crypto} Escrow Balance`,
          status: diff < tolerance ? "pass" : diff < 0.001 ? "warning" : "error",
          expected: tradeLocked.toFixed(8),
          actual: walletLocked.toFixed(8),
          message: diff < tolerance 
            ? "Wallet locked balances match active escrow trades" 
            : `Difference of ${diff.toFixed(8)} ${crypto} detected`,
        });
      });

      // Check 2: KYC status consistency
      const { data: profiles } = await supabase
        .from("profiles")
        .select("kyc_status, is_verified");

      let kycInconsistent = 0;
      profiles?.forEach(p => {
        if (p.kyc_status === "verified" && !p.is_verified) kycInconsistent++;
        if (p.kyc_status !== "verified" && p.is_verified) kycInconsistent++;
      });

      results.push({
        name: "KYC Status Consistency",
        status: kycInconsistent === 0 ? "pass" : "warning",
        expected: "0 inconsistencies",
        actual: `${kycInconsistent} inconsistencies`,
        message: kycInconsistent === 0 
          ? "All KYC statuses are consistent with verification flags"
          : `${kycInconsistent} profiles have mismatched KYC status and verification flag`,
      });

      // Check 3: Trades with released escrow should be completed/cancelled
      const { data: releasedNotDone } = await supabase
        .from("trades")
        .select("id")
        .eq("escrow_released", true)
        .not("status", "in", '("completed","cancelled")');

      results.push({
        name: "Escrow Release Status",
        status: (releasedNotDone?.length || 0) === 0 ? "pass" : "error",
        expected: "0 trades",
        actual: `${releasedNotDone?.length || 0} trades`,
        message: (releasedNotDone?.length || 0) === 0
          ? "All released escrows have proper final status"
          : `${releasedNotDone?.length} trades have released escrow but aren't completed/cancelled`,
      });

      // Check 4: Platform fee wallet balances
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

        results.push({
          name: `${crypto} Fee Wallet Balance`,
          status: Math.abs(walletBalance - ledgerTotal) < 0.00000001 ? "pass" : "warning",
          expected: ledgerTotal.toFixed(8),
          actual: walletBalance.toFixed(8),
          message: "Fee wallet should equal sum of collected fees in ledger",
        });
      });

    } catch (error) {
      console.error("Error running consistency checks:", error);
      results.push({
        name: "System Check",
        status: "error",
        expected: "All checks pass",
        actual: "Check failed",
        message: "Error running consistency checks. See console for details.",
      });
    }

    setChecks(results);
    setLastChecked(new Date());
    setLoading(false);
  };

  useEffect(() => {
    runConsistencyChecks();
  }, []);

  const passCount = checks.filter(c => c.status === "pass").length;
  const warningCount = checks.filter(c => c.status === "warning").length;
  const errorCount = checks.filter(c => c.status === "error").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5 text-primary" />
              Data Consistency
            </CardTitle>
            <CardDescription>
              Automated checks for financial data integrity
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
          {errorCount > 0 && (
            <Badge variant="destructive">
              {errorCount} Error
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
                check.status === "pass" ? "border-green-500/30 bg-green-500/5" :
                check.status === "warning" ? "border-yellow-500/30 bg-yellow-500/5" :
                "border-destructive/30 bg-destructive/5"
              }`}
            >
              <div className="flex items-start gap-3">
                {check.status === "pass" ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${
                    check.status === "warning" ? "text-yellow-500" : "text-destructive"
                  }`} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{check.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{check.message}</p>
                  {check.status !== "pass" && (
                    <div className="flex gap-4 mt-2 text-xs">
                      <span>Expected: <span className="font-mono">{check.expected}</span></span>
                      <span>Actual: <span className="font-mono">{check.actual}</span></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};