import { cryptoInfo } from "@/hooks/useWallets";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useSettings } from "@/hooks/useSettings";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import type { DisplayCurrency } from "@/hooks/usePortfolio";

/**
 * Wallet summary card for the Profile page.
 * Reads from the SAME `usePortfolio` hook the Dashboard uses so the totals,
 * per-asset values and price basis are identical everywhere.
 */
export const WalletSummary = () => {
  const { settings } = useSettings();
  const currency = (settings?.preferred_currency || "KES") as DisplayCurrency;
  const portfolio = usePortfolio(currency);

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
        {portfolio.loading ? (
          <div className="flex items-center gap-2 text-muted-foreground h-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <p className="text-2xl font-bold">
            {portfolio.currencySymbol}
            {portfolio.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {portfolio.assets.map((asset) => {
          const info = cryptoInfo[asset.crypto_type] || { name: asset.crypto_type, icon: "?", color: "#888" };
          return (
            <div
              key={asset.crypto_type}
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
                  <p className="font-medium text-sm">{asset.crypto_type}</p>
                  <p className="text-xs text-muted-foreground">{info.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-sm">
                  {asset.balance.toFixed(asset.crypto_type === "USDT" ? 2 : 6)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {portfolio.currencySymbol}
                  {asset.valueInCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
