import { Shield, Scale, Info, AlertTriangle, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ModeratorMessageProps {
  message: string;
  timestamp: string;
  isResolution?: boolean;
}

const getMessageConfig = (message: string, isResolution: boolean) => {
  const lowerMessage = message.toLowerCase();
  
  // Resolution messages - purple/violet theme
  if (isResolution || lowerMessage.includes("resolved") || lowerMessage.includes("decision") || lowerMessage.includes("🏛️")) {
    return {
      icon: Scale,
      bgColor: "bg-violet-500/15",
      borderColor: "border-violet-500/40",
      iconColor: "text-violet-500",
      labelColor: "text-violet-500",
      headerBg: "bg-violet-500/20",
      label: "Resolution",
    };
  }
  
  // Request for information - amber theme
  if (lowerMessage.includes("request") || lowerMessage.includes("provide") || lowerMessage.includes("need") || lowerMessage.includes("[moderator request]")) {
    return {
      icon: AlertTriangle,
      bgColor: "bg-amber-500/15",
      borderColor: "border-amber-500/40",
      iconColor: "text-amber-500",
      labelColor: "text-amber-500",
      headerBg: "bg-amber-500/20",
      label: "Action Required",
    };
  }
  
  // Assignment/review messages - primary/blue theme
  if (lowerMessage.includes("assigned") || lowerMessage.includes("reviewing") || lowerMessage.includes("dispute has been opened")) {
    return {
      icon: Shield,
      bgColor: "bg-primary/15",
      borderColor: "border-primary/40",
      iconColor: "text-primary",
      labelColor: "text-primary",
      headerBg: "bg-primary/20",
      label: "Moderator Assigned",
    };
  }
  
  // General moderator message - violet theme (distinct from user messages)
  if (lowerMessage.includes("[moderator]")) {
    return {
      icon: MessageSquare,
      bgColor: "bg-violet-500/15",
      borderColor: "border-violet-500/40",
      iconColor: "text-violet-500",
      labelColor: "text-violet-500",
      headerBg: "bg-violet-500/20",
      label: "Official Message",
    };
  }
  
  // Default moderator style
  return {
    icon: Info,
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
    iconColor: "text-violet-500",
    labelColor: "text-violet-500",
    headerBg: "bg-violet-500/15",
    label: "Moderator",
  };
};

// Strip prefixes like [MODERATOR] or [MODERATOR REQUEST] from display
const cleanMessage = (message: string): string => {
  return message
    .replace(/^\[MODERATOR REQUEST\]\s*/i, "")
    .replace(/^\[MODERATOR\]\s*/i, "")
    .replace(/^🏛️\s*DISPUTE RESOLVED:\s*/i, "");
};

export const ModeratorMessage = ({
  message,
  timestamp,
  isResolution = false,
}: ModeratorMessageProps) => {
  const config = getMessageConfig(message, isResolution);
  const Icon = config.icon;
  const displayMessage = cleanMessage(message);

  return (
    <div className="flex justify-center py-3">
      <div
        className={cn(
          "max-w-[95%] sm:max-w-[85%] rounded-xl border-2 overflow-hidden shadow-sm",
          config.bgColor,
          config.borderColor
        )}
      >
        {/* Header with icon and label */}
        <div className={cn("flex items-center gap-2 px-4 py-2", config.headerBg)}>
          <div className={cn("p-1.5 rounded-full", config.bgColor)}>
            <Icon className={cn("w-4 h-4", config.iconColor)} />
          </div>
          <span className={cn("text-xs font-bold uppercase tracking-wider", config.labelColor)}>
            {config.label}
          </span>
        </div>

        {/* Message body */}
        <div className="px-4 py-3">
          <p className="text-sm leading-relaxed font-medium">{displayMessage}</p>
        </div>

        {/* Footer with timestamp - moderator identity hidden for fairness */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-border/50 bg-background/30">
          <Avatar className="w-5 h-5">
            <AvatarFallback className="text-[10px] bg-violet-500/20 text-violet-600">
              M
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">Moderator</span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
};
