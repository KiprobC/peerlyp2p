import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
  className?: string;
}

const variantStyles = {
  default: "border-border",
  primary: "border-primary/30 bg-primary/5",
  success: "border-primary/30 bg-primary/5",
  warning: "border-accent/30 bg-accent/5",
  destructive: "border-destructive/30 bg-destructive/5",
};

const iconVariantStyles = {
  default: "bg-secondary text-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-primary/10 text-primary",
  warning: "bg-accent/10 text-accent",
  destructive: "bg-destructive/10 text-destructive",
};

export const StatsCard = ({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  variant = "default",
  className,
}: StatsCardProps) => {
  return (
    <div className={cn("glass-card border", variantStyles[variant], className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs mt-2 font-medium",
                trend.isPositive ? "text-primary" : "text-destructive"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {trend.value}
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", iconVariantStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};
