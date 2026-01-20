import { useState, useRef } from "react";
import { 
  Upload, 
  FileImage, 
  X, 
  Loader2, 
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PaymentProofDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (file: File, description?: string) => Promise<boolean>;
  paymentMethod: string;
  fiatAmount: number;
  fiatCurrency: string;
}

export const PaymentProofDialog = ({
  open,
  onClose,
  onSubmit,
  paymentMethod,
  fiatAmount,
  fiatCurrency,
}: PaymentProofDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File too large. Maximum size is 10MB.");
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        setError("Invalid file type. Please upload an image or PDF.");
        return;
      }
      
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const success = await onSubmit(selectedFile, description || undefined);
      if (success) {
        handleClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload payment proof");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setDescription("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="w-5 h-5 text-primary" />
            Upload Payment Proof
          </DialogTitle>
          <DialogDescription>
            Please upload proof of your {fiatCurrency} {fiatAmount.toLocaleString()} payment via {paymentMethod}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Payment reminder */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-500">
              <p className="font-medium mb-1">Before uploading:</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-500/90">
                <li>Ensure payment is completed</li>
                <li>Screenshot must show amount and recipient</li>
                <li>Proof should include transaction reference</li>
              </ul>
            </div>
          </div>

          {/* File upload area */}
          {selectedFile ? (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-secondary border border-border">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Payment proof preview"
                    className="w-full h-48 object-contain"
                  />
                ) : (
                  <div className="w-full h-48 flex items-center justify-center">
                    <div className="text-center">
                      <FileImage className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 bg-background/80 hover:bg-background"
                  onClick={handleRemoveFile}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Selected file indicator */}
              <div className="flex items-center gap-2 text-xs text-green-500">
                <CheckCircle className="w-4 h-4" />
                <span>File selected: {selectedFile.name}</span>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                error 
                  ? "border-destructive/50 bg-destructive/5" 
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className={cn(
                "w-8 h-8 mx-auto mb-3",
                error ? "text-destructive" : "text-muted-foreground"
              )} />
              <p className="text-sm font-medium mb-1">
                Click to upload payment proof
              </p>
              <p className="text-xs text-muted-foreground">
                Supports: Images, PDF (max 10MB)
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Description */}
          <Textarea
            placeholder="Add any additional notes (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-20 text-sm resize-none"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedFile || uploading}
            className="w-full sm:w-auto"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm Payment & Submit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
