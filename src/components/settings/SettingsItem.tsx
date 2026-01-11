import { ChevronRight, LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface SettingsItemProps {
  icon: LucideIcon;
  iconColor?: string;
  label: string;
  subtitle?: string;
  onClick?: () => void;
  rightElement?: React.ReactNode;
  toggle?: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  };
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

export const SettingsItem = ({
  icon: Icon,
  iconColor,
  label,
  subtitle,
  onClick,
  rightElement,
  toggle,
  chevron = true,
  destructive = false,
  disabled = false,
}: SettingsItemProps) => {
  const isClickable = onClick && !toggle;
  
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3.5 transition-colors",
        isClickable && "cursor-pointer active:bg-muted/50 hover:bg-muted/30",
        destructive && "text-destructive",
        disabled && "opacity-50 pointer-events-none"
      )}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? "button" : undefined}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          destructive ? "bg-destructive/10" : "bg-muted"
        )}
        style={iconColor && !destructive ? { backgroundColor: `${iconColor}15` } : undefined}
      >
        <Icon 
          className="w-4.5 h-4.5" 
          style={iconColor && !destructive ? { color: iconColor } : undefined}
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[15px] font-medium leading-tight",
          destructive && "text-destructive"
        )}>
          {label}
        </p>
        {subtitle && (
          <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
      
      {toggle && (
        <Switch
          checked={toggle.checked}
          onCheckedChange={toggle.onCheckedChange}
          className="shrink-0"
        />
      )}
      
      {rightElement && (
        <div className="shrink-0 text-sm text-muted-foreground">
          {rightElement}
        </div>
      )}
      
      {chevron && !toggle && !rightElement && (
        <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
      )}
    </div>
  );
};

export const SettingsSection = ({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="mb-6">
      {title && (
        <p className="px-4 py-2 text-[13px] font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
      )}
      <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  );
};
