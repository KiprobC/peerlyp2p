import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, AlertTriangle, Loader2, Wallet, ExternalLink, Mail, Shield } from "lucide-react";
import { useWallets, cryptoInfo } from "@/hooks/useWallets";
import { usePlatformFees } from "@/hooks/usePlatformFees";
import { useMFA } from "@/hooks/useMFA";
import { OTPVerificationDialog } from "@/components/security/OTPVerificationDialog";
import { PasskeyVerifyDialog } from "@/components/security/PasskeyVerifyDialog";
import { usePasskeys } from "@/hooks/usePasskeys";
import { toast } from "sonner";
import { useConnectivity } from "@/hooks/useConnectivity";
import { ConnectivityIndicator } from "@/components/connectivity/ConnectivityIndicator";

const WalletWithdraw = () => {
  const navigate = useNavigate();
  const { wallets, loading } = useWallets();
  const { calculateFee } = usePlatformFees();
  const { isEnabled: mfaEnabled } = useMFA();
  const [selectedCrypto, setSelectedCrypto] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOTPVerify, setShowOTPVerify] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);
  const { passkeys } = usePasskeys();
  const { status: connectivityStatus } = useConnectivity();
  const connectivityBlocked = connectivityStatus !== "online";

  const selectedInfo = cryptoInfo[selectedCrypto];
  const selectedWallet = wallets.find(w => w.crypto_type === selectedCrypto);
  const availableBalance = selectedWallet 
    ? selectedWallet.balance - selectedWallet.locked_balance 
    : 0;

  const parsedAmount = parseFloat(amount) || 0;
  const fee = calculateFee("withdrawal", parsedAmount);
  const totalDeduction = parsedAmount + fee;
  const isValidAmount = parsedAmount > 0 && totalDeduction <= availableBalance;
  const isValidAddress = address.length > 20;

  const handleWithdrawClick = () => {
    if (!isValidAmount || !isValidAddress) return;
    if (connectivityBlocked) {
      toast.error("Connection unstable", {
        description: "Withdrawals are paused until your connection is verified. Try again shortly.",
      });
      return;
    }
    if (passkeys.length > 0) {
      setShowPasskey(true);
    } else {
      setShowOTPVerify(true);
    }
  };

  const executeWithdraw = async () => {
    setIsSubmitting(true);
    
    // Simulate withdrawal processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast.success("Withdrawal request submitted", {
      description: `${parsedAmount} ${selectedCrypto} will be sent to your address after processing.`
    });
    
    setIsSubmitting(false);
    navigate("/dashboard");
  };

  const handleOTPVerified = () => {
    setShowOTPVerify(false);
    executeWithdraw();
  };

  const handleMaxAmount = () => {
    if (availableBalance > 0) {
      // Calculate max amount accounting for fee
      const maxWithFee = availableBalance / (1 + (calculateFee("withdrawal", 1) / 1));
      setAmount(maxWithFee.toFixed(selectedCrypto === "USDT" ? 2 : 6));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold ml-2">Withdraw Crypto</h1>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-24 md:pb-16">
        <div className="container mx-auto px-4 max-w-lg space-y-6">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <Wallet className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Withdraw to external wallet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Send crypto from your Peerly wallet to any external address.
              </p>
            </div>
          </div>

          {/* Crypto Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Cryptocurrency</CardTitle>
              <CardDescription>Choose which crypto you want to withdraw</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
                <SelectTrigger className="h-14">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(cryptoInfo).map(([crypto, info]) => (
                    <SelectItem key={crypto} value={crypto}>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                          style={{ backgroundColor: `${info.color}20`, color: info.color }}
                        >
                          {info.icon}
                        </div>
                        <div>
                          <p className="font-medium">{crypto}</p>
                          <p className="text-xs text-muted-foreground">{info.name}</p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedWallet && (
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Available Balance</p>
                      <p className="text-xl font-bold">
                        {availableBalance.toFixed(selectedCrypto === "USDT" ? 2 : 6)} {selectedCrypto}
                      </p>
                    </div>
                    {selectedWallet.locked_balance > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Locked in escrow</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedWallet.locked_balance.toFixed(selectedCrypto === "USDT" ? 2 : 6)} {selectedCrypto}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Withdrawal Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Withdrawal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Destination Address */}
              <div className="space-y-2">
                <Label>Destination Address</Label>
                <Input 
                  placeholder={`Enter ${selectedCrypto} wallet address`}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Amount ({selectedCrypto})</Label>
                  <button 
                    type="button"
                    onClick={handleMaxAmount}
                    className="text-xs text-primary hover:underline"
                  >
                    MAX
                  </button>
                </div>
                <Input 
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              {/* Fee Breakdown */}
              {parsedAmount > 0 && (
                <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span>{parsedAmount.toFixed(selectedCrypto === "USDT" ? 2 : 6)} {selectedCrypto}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Network Fee</span>
                    <span>{fee.toFixed(selectedCrypto === "USDT" ? 2 : 6)} {selectedCrypto}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-medium">
                    <span>Total Deduction</span>
                    <span>{totalDeduction.toFixed(selectedCrypto === "USDT" ? 2 : 6)} {selectedCrypto}</span>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {parsedAmount > 0 && totalDeduction > availableBalance && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">
                    Insufficient balance. You need {(totalDeduction - availableBalance).toFixed(6)} more {selectedCrypto}.
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">Double-check your address</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Cryptocurrency transactions are irreversible. Ensure the address is correct.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-primary">Security verification required</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    You'll receive a verification code to confirm this withdrawal.
                    {mfaEnabled && " Your authenticator app will also be required."}
                  </p>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={handleWithdrawClick}
                disabled={!isValidAmount || !isValidAddress || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Withdraw {selectedCrypto}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <p className="text-xs text-center text-muted-foreground">
            Withdrawals are processed within 1-24 hours after security verification.
          </p>
        </div>
      </main>

      {/* OTP Verification Dialog - with optional MFA */}
      <OTPVerificationDialog
        open={showOTPVerify}
        onOpenChange={setShowOTPVerify}
        onVerified={handleOTPVerified}
        actionType="crypto_withdraw"
        title="Verify Withdrawal"
        description={`Confirm withdrawal of ${parsedAmount} ${selectedCrypto} to external wallet`}
        actionLabel="Confirm Withdrawal"
        requireMFA={mfaEnabled}
      />

      <PasskeyVerifyDialog
        open={showPasskey}
        onOpenChange={setShowPasskey}
        onVerified={executeWithdraw}
        onFallback={() => setShowOTPVerify(true)}
        title="Authorize withdrawal"
        description={`Use fingerprint or face to confirm sending ${parsedAmount} ${selectedCrypto}`}
      />
    </div>
  );
};

export default WalletWithdraw;
