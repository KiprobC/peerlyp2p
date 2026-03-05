import { Lock, Shield, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface TradeLockBannerProps {
  escrowLocked: boolean;
  status: string;
  cryptoAmount: number;
  cryptoType: string;
  fiatAmount: number;
  fiatCurrency: string;
  paymentMethod: string;
}

export const TradeLockBanner = ({
  escrowLocked,
  status,
  cryptoAmount,
  cryptoType,
  fiatAmount,
  fiatCurrency,
  paymentMethod,
}: TradeLockBannerProps) => {
  // Show only for active trades (not pending, completed, or cancelled)
  if (!["confirmed", "payment_sent", "disputed"].includes(status)) return null;

  const locks = [
    {
      icon: Lock,
      label: "Price Locked",
      detail: `${fiatCurrency} ${fiatAmount.toLocaleString()} for ${cryptoAmount} ${cryptoType}`,
      active: true,
    },
    {
      icon: Shield,
      label: "Escrow Secured",
      detail: `${cryptoAmount} ${cryptoType} held in escrow`,
      active: escrowLocked,
    },
    {
      icon: FileCheck,
      label: "Terms Locked",
      detail: paymentMethod,
      active: true,
    },
  ];

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-primary/5 border-b border-primary/10 overflow-x-auto">
      {locks.map((lock) => (
        <div
          key={lock.label}
          className={cn(
            "flex items-center gap-1.5 text-[10px] font-medium whitespace-nowrap",
            lock.active ? "text-primary" : "text-muted-foreground"
          )}
        >
          <lock.icon className="w-3 h-3 shrink-0" />
          <span>{lock.label}</span>
        </div>
      ))}
    </div>
  );
};
