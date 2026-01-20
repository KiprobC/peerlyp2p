import { useState, useRef } from "react";
import { 
  Upload, 
  FileImage, 
  File, 
  Lock, 
  Clock, 
  CheckCircle,
  X,
  Loader2,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TradeEvidence } from "@/hooks/useTradeEvidence";
import { formatDistanceToNow } from "date-fns";

interface EvidencePanelProps {
  title: string;
  role: "buyer" | "seller";
  evidence: TradeEvidence[];
  isOwn: boolean;
  canUpload: boolean;
  uploading: boolean;
  onUpload: (file: File, description?: string) => Promise<void>;
  onLock?: () => Promise<void>;
}

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return File;
  if (fileType.startsWith("image/")) return FileImage;
  return File;
};

export const EvidencePanel = ({
  title,
  role,
  evidence,
  isOwn,
  canUpload,
  uploading,
  onUpload,
  onLock,
}: EvidencePanelProps) => {
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLocked = evidence.some((e) => e.is_locked);
  const canStillUpload = canUpload && !isLocked && isOwn;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    await onUpload(selectedFile, description || undefined);
    setSelectedFile(null);
    setPreviewUrl(null);
    setDescription("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setDescription("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {title}
            {isLocked && (
              <Badge variant="outline" className="text-[10px] gap-1 text-green-500 border-green-500/30">
                <Lock className="w-3 h-3" />
                Submitted
              </Badge>
            )}
          </CardTitle>
          {evidence.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {evidence.length} file{evidence.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="py-2 px-4 space-y-3">
        {/* Evidence list */}
        {evidence.length > 0 ? (
          <div className="space-y-2">
            {evidence.map((item) => {
              const FileIcon = getFileIcon(item.file_type);
              const isImage = item.file_type?.startsWith("image/");
              
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  {/* Thumbnail or icon */}
                  <div 
                    className={cn(
                      "w-10 h-10 rounded-md flex items-center justify-center shrink-0 overflow-hidden",
                      isImage ? "bg-secondary" : "bg-secondary"
                    )}
                  >
                    {isImage ? (
                      <img
                        src={item.file_url}
                        alt=""
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setViewingImage(item.file_url)}
                      />
                    ) : (
                      <FileIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.file_name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      {item.is_locked && (
                        <>
                          <span>•</span>
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        </>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {item.description}
                      </p>
                    )}
                  </div>
                  
                  {/* View button for images */}
                  {isImage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setViewingImage(item.file_url)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-4 text-center">
            <FileImage className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">No evidence uploaded</p>
          </div>
        )}

        {/* Upload area */}
        {canStillUpload && (
          <div className="pt-2 border-t border-border/50">
            {selectedFile ? (
              <div className="space-y-2">
                {/* Preview */}
                {previewUrl && (
                  <div className="relative rounded-lg overflow-hidden bg-secondary">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-32 object-contain"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 bg-background/80"
                      onClick={handleCancelUpload}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                
                {/* Description */}
                <Textarea
                  placeholder="Add description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-16 text-xs resize-none"
                />
                
                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 h-8 text-xs"
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Upload
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelUpload}
                    disabled={uploading}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border/50 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1.5" />
                <p className="text-xs text-muted-foreground">
                  Click to upload evidence
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  Images, PDFs, screenshots
                </p>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* Lock button */}
        {isOwn && evidence.length > 0 && !isLocked && onLock && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLock}
            className="w-full h-8 text-xs border-green-500/30 text-green-500 hover:bg-green-500/10"
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            Submit Evidence (Lock)
          </Button>
        )}
      </CardContent>

      {/* Image viewer dialog */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Evidence Image</DialogTitle>
          {viewingImage && (
            <img
              src={viewingImage}
              alt="Evidence"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
