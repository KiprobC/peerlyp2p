import { Wallet } from "@/hooks/useWallets";
import { cryptoInfo } from "@/hooks/useWallets";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface WalletSummaryProps {
  wallets: Wallet[];
}

const cryptoPrices: Record<string, number> = {
  BTC: 8250000,
  USDT: 152,
  ETH: 425000,
};

export const WalletSummary = ({ wallets }: WalletSummaryProps) => {
  const totalValueKES = wallets.reduce((total, wallet) => {
    const price = cryptoPrices[wallet.crypto_type] || 0;
    return total + wallet.balance * price;
  }, 0);

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Wallet Summary</h3>
        <Link 
          to="/dashboard" 
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="mb-4">
        <p className="text-sm text-muted-foreground">Total Balance</p>
        <p className="text-2xl font-bold">KES {totalValueKES.toLocaleString()}</p>
      </div>

      <div className="space-y-3">
        {wallets.map((wallet) => {
          const info = cryptoInfo[wallet.crypto_type] || { name: wallet.crypto_type, icon: "?", color: "#888" };
          const valueKES = wallet.balance * (cryptoPrices[wallet.crypto_type] || 0);
          
          return (
            <div
              key={wallet.id}
              className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: `${info.color}20`, color: info.color }}
                >
                  {info.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{wallet.crypto_type}</p>
                  <p className="text-xs text-muted-foreground">{info.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-sm">
                  {wallet.balance.toFixed(wallet.crypto_type === "USDT" ? 2 : 6)}
                </p>
                <p className="text-xs text-muted-foreground">
                  KES {valueKES.toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
