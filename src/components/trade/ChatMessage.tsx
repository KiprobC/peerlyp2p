import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";

interface ChatMessageProps {
  message: string;
  isOwn: boolean;
  senderName: string;
  avatarUrl?: string | null;
  timestamp: string;
  showAvatar: boolean;
}

export const ChatMessage = ({
  message,
  isOwn,
  senderName,
  avatarUrl,
  timestamp,
  showAvatar,
}: ChatMessageProps) => {
  return (
    <div className={cn("flex gap-1.5", isOwn ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn("w-8 shrink-0", !showAvatar && "invisible")}>
        {showAvatar && (
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold overflow-hidden",
              isOwn
                ? "bg-primary/20 text-primary"
                : "bg-secondary text-foreground"
            )}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              senderName.charAt(0).toUpperCase()
            )}
          </div>
        )}
      </div>

      {/* Message bubble - Telegram style */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 relative",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border border-border/50 rounded-bl-md shadow-[var(--shadow-card)]"
        )}
      >
        {!isOwn && showAvatar && (
          <p className="text-[11px] font-semibold text-primary mb-0.5">{senderName}</p>
        )}
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
          {message}
        </p>
        <div className={cn(
          "flex items-center justify-end gap-1 mt-0.5",
          isOwn ? "text-primary-foreground/50" : "text-muted-foreground"
        )}>
          <span className="text-[10px]">
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </span>
          {isOwn && <CheckCheck className="w-3 h-3" />}
        </div>
      </div>
    </div>
  );
};
