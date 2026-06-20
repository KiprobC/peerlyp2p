import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Copy, CheckCircle, AlertTriangle, Wallet, Loader2 } from "lucide-react";
import { useWallets, cryptoInfo } from "@/hooks/useWallets";
import { useDepositAddresses } from "@/hooks/useDepositAddresses";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectivityIndicator } from "@/components/connectivity/ConnectivityIndicator";

const NETWORK_INFO: Record<string, { name: string; confirmations: number; time: string }> = {
  BTC: { name: "Bitcoin Network", confirmations: 3, time: "~30 min" },
  ETH: { name: "Ethereum (ERC-20)", confirmations: 12, time: "~5 min" },
  USDT: { name: "Tron (TRC-20)", confirmations: 20, time: "~3 min" },
};

const MIN_DEPOSITS: Record<string, string> = {
  BTC: "0.0001",
  ETH: "0.001",
  USDT: "1",
};

const WalletDeposit = () => {
  const { wallets, loading: walletsLoading } = useWallets();
  const { addresses, loading: addressesLoading, getOrCreateAddress } = useDepositAddresses();
  const [selectedCrypto, setSelectedCrypto] = useState("BTC");
  const [copied, setCopied] = useState(false);
  const [generatingAddress, setGeneratingAddress] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);

  const selectedInfo = cryptoInfo[selectedCrypto];
  const selectedWallet = wallets.find(w => w.crypto_type === selectedCrypto);
  const networkInfo = NETWORK_INFO[selectedCrypto];
  const cachedAddress = addresses[selectedCrypto]?.address;

  // Load address when crypto changes
  useEffect(() => {
    const loadAddress = async () => {
      if (cachedAddress) {
        setCurrentAddress(cachedAddress);
        return;
      }

      setGeneratingAddress(true);
      const address = await getOrCreateAddress(selectedCrypto);
      setCurrentAddress(address);
      setGeneratingAddress(false);
    };

    loadAddress();
  }, [selectedCrypto, cachedAddress]);

  const handleCopyAddress = () => {
    if (!currentAddress) return;
    navigator.clipboard.writeText(currentAddress);
    setCopied(true);
    toast.success("Address copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const loading = walletsLoading || addressesLoading;

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
                Send crypto to your unique address below. Deposits are credited after network confirmations.
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

              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : selectedWallet && (
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
              <CardDescription>{networkInfo?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center p-6 bg-white rounded-lg">
                <div className="w-44 h-44 flex items-center justify-center">
                  {generatingAddress ? (
                    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                  ) : currentAddress ? (
                    <QRCodeSVG 
                      value={currentAddress}
                      size={160}
                      level="H"
                      includeMargin={true}
                      fgColor="#000000"
                      bgColor="#ffffff"
                    />
                  ) : (
                    <div className="w-40 h-40 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-gray-400 text-sm">No address</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label>Your Unique Wallet Address</Label>
                {generatingAddress ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <div className="flex gap-2">
                    <Input 
                      value={currentAddress || "Address not available"} 
                      readOnly 
                      className="font-mono text-xs"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={handleCopyAddress}
                      disabled={!currentAddress}
                    >
                      {copied ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Deposit Stats */}
              {addresses[selectedCrypto] && addresses[selectedCrypto].total_deposited > 0 && (
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Deposited to This Address</p>
                  <p className="text-lg font-semibold">
                    {addresses[selectedCrypto].total_deposited.toFixed(selectedCrypto === "USDT" ? 2 : 6)} {selectedCrypto}
                  </p>
                </div>
              )}

              {/* Network Warning */}
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">Important</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Only send {selectedCrypto} ({networkInfo?.name}) to this address. Sending other cryptocurrencies or using wrong networks may result in permanent loss of funds.
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
                  <p className="text-lg font-semibold">{networkInfo?.confirmations}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Est. Time</p>
                  <p className="text-lg font-semibold">{networkInfo?.time}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-center text-muted-foreground">
            Minimum deposit: {MIN_DEPOSITS[selectedCrypto]} {selectedCrypto}
          </p>
        </div>
      </main>
    </div>
  );
};

export default WalletDeposit;
