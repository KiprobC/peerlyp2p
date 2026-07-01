import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Copy, CheckCircle, AlertTriangle, Wallet, Loader2, Send } from "lucide-react";
import { cryptoInfo } from "@/hooks/useWallets";
import { useActiveDepositAddress, submitDepositRequest, useMyTreasuryRequests } from "@/hooks/useManualTreasury";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { ConnectivityIndicator } from "@/components/connectivity/ConnectivityIndicator";
import { Badge } from "@/components/ui/badge";

const NETWORKS: Record<string, { value: string; label: string }[]> = {
  BTC: [{ value: "bitcoin", label: "Bitcoin Network" }],
  ETH: [{ value: "ethereum", label: "Ethereum (ERC-20)" }],
  USDT: [
    { value: "tron", label: "Tron (TRC-20)" },
    { value: "ethereum", label: "Ethereum (ERC-20)" },
  ],
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge className={map[s] || ""} variant="outline">{s}</Badge>;
};

const WalletDeposit = () => {
  const [selectedCrypto, setSelectedCrypto] = useState("BTC");
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS.BTC[0].value);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const { address, loading: addrLoading } = useActiveDepositAddress(selectedCrypto, selectedNetwork);
  const { deposits, refetch } = useMyTreasuryRequests();
  const selectedInfo = cryptoInfo[selectedCrypto];
  const networks = NETWORKS[selectedCrypto] || [];
  const parsed = parseFloat(amount) || 0;
  const canSubmit = !!address && parsed > 0 && parsed >= (address?.min_deposit || 0);

  const onCryptoChange = (c: string) => {
    setSelectedCrypto(c);
    setSelectedNetwork((NETWORKS[c] || [])[0]?.value || "");
  };

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await submitDepositRequest({
        crypto: selectedCrypto,
        network: selectedNetwork,
        amount: parsed,
        txHash: txHash.trim() || undefined,
      });
      toast.success("Deposit submitted", { description: "Admins have been notified. You'll be credited after verification." });
      setAmount("");
      setTxHash("");
      setConfirmOpen(false);
      refetch();
    } catch (e: any) {
      toast.error("Submit failed", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16">
            <Link to="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
            <h1 className="text-lg font-semibold ml-2">Deposit Crypto</h1>
            <div className="ml-auto"><ConnectivityIndicator /></div>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-24 md:pb-16">
        <div className="container mx-auto px-4 max-w-lg space-y-6">
          <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <Wallet className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Manual deposit — admin verified</p>
              <p className="text-xs text-muted-foreground mt-1">
                Send funds to the address shown, then click "I've Sent Funds". Admins will verify and credit your wallet.
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Asset & Network</CardTitle>
              <CardDescription>Select what you're sending</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Asset</Label>
                  <Select value={selectedCrypto} onValueChange={onCryptoChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(cryptoInfo).map(([c, i]) => (
                        <SelectItem key={c} value={c}>
                          <span className="font-medium">{c}</span> — <span className="text-muted-foreground">{i.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Network</Label>
                  <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {networks.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg" style={{ color: selectedInfo.color }}>
                Send {selectedCrypto} to this address
              </CardTitle>
              <CardDescription>Admin-controlled receiving wallet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {addrLoading ? (
                <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : !address ? (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-600">
                  No active deposit address configured for {selectedCrypto} on {selectedNetwork}. Please contact support.
                </div>
              ) : (
                <>
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <QRCodeSVG value={address.address} size={160} level="H" includeMargin />
                  </div>
                  <div className="space-y-2">
                    <Label>Deposit Address</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={address.address} className="font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => copy(address.address)}>
                        {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  {address.memo && (
                    <div className="space-y-2">
                      <Label>
                        Memo / Reference {address.memo_required && <span className="text-destructive">(required)</span>}
                      </Label>
                      <div className="flex gap-2">
                        <Input readOnly value={address.memo} className="font-mono text-xs" />
                        <Button variant="outline" size="icon" onClick={() => copy(address.memo!)}><Copy className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-sm p-3 rounded-lg bg-secondary/50">
                    <div><p className="text-muted-foreground text-xs">Minimum</p><p className="font-semibold">{address.min_deposit} {selectedCrypto}</p></div>
                    <div><p className="text-muted-foreground text-xs">Network</p><p className="font-semibold">{selectedNetwork}</p></div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <span>Only send <b>{selectedCrypto}</b> on <b>{selectedNetwork}</b>. Wrong network = permanent loss.</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Confirm your deposit</CardTitle>
              <CardDescription>Tell us how much you sent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Amount Sent ({selectedCrypto})</Label>
                <Input type="number" step="any" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div>
                <Label>Transaction Hash <span className="text-muted-foreground text-xs">(optional, speeds verification)</span></Label>
                <Input placeholder="0x…" value={txHash} onChange={e => setTxHash(e.target.value)} className="font-mono text-xs" />
              </div>
              <Button className="w-full" disabled={!canSubmit || submitting} onClick={() => setConfirmOpen(true)}>
                <Send className="w-4 h-4 mr-2" /> I've Sent Funds
              </Button>
            </CardContent>
          </Card>

          {deposits.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Recent Deposit Requests</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {deposits.slice(0, 5).map(d => (
                  <div key={d.id} className="flex justify-between items-center p-2 rounded-md bg-secondary/40 text-sm">
                    <div>
                      <p className="font-medium">{d.amount} {d.crypto_type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
                    </div>
                    {statusBadge(d.status)}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm deposit submission</AlertDialogTitle>
            <AlertDialogDescription>
              You're telling us you sent <b>{parsed} {selectedCrypto}</b> on <b>{selectedNetwork}</b>. Admins will verify on-chain before crediting. Submitting false claims may result in account restrictions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WalletDeposit;
