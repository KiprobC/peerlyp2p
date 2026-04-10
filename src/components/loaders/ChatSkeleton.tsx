import { cn } from "@/lib/utils";

interface ChatSkeletonProps {
  rows?: number;
  className?: string;
}

export const ChatSkeleton = ({ rows = 5, className }: ChatSkeletonProps) => {
  const bubbles = Array.from({ length: rows }, (_, i) => ({
    isRight: i % 3 !== 0,
    width: ["w-3/5", "w-2/5", "w-1/2", "w-3/4", "w-2/3"][i % 5],
  }));

  return (
    <div className={cn("space-y-4 p-4", className)}>
      {bubbles.map((b, i) => (
        <div key={i} className={cn("flex items-end gap-2", b.isRight && "justify-end")}>
          {!b.isRight && (
            <div className="w-8 h-8 rounded-full bg-muted shimmer-skeleton shrink-0" />
          )}
          <div
            className={cn(
              "rounded-2xl p-3 space-y-2 shimmer-skeleton",
              b.width,
              b.isRight
                ? "bg-primary/10 rounded-br-sm"
                : "bg-muted rounded-bl-sm"
            )}
          >
            <div className="h-3 rounded-full bg-muted-foreground/10 w-full" />
            {i % 2 === 0 && (
              <div className="h-3 rounded-full bg-muted-foreground/10 w-3/4" />
            )}
          </div>
          {b.isRight && (
            <div className="w-8 h-8 rounded-full bg-muted shimmer-skeleton shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
};
