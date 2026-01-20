import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

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
    <div className={cn("flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn("w-7 shrink-0", !showAvatar && "invisible")}>
        {showAvatar && (
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold overflow-hidden",
              isOwn
                ? "bg-primary text-primary-foreground"
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

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 shadow-sm",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border rounded-bl-sm"
        )}
      >
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
          {message}
        </p>
        <p
          className={cn(
            "text-[9px] mt-1",
            isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
          )}
        >
          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
};
