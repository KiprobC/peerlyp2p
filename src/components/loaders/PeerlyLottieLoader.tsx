import { Suspense, lazy, useState } from "react";
import { cn } from "@/lib/utils";
import { PeerlyLogoLoader } from "./PeerlyLogoLoader";

const LottieComponent = lazy(() => import("lottie-react"));

interface PeerlyLottieLoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

const sizePx = { sm: 80, md: 140, lg: 220 };

export const PeerlyLottieLoader = ({ size = "md", text, className }: PeerlyLottieLoaderProps) => {
  const [lottieError, setLottieError] = useState(false);
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  // Lazy-fetch animation JSON
  if (!fetchAttempted) {
    setFetchAttempted(true);
    fetch("/animations/peerly-loader.json")
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setAnimationData)
      .catch(() => setLottieError(true));
  }

  const px = sizePx[size];

  // Fallback to SVG loader
  if (lottieError || !animationData) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
        <PeerlyLogoLoader size={size} />
        {text && (
          <p className="text-sm text-muted-foreground animate-pulse font-medium">{text}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <Suspense fallback={<PeerlyLogoLoader size={size} />}>
        <LottieComponent
          animationData={animationData}
          loop
          autoplay
          style={{ width: px, height: px }}
        />
      </Suspense>
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse font-medium">{text}</p>
      )}
    </div>
  );
};
