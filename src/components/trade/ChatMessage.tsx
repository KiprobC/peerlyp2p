import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, FileImage, File, Download } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ChatAttachment {
  fileName: string;
  fileUrl: string;
  fileType: string | null;
}

interface ChatMessageProps {
  message: string;
  isOwn: boolean;
  senderName: string;
  avatarUrl?: string | null;
  timestamp: string;
  showAvatar: boolean;
  attachment?: ChatAttachment | null;
}

const ATTACHMENT_REGEX = /^\[Attachment:\s*(.+?)\]$/;

export const ChatMessage = ({
  message,
  isOwn,
  senderName,
  avatarUrl,
  timestamp,
  showAvatar,
  attachment,
}: ChatMessageProps) => {
  const [viewingImage, setViewingImage] = useState(false);

  const attachmentMatch = message.match(ATTACHMENT_REGEX);
  const isAttachmentMessage = !!attachmentMatch;
  const isImage = attachment?.fileType?.startsWith("image/");

  return (
    <>
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

        {/* Message bubble */}
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

          {/* Attachment content */}
          {isAttachmentMessage && attachment ? (
            <div className="mb-1">
              {isImage ? (
                <div
                  className="rounded-lg overflow-hidden cursor-pointer -mx-1"
                  onClick={() => setViewingImage(true)}
                >
                  <img
                    src={attachment.fileUrl}
                    alt={attachment.fileName}
                    className="w-full max-h-52 object-cover rounded-lg"
                  />
                </div>
              ) : (
                <a
                  href={attachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg transition-colors",
                    isOwn ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" : "bg-secondary/50 hover:bg-secondary"
                  )}
                >
                  <File className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-medium truncate flex-1">{attachment.fileName}</span>
                  <Download className="w-4 h-4 shrink-0 opacity-60" />
                </a>
              )}
            </div>
          ) : isAttachmentMessage ? (
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-lg mb-1",
              isOwn ? "bg-primary-foreground/10" : "bg-secondary/50"
            )}>
              <FileImage className="w-5 h-5 shrink-0 opacity-60" />
              <span className="text-xs opacity-70">{attachmentMatch![1]}</span>
            </div>
          ) : (
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
              {message}
            </p>
          )}

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

      {/* Full-screen image viewer */}
      {attachment && isImage && (
        <Dialog open={viewingImage} onOpenChange={setViewingImage}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <DialogTitle className="sr-only">Attachment Image</DialogTitle>
            <img
              src={attachment.fileUrl}
              alt={attachment.fileName}
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
