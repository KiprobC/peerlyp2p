import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Copy, CheckCircle, AlertTriangle, QrCode, Wallet } from "lucide-react";
import { useWallets, cryptoInfo } from "@/hooks/useWallets";
import { toast } from "sonner";

// Mock deposit addresses - in production, these would be generated per user
const DEPOSIT_ADDRESSES: Record<string, string> = {
  BTC: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  ETH: "0x742d35Cc6634C0532925a3b844Bc9e7595f2f234",
  USDT: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9",
};

const WalletDeposit = () => {
  const { wallets, loading } = useWallets();
  const [selectedCrypto, setSelectedCrypto] = useState("BTC");
  const [copied, setCopied] = useState(false);

  const depositAddress = DEPOSIT_ADDRESSES[selectedCrypto];
  const selectedInfo = cryptoInfo[selectedCrypto];
  const selectedWallet = wallets.find(w => w.crypto_type === selectedCrypto);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    toast.success("Address copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
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
            <h1 className="text-lg font-semibold ml-2">Deposit Crypto</h1>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-24 md:pb-16">
        <div className="container mx-auto px-4 max-w-lg space-y-6">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <Wallet className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Deposit cryptocurrency to your Peerly wallet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Send crypto to the address below. Deposits are credited after network confirmations.
              </p>
            </div>
          </div>

          {/* Crypto Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Cryptocurrency</CardTitle>
              <CardDescription>Choose which crypto you want to deposit</CardDescription>
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
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-xl font-bold">
                    {selectedWallet.balance.toFixed(selectedCrypto === "USDT" ? 2 : 6)} {selectedCrypto}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deposit Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: `${selectedInfo.color}20`, color: selectedInfo.color }}
                >
                  {selectedInfo.icon}
                </div>
                {selectedCrypto} Deposit Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* QR Code Placeholder */}
              <div className="flex justify-center p-6 bg-white rounded-lg">
                <div className="w-40 h-40 bg-gray-100 rounded-lg flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-gray-400" />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label>Wallet Address</Label>
                <div className="flex gap-2">
                  <Input 
                    value={depositAddress} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleCopyAddress}
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Network Warning */}
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">Important</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Only send {selectedCrypto} to this address. Sending other cryptocurrencies may result in permanent loss of funds.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confirmation Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Network Confirmations</p>
                  <p className="text-lg font-semibold">
                    {selectedCrypto === "BTC" ? "3" : selectedCrypto === "ETH" ? "12" : "20"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Est. Time</p>
                  <p className="text-lg font-semibold">
                    {selectedCrypto === "BTC" ? "~30 min" : selectedCrypto === "ETH" ? "~5 min" : "~3 min"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-center text-muted-foreground">
            Minimum deposit: {selectedCrypto === "BTC" ? "0.0001" : selectedCrypto === "ETH" ? "0.001" : "1"} {selectedCrypto}
          </p>
        </div>
      </main>
    </div>
  );
};

export default WalletDeposit;
