import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Beaker, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const AdminDevTools = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState("10");
  const [targetUserId, setTargetUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleSimulateDeposit = async () => {
    const userId = targetUserId.trim() || user?.id;
    if (!userId) {
      toast.error("No user ID specified");
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid positive amount");
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("simulate-deposit", {
        body: { user_id: userId, amount: numAmount },
      });

      if (error) throw error;

      setLastResult(data);
      toast.success(`Simulated ${numAmount} USDT deposit successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to simulate deposit");
      setLastResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Beaker className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Dev Tools</h1>
          <p className="text-muted-foreground">Development-only testing utilities</p>
        </div>
        <Badge variant="outline" className="ml-auto border-accent text-accent">
          <AlertTriangle className="h-3 w-3 mr-1" />
          DEV ONLY
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Simulate USDT Deposit
          </CardTitle>
          <CardDescription>
            Creates a fake blockchain deposit using the same logic as the webhook. 
            Balance and transaction history update instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">User ID</label>
              <Input
                placeholder={user?.id || "Target user UUID"}
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to deposit to your own wallet
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (USDT)</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleSimulateDeposit}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Simulate Deposit"
            )}
          </Button>

          {lastResult && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
              {lastResult.error ? (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">{lastResult.error}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Deposit simulated</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono space-y-1">
                    <p>TX Hash: {lastResult.tx_hash}</p>
                    <p>Amount: {lastResult.amount} {lastResult.crypto_type}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDevTools;
