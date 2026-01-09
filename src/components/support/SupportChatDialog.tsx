import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useSupport, useSupportMessages, SupportTicket } from "@/hooks/useSupport";
import { Send, MessageCircle, Plus, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface SupportChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SupportChatDialog = ({ open, onOpenChange }: SupportChatDialogProps) => {
  const { user } = useAuth();
  const { tickets, loading: ticketsLoading, createTicket } = useSupport();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTicket(null);
      setShowNewTicket(false);
      setNewSubject("");
      setNewMessage("");
    }
  }, [open]);

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    
    setCreating(true);
    const ticket = await createTicket(newSubject.trim(), newMessage.trim());
    setCreating(false);
    
    if (ticket) {
      setShowNewTicket(false);
      setNewSubject("");
      setNewMessage("");
      setSelectedTicket(ticket);
    }
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Support Chat</DialogTitle>
            <DialogDescription>Please log in to access support.</DialogDescription>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">You need to be logged in to contact support.</p>
            <Button onClick={() => window.location.href = "/login"}>
              Log In
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[600px] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            {(selectedTicket || showNewTicket) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setSelectedTicket(null);
                  setShowNewTicket(false);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <DialogTitle>
                {showNewTicket
                  ? "New Support Ticket"
                  : selectedTicket
                  ? selectedTicket.subject
                  : "Support Chat"}
              </DialogTitle>
              <DialogDescription>
                {showNewTicket
                  ? "Describe your issue and we'll help you"
                  : selectedTicket
                  ? `Ticket #${selectedTicket.id.slice(0, 8)}`
                  : "View your support tickets or create a new one"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {showNewTicket ? (
          <div className="flex-1 p-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject</label>
              <Input
                placeholder="Brief description of your issue"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Message</label>
              <Textarea
                placeholder="Describe your issue in detail..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="min-h-[200px] resize-none"
                maxLength={1000}
              />
            </div>
            <Button
              onClick={handleCreateTicket}
              disabled={!newSubject.trim() || !newMessage.trim() || creating}
              className="w-full"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Ticket
                </>
              )}
            </Button>
          </div>
        ) : selectedTicket ? (
          <ChatView ticket={selectedTicket} />
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="p-4">
              <Button
                onClick={() => setShowNewTicket(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Support Ticket
              </Button>
            </div>
            
            <ScrollArea className="flex-1 px-4 pb-4">
              {ticketsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No support tickets yet</p>
                  <p className="text-sm text-muted-foreground/70">
                    Create a new ticket to get help
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="w-full p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(ticket.created_at), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                        <StatusBadge status={ticket.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ChatView = ({ ticket }: { ticket: SupportTicket }) => {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useSupportMessages(ticket.id);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    const success = await sendMessage(newMessage.trim());
    setSending(false);
    
    if (success) {
      setNewMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isClosed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <>
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id && !msg.is_admin;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    isOwn ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2",
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {msg.is_admin && (
                      <p className="text-xs font-medium mb-1 opacity-70">
                        Support Team
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p
                      className={cn(
                        "text-[10px] mt-1",
                        isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      {format(new Date(msg.created_at), "h:mm a")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {isClosed ? (
        <div className="p-4 border-t bg-muted/50">
          <p className="text-sm text-muted-foreground text-center">
            This ticket has been {ticket.status}
          </p>
        </div>
      ) : (
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              maxLength={1000}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

const StatusBadge = ({ status }: { status: SupportTicket["status"] }) => {
  const variants: Record<string, string> = {
    open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    in_progress: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    resolved: "bg-green-500/10 text-green-500 border-green-500/20",
    closed: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize", variants[status])}>
      {status.replace("_", " ")}
    </Badge>
  );
};

export default SupportChatDialog;
