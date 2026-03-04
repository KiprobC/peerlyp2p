import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { FileImage, File, Download, Eye, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TradeEvidence } from "@/hooks/useTradeEvidence";

interface EvidenceChatMessageProps {
  evidence: TradeEvidence;
  isOwn: boolean;
  senderName: string;
  avatarUrl?: string | null;
  showAvatar: boolean;
}

export const EvidenceChatMessage = ({
  evidence,
  isOwn,
  senderName,
  avatarUrl,
  showAvatar,
}: EvidenceChatMessageProps) => {
  const [viewingImage, setViewingImage] = useState(false);
  const isImage = evidence.file_type?.startsWith("image/");

  const typeLabel = {
    payment_proof: "Payment Proof",
    dispute_evidence: "Evidence",
    additional_info: "Additional Info",
    chat_attachment: "Attachment",
  }[evidence.evidence_type] || "File";

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
            "max-w-[80%] rounded-2xl overflow-hidden relative",
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-card border border-border/50 rounded-bl-md shadow-[var(--shadow-card)]"
          )}
        >
          {/* Sender name */}
          {!isOwn && showAvatar && (
            <p className="text-[11px] font-semibold text-primary px-3.5 pt-2 pb-0">{senderName}</p>
          )}

          {/* Type badge */}
          <div className="px-3.5 pt-2 pb-1">
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
              isOwn
                ? "bg-primary-foreground/15 text-primary-foreground/80"
                : "bg-secondary text-muted-foreground"
            )}>
              <FileImage className="w-3 h-3" />
              {typeLabel}
              {evidence.is_locked && <Lock className="w-2.5 h-2.5" />}
            </span>
          </div>

          {/* Image preview */}
          {isImage && (
            <div
              className="mx-1.5 mb-1 rounded-lg overflow-hidden cursor-pointer"
              onClick={() => setViewingImage(true)}
            >
              <img
                src={evidence.file_url}
                alt={evidence.file_name}
                className="w-full max-h-64 object-cover"
              />
            </div>
          )}

          {/* Non-image file */}
          {!isImage && (
            <div className={cn(
              "mx-3.5 mb-1 flex items-center gap-2 p-2 rounded-lg",
              isOwn ? "bg-primary-foreground/10" : "bg-secondary/50"
            )}>
              <File className="w-5 h-5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{evidence.file_name}</p>
                {evidence.file_size && (
                  <p className="text-[10px] opacity-60">
                    {(evidence.file_size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>
              <a
                href={evidence.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded hover:bg-secondary/50"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Description */}
          {evidence.description && (
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words px-3.5 pb-1">
              {evidence.description}
            </p>
          )}

          {/* Timestamp */}
          <div className={cn(
            "flex items-center justify-end gap-1 px-3.5 pb-2",
            isOwn ? "text-primary-foreground/50" : "text-muted-foreground"
          )}>
            <span className="text-[10px]">
              {formatDistanceToNow(new Date(evidence.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>

      {/* Full-screen image viewer */}
      <Dialog open={viewingImage} onOpenChange={setViewingImage}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Evidence Image</DialogTitle>
          <img
            src={evidence.file_url}
            alt={evidence.file_name}
            className="w-full h-auto max-h-[80vh] object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
