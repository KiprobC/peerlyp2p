import { cn } from "@/lib/utils";
import peerlyIcon from "@/assets/peerly-icon.png";

interface DashboardSkeletonProps {
  className?: string;
}

export const DashboardSkeleton = ({ className }: DashboardSkeletonProps) => (
  <div className={cn("min-h-screen bg-background", className)}>
    {/* Nav skeleton */}
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2">
            <img src={peerlyIcon} alt="" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg opacity-40" />
            <div className="h-5 w-16 rounded bg-muted-foreground/10 shimmer-skeleton" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-muted-foreground/10 shimmer-skeleton" />
            <div className="h-9 w-9 rounded-full bg-muted-foreground/10 shimmer-skeleton" />
          </div>
        </div>
      </div>
    </nav>

    <main className="pt-20 sm:pt-24 pb-16">
      <div className="container mx-auto px-4 space-y-6">
        {/* Welcome */}
        <div className="space-y-2">
          <div className="h-7 w-52 rounded bg-muted-foreground/10 shimmer-skeleton" />
          <div className="h-4 w-32 rounded bg-muted-foreground/10 shimmer-skeleton" />
        </div>

        {/* Portfolio card */}
        <div className="glass-card p-5 space-y-4 shimmer-skeleton">
          <div className="space-y-1">
            <div className="h-3 w-28 rounded bg-muted-foreground/10" />
            <div className="h-8 w-44 rounded bg-muted-foreground/10" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-8 w-20 rounded-lg bg-muted-foreground/10" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 rounded-lg bg-muted-foreground/10" />
            ))}
          </div>
        </div>

        {/* Stats + Trades grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-5 space-y-4 shimmer-skeleton">
            <div className="h-5 w-24 rounded bg-muted-foreground/10" />
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex justify-between">
                <div className="h-4 w-24 rounded bg-muted-foreground/10" />
                <div className="h-4 w-8 rounded bg-muted-foreground/10" />
              </div>
            ))}
          </div>
          <div className="glass-card lg:col-span-2 p-5 space-y-3 shimmer-skeleton">
            <div className="h-5 w-28 rounded bg-muted-foreground/10" />
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-14 rounded-lg bg-muted-foreground/10" />
            ))}
          </div>
        </div>
      </div>
    </main>
  </div>
);
