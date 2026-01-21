import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  MessageSquarePlus,
  FileQuestion,
  Scale,
  Loader2,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ModeratorActionsPanelProps {
  tradeId: string;
  buyerId: string;
  sellerId: string;
  moderatorId: string;
  onResolved?: () => void;
}

type ResolutionType = "buyer_wins" | "seller_wins" | "split" | "cancelled";

export const ModeratorActionsPanel = ({
  tradeId,
  buyerId,
  sellerId,
  moderatorId,
  onResolved,
}: ModeratorActionsPanelProps) => {
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [requestInfoDialogOpen, setRequestInfoDialogOpen] = useState(false);
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [requestTarget, setRequestTarget] = useState<"buyer" | "seller" | "both">("both");
  const [resolutionType, setResolutionType] = useState<ResolutionType>("buyer_wins");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const sendModeratorMessage = async (messageText: string, isSystemMessage = true) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("trade_messages").insert({
        trade_id: tradeId,
        sender_id: moderatorId,
        message: messageText,
        is_system: isSystemMessage,
      });

      if (error) throw error;
      toast.success("Message sent");
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handlePostMessage = async () => {
    if (!message.trim()) return;
    const success = await sendModeratorMessage(`[MODERATOR] ${message.trim()}`);
    if (success) {
      setMessage("");
      setMessageDialogOpen(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!message.trim()) return;
    
    let targetText = "";
    if (requestTarget === "buyer") targetText = "Buyer";
    else if (requestTarget === "seller") targetText = "Seller";
    else targetText = "Both parties";

    const requestMessage = `[MODERATOR REQUEST] ${targetText}: ${message.trim()}`;
    const success = await sendModeratorMessage(requestMessage);
    if (success) {
      setMessage("");
      setRequestInfoDialogOpen(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      toast.error("Please provide resolution notes");
      return;
    }

    setLoading(true);
    try {
      // Update trade with resolution
      const tradeUpdates: Record<string, any> = {
        resolution_type: resolutionType,
        dispute_resolution_summary: resolutionNotes.trim(),
        assigned_moderator_id: moderatorId,
      };

      // Set final status based on resolution
      if (resolutionType === "buyer_wins") {
        tradeUpdates.status = "completed";
        tradeUpdates.escrow_released = true;
        tradeUpdates.completed_at = new Date().toISOString();
      } else if (resolutionType === "seller_wins") {
        tradeUpdates.status = "cancelled";
        tradeUpdates.cancelled_at = new Date().toISOString();
      } else if (resolutionType === "split") {
        tradeUpdates.status = "completed";
        tradeUpdates.completed_at = new Date().toISOString();
      } else {
        tradeUpdates.status = "cancelled";
        tradeUpdates.cancelled_at = new Date().toISOString();
      }

      const { error: tradeError } = await supabase
        .from("trades")
        .update(tradeUpdates)
        .eq("id", tradeId);

      if (tradeError) throw tradeError;

      // Update dispute assignment
      await supabase
        .from("dispute_assignments")
        .update({
          status: "resolved",
          resolution_type: resolutionType,
          resolution_notes: resolutionNotes.trim(),
          resolved_at: new Date().toISOString(),
        })
        .eq("trade_id", tradeId);

      // Log admin action
      await supabase.from("admin_actions").insert({
        actor_id: moderatorId,
        actor_role: "moderator",
        action_type: "dispute_resolved",
        target_type: "trade",
        target_id: tradeId,
        reason: resolutionNotes.trim(),
        details: { resolution_type: resolutionType },
      });

      // Send resolution message
      const resolutionMessage = getResolutionMessage(resolutionType, resolutionNotes.trim());
      await sendModeratorMessage(resolutionMessage);

      toast.success("Dispute resolved successfully");
      setResolutionDialogOpen(false);
      setResolutionNotes("");
      onResolved?.();
    } catch (error) {
      console.error("Error resolving dispute:", error);
      toast.error("Failed to resolve dispute");
    } finally {
      setLoading(false);
    }
  };

  const getResolutionMessage = (type: ResolutionType, notes: string) => {
    const decisions: Record<ResolutionType, string> = {
      buyer_wins: "🏛️ DISPUTE RESOLVED: Funds released to buyer.",
      seller_wins: "🏛️ DISPUTE RESOLVED: Funds returned to seller.",
      split: "🏛️ DISPUTE RESOLVED: Funds split between parties.",
      cancelled: "🏛️ DISPUTE RESOLVED: Trade cancelled.",
    };
    return `${decisions[type]} Reason: ${notes}`;
  };

  return (
    <>
      {/* Moderator Actions Bar */}
      <div className="flex items-center gap-2 p-3 bg-violet-500/10 border-y border-violet-500/20">
        <Shield className="w-4 h-4 text-violet-500" />
        <span className="text-xs font-medium text-violet-500 mr-auto">Moderator Actions</span>
        
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 border-violet-500/30 text-violet-600 hover:bg-violet-500/10"
          onClick={() => setRequestInfoDialogOpen(true)}
        >
          <FileQuestion className="w-3.5 h-3.5" />
          Request Info
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 border-violet-500/30 text-violet-600 hover:bg-violet-500/10"
          onClick={() => setMessageDialogOpen(true)}
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          Post Message
        </Button>
        
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => setResolutionDialogOpen(true)}
        >
          <Scale className="w-3.5 h-3.5" />
          Resolve
        </Button>
      </div>

      {/* Post Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-violet-500" />
              Post Official Message
            </DialogTitle>
            <DialogDescription>
              Send an official moderator message visible to both parties.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePostMessage}
              disabled={!message.trim() || loading}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Info Dialog */}
      <Dialog open={requestInfoDialogOpen} onOpenChange={setRequestInfoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-amber-500" />
              Request Information
            </DialogTitle>
            <DialogDescription>
              Request additional information or evidence from the parties.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Request from:</Label>
              <RadioGroup
                value={requestTarget}
                onValueChange={(v) => setRequestTarget(v as "buyer" | "seller" | "both")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="buyer" id="buyer" />
                  <Label htmlFor="buyer" className="text-sm font-normal">Buyer</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="seller" id="seller" />
                  <Label htmlFor="seller" className="text-sm font-normal">Seller</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="both" id="both" />
                  <Label htmlFor="both" className="text-sm font-normal">Both</Label>
                </div>
              </RadioGroup>
            </div>
            
            <Textarea
              placeholder="What information do you need?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestInfoDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestInfo}
              disabled={!message.trim() || loading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolution Dialog */}
      <Dialog open={resolutionDialogOpen} onOpenChange={setResolutionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-violet-500" />
              Resolve Dispute
            </DialogTitle>
            <DialogDescription>
              Make a final decision on this dispute. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Resolution Decision</Label>
              <RadioGroup
                value={resolutionType}
                onValueChange={(v) => setResolutionType(v as ResolutionType)}
                className="space-y-2"
              >
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  resolutionType === "buyer_wins" ? "border-green-500 bg-green-500/10" : "border-border"
                )}>
                  <RadioGroupItem value="buyer_wins" id="buyer_wins" />
                  <div className="flex-1">
                    <Label htmlFor="buyer_wins" className="text-sm font-medium">Release to Buyer</Label>
                    <p className="text-xs text-muted-foreground">Release escrowed funds to the buyer</p>
                  </div>
                </div>
                
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  resolutionType === "seller_wins" ? "border-blue-500 bg-blue-500/10" : "border-border"
                )}>
                  <RadioGroupItem value="seller_wins" id="seller_wins" />
                  <div className="flex-1">
                    <Label htmlFor="seller_wins" className="text-sm font-medium">Refund to Seller</Label>
                    <p className="text-xs text-muted-foreground">Return escrowed funds to the seller</p>
                  </div>
                </div>
                
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  resolutionType === "split" ? "border-amber-500 bg-amber-500/10" : "border-border"
                )}>
                  <RadioGroupItem value="split" id="split" />
                  <div className="flex-1">
                    <Label htmlFor="split" className="text-sm font-medium">Split 50/50</Label>
                    <p className="text-xs text-muted-foreground">Split funds evenly between both parties</p>
                  </div>
                </div>
                
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  resolutionType === "cancelled" ? "border-destructive bg-destructive/10" : "border-border"
                )}>
                  <RadioGroupItem value="cancelled" id="cancelled" />
                  <div className="flex-1">
                    <Label htmlFor="cancelled" className="text-sm font-medium">Cancel Trade</Label>
                    <p className="text-xs text-muted-foreground">Cancel without fund transfer</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Resolution Notes</Label>
              <Textarea
                placeholder="Explain the reasoning for this decision..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolutionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={!resolutionNotes.trim() || loading}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
