import { useState, useEffect, useRef } from "react";
import { Timer, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNotificationSound } from "@/hooks/useNotificationSound";

interface TradeTimerProps {
  expiresAt: string | null;
  tradeStatus: string;
  onExpired?: () => void;
}

export const TradeTimer = ({ expiresAt, tradeStatus, onExpired }: TradeTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const warningSoundPlayedRef = useRef(false);
  const { playNotificationSound } = useNotificationSound();

  useEffect(() => {
    if (!expiresAt) return;
    
    // Only show timer for pending/confirmed trades
    if (!["pending", "confirmed"].includes(tradeStatus)) {
      setTimeLeft(null);
      return;
    }

    // Reset warning flag when trade status changes
    warningSoundPlayedRef.current = false;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;
      
      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft(0);
        
        // Call the cancel_expired_trades function
        supabase.rpc('cancel_expired_trades').then(() => {
          onExpired?.();
        });
        
        return;
      }
      
      const secondsLeft = Math.floor(diff / 1000);
      setTimeLeft(secondsLeft);
      
      // Play warning sound when crossing under 60 seconds (only once)
      if (secondsLeft <= 60 && secondsLeft > 0 && !warningSoundPlayedRef.current) {
        warningSoundPlayedRef.current = true;
        playNotificationSound("timer");
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt, tradeStatus, onExpired, playNotificationSound]);

  // Don't show timer if trade is completed, cancelled, or no expiry
  if (!expiresAt || !["pending", "confirmed"].includes(tradeStatus)) {
    return null;
  }

  if (timeLeft === null) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  // Determine urgency level
  const isUrgent = timeLeft < 300; // Less than 5 minutes
  const isCritical = timeLeft < 60; // Less than 1 minute

  if (isExpired) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-500/15 border border-red-500/30">
        <AlertCircle className="w-4 h-4 text-red-500" />
        <span className="text-xs font-medium text-red-500">
          Payment window expired
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-colors",
      isCritical 
        ? "bg-red-500/15 border-red-500/30" 
        : isUrgent 
          ? "bg-orange-500/15 border-orange-500/30"
          : "bg-primary/10 border-primary/30"
    )}>
      <Timer className={cn(
        "w-4 h-4",
        isCritical 
          ? "text-red-500 animate-pulse" 
          : isUrgent 
            ? "text-orange-500"
            : "text-primary"
      )} />
      <span className={cn(
        "text-xs font-mono font-semibold",
        isCritical 
          ? "text-red-500" 
          : isUrgent 
            ? "text-orange-500"
            : "text-primary"
      )}>
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </span>
      <span className={cn(
        "text-xs",
        isCritical 
          ? "text-red-400" 
          : isUrgent 
            ? "text-orange-400"
            : "text-muted-foreground"
      )}>
        to pay
      </span>
    </div>
  );
};
