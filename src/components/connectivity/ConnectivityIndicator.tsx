import { useConnectivity, type ConnectivityStatus } from "@/hooks/useConnectivity";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNowStrict } from "date-fns";

const dotClass: Record<ConnectivityStatus, string> = {
  online: "bg-green-500 shadow-[0_0_0_3px_hsl(var(--background))]",
  degraded: "bg-amber-400 shadow-[0_0_0_3px_hsl(var(--background))] animate-pulse",
  offline: "bg-red-500 shadow-[0_0_0_3px_hsl(var(--background))]",
};

const labelMap: Record<ConnectivityStatus, string> = {
  online: "Connected",
  degraded: "Unstable connection",
  offline: "No connection",
};

interface Props {
  /** Show a textual label next to the dot. */
  showLabel?: boolean;
  className?: string;
}

export const ConnectivityIndicator = ({ showLabel = false, className }: Props) => {
  const c = useConnectivity();

  const lastContact = c.lastSuccessAt
    ? `${formatDistanceToNowStrict(new Date(c.lastSuccessAt))} ago`
    : "never";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={labelMap[c.status]}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 hover:bg-muted/40 transition-colors",
            className
          )}
        >
          <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center">
            <span className={cn("h-2.5 w-2.5 rounded-full", dotClass[c.status])} />
            {c.checking && (
              <Loader2 className="absolute -right-3 h-2.5 w-2.5 animate-spin text-muted-foreground" />
            )}
          </span>
          {showLabel && (
            <span className="text-xs font-medium text-muted-foreground">{labelMap[c.status]}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 text-xs">
        <div className="flex items-center gap-2 mb-2">
          {c.status === "offline" ? (
            <WifiOff className="h-4 w-4 text-red-500" />
          ) : (
            <Wifi className={cn("h-4 w-4", c.status === "online" ? "text-green-500" : "text-amber-500")} />
          )}
          <span className="font-semibold text-sm">{labelMap[c.status]}</span>
        </div>
        <div className="space-y-1 text-muted-foreground">
          <div className="flex justify-between">
            <span>Last server contact</span>
            <span className="text-foreground font-medium">{lastContact}</span>
          </div>
          <div className="flex justify-between">
            <span>Last probe latency</span>
            <span className="text-foreground font-medium">
              {c.lastLatencyMs != null ? `${c.lastLatencyMs} ms` : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Failed probes</span>
            <span className="text-foreground font-medium">{c.failureCount}</span>
          </div>
          <div className="flex justify-between">
            <span>navigator.onLine</span>
            <span className="text-foreground font-medium">{String(c.navigatorOnline)}</span>
          </div>
        </div>
        {c.status !== "online" && (
          <p className="mt-2 text-[11px] text-amber-500">
            Sensitive actions like crypto release and withdrawals are temporarily disabled.
            Viewing your data is unaffected.
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full h-7 text-xs"
          onClick={() => c.refresh()}
          disabled={c.checking}
        >
          <RefreshCw className={cn("h-3 w-3 mr-1.5", c.checking && "animate-spin")} />
          Re-check now
        </Button>
      </PopoverContent>
    </Popover>
  );
};
