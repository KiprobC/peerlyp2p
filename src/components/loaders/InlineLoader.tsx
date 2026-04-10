import { cn } from "@/lib/utils";
import { PeerlyLogoLoader } from "./PeerlyLogoLoader";

interface InlineLoaderProps {
  text?: string;
  className?: string;
  size?: "sm" | "md";
}

export const InlineLoader = ({ text, className, size = "sm" }: InlineLoaderProps) => (
  <div className={cn("flex flex-col items-center justify-center py-8 gap-3 animate-fade-in", className)}>
    <PeerlyLogoLoader size={size} />
    {text && (
      <p className="text-sm text-muted-foreground font-medium animate-pulse">{text}</p>
    )}
  </div>
);
