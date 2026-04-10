import { cn } from "@/lib/utils";

interface PeerlyLogoLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showTagline?: boolean;
}

const sizeMap = {
  sm: { svg: 40, text: "text-xs" },
  md: { svg: 64, text: "text-sm" },
  lg: { svg: 96, text: "text-base" },
};

export const PeerlyLogoLoader = ({ size = "md", className, showTagline = false }: PeerlyLogoLoaderProps) => {
  const { svg: svgSize, text } = sizeMap[size];

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative peerly-logo-glow">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 100 100"
          className="peerly-svg-loader"
          aria-label="Loading"
        >
          {/* Outer ring */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            className="stroke-primary/20"
            strokeWidth="3"
          />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            className="stroke-primary peerly-draw-ring"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* P letterform */}
          <g className="peerly-draw-letter">
            <path
              d="M38 28 L38 72 M38 28 L58 28 C68 28 72 34 72 42 C72 50 68 56 58 56 L38 56"
              fill="none"
              className="stroke-primary"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Dot accent */}
          <circle
            cx="74"
            cy="68"
            r="4"
            className="fill-primary peerly-dot-pulse"
          />
        </svg>
      </div>

      {showTagline && (
        <p className={cn("text-muted-foreground animate-pulse-slow font-medium", text)}>
          Secure P2P Trading
        </p>
      )}
    </div>
  );
};
