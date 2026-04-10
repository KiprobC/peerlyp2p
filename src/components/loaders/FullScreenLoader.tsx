import { cn } from "@/lib/utils";
import { PeerlyLottieLoader } from "./PeerlyLottieLoader";

interface FullScreenLoaderProps {
  text?: string;
  className?: string;
}

export const FullScreenLoader = ({ text, className }: FullScreenLoaderProps) => (
  <div
    className={cn(
      "fixed inset-0 z-[100] bg-background flex items-center justify-center animate-fade-in",
      className
    )}
  >
    <PeerlyLottieLoader size="lg" text={text} />
  </div>
);
