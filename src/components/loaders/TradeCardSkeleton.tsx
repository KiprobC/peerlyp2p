import { cn } from "@/lib/utils";

interface TradeCardSkeletonProps {
  count?: number;
  className?: string;
}

export const TradeCardSkeleton = ({ count = 3, className }: TradeCardSkeletonProps) => (
  <div className={cn("space-y-3", className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="glass-card p-3 sm:p-4 shimmer-skeleton"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-muted-foreground/10 shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="h-4 rounded-full bg-muted-foreground/10 w-32" />
              <div className="h-3 rounded-full bg-muted-foreground/10 w-48" />
            </div>
          </div>
          <div className="text-right shrink-0 space-y-2">
            <div className="h-5 w-16 rounded-full bg-muted-foreground/10 ml-auto" />
            <div className="h-3 w-12 rounded-full bg-muted-foreground/10 ml-auto" />
          </div>
        </div>
      </div>
    ))}
  </div>
);
