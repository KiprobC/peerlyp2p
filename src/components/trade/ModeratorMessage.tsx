import { Shield, Scale, Info, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ModeratorMessageProps {
  message: string;
  senderName: string;
  avatarUrl?: string | null;
  timestamp: string;
  isResolution?: boolean;
}

const getMessageConfig = (message: string, isResolution: boolean) => {
  const lowerMessage = message.toLowerCase();
  
  if (isResolution || lowerMessage.includes("resolved") || lowerMessage.includes("decision")) {
    return {
      icon: Scale,
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/30",
      iconColor: "text-purple-500",
      labelColor: "text-purple-500",
      label: "Resolution",
    };
  }
  
  if (lowerMessage.includes("request") || lowerMessage.includes("provide") || lowerMessage.includes("need")) {
    return {
      icon: AlertTriangle,
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      iconColor: "text-amber-500",
      labelColor: "text-amber-500",
      label: "Action Required",
    };
  }
  
  if (lowerMessage.includes("assigned") || lowerMessage.includes("reviewing")) {
    return {
      icon: Shield,
      bgColor: "bg-primary/10",
      borderColor: "border-primary/30",
      iconColor: "text-primary",
      labelColor: "text-primary",
      label: "Moderator",
    };
  }
  
  return {
    icon: Info,
    bgColor: "bg-secondary",
    borderColor: "border-border",
    iconColor: "text-muted-foreground",
    labelColor: "text-muted-foreground",
    label: "Moderator",
  };
};

export const ModeratorMessage = ({
  message,
  senderName,
  avatarUrl,
  timestamp,
  isResolution = false,
}: ModeratorMessageProps) => {
  const config = getMessageConfig(message, isResolution);
  const Icon = config.icon;

  return (
    <div className="flex justify-center py-2">
      <div
        className={cn(
          "max-w-[90%] rounded-lg border px-4 py-3",
          config.bgColor,
          config.borderColor
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className={cn("p-1 rounded", config.bgColor)}>
            <Icon className={cn("w-3.5 h-3.5", config.iconColor)} />
          </div>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", config.labelColor)}>
            {config.label}
          </span>
          <span className="text-[10px] text-muted-foreground">•</span>
          <span className="text-[10px] text-muted-foreground">{senderName}</span>
        </div>

        {/* Message */}
        <p className="text-sm leading-relaxed">{message}</p>

        {/* Timestamp */}
        <p className="text-[10px] text-muted-foreground mt-2">
          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
};
