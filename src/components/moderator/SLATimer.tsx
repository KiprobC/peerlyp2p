import { useState, useEffect } from "react";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SLATimerProps {
  slaDeadline: string | null;
  firstResponseAt: string | null;
  slaBreached: boolean;
  escalated: boolean;
  compact?: boolean;
}

export const SLATimer = ({
  slaDeadline,
  firstResponseAt,
  slaBreached,
  escalated,
  compact = false,
}: SLATimerProps) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!slaDeadline || firstResponseAt) return;

    const update = () => {
      const remaining = new Date(slaDeadline).getTime() - Date.now();
      setTimeLeft(Math.max(0, remaining));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [slaDeadline, firstResponseAt]);

  if (firstResponseAt) {
    if (compact) {
      return (
        <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30 gap-1">
          <CheckCircle className="w-2.5 h-2.5" />
          Responded
        </Badge>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>Moderator responded</span>
      </div>
    );
  }

  if (slaBreached || escalated) {
    if (compact) {
      return (
        <Badge variant="destructive" className="text-[10px] gap-1">
          <AlertTriangle className="w-2.5 h-2.5" />
          {escalated ? "Escalated" : "SLA Breached"}
        </Badge>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>{escalated ? "Escalated to new moderator" : "SLA breached — escalating"}</span>
      </div>
    );
  }

  if (!slaDeadline) return null;

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const isUrgent = timeLeft < 5 * 60 * 1000; // 5 min
  const isBreached = timeLeft <= 0;

  const color = isBreached
    ? "text-destructive"
    : isUrgent
    ? "text-amber-500"
    : "text-green-600";

  const bgColor = isBreached
    ? "bg-destructive/10 border-destructive/30"
    : isUrgent
    ? "bg-amber-500/10 border-amber-500/30"
    : "bg-green-500/10 border-green-500/30";

  if (compact) {
    return (
      <Badge variant="outline" className={cn("text-[10px] gap-1", bgColor, color)}>
        <Clock className="w-2.5 h-2.5" />
        {minutes}:{seconds.toString().padStart(2, "0")}
      </Badge>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", color)}>
      <Clock className="w-3.5 h-3.5" />
      <span>
        Response expected in {minutes}m {seconds.toString().padStart(2, "0")}s
      </span>
    </div>
  );
};
