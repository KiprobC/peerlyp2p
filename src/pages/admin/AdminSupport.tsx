import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminSupport, useSupportMessages, SupportTicket } from "@/hooks/useSupport";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Send, Loader2, User, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const AdminSupport = () => {
  const { tickets, loading, updateTicketStatus } = useAdminSupport();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredTickets = tickets.filter((ticket) => {
    if (statusFilter === "all") return true;
    return ticket.status === statusFilter;
  });

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Chat</h1>
        <p className="text-muted-foreground">Manage user support tickets</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tickets.length}</p>
                <p className="text-xs text-muted-foreground">Total Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openCount}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressCount}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {tickets.filter((t) => t.status === "resolved").length}
                </p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Tickets</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No tickets found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-accent/50 transition-colors",
                        selectedTicket?.id === ticket.id && "bg-accent"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-sm truncate flex-1">
                          {ticket.subject}
                        </p>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="truncate">{ticket.user_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat View */}
        <Card className="lg:col-span-2">
          {selectedTicket ? (
            <AdminChatView
              ticket={selectedTicket}
              onStatusChange={async (status) => {
                const success = await updateTicketStatus(selectedTicket.id, status);
                if (success) {
                  toast.success(`Ticket marked as ${status}`);
                  setSelectedTicket({ ...selectedTicket, status });
                }
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-[550px]">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Select a ticket to view</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const AdminChatView = ({
  ticket,
  onStatusChange,
}: {
  ticket: SupportTicket;
  onStatusChange: (status: SupportTicket["status"]) => void;
}) => {
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
    const success = await sendMessage(newMessage.trim(), true);
    setSending(false);

    if (success) {
      setNewMessage("");
      // Auto-update status to in_progress if currently open
      if (ticket.status === "open") {
        onStatusChange("in_progress");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{ticket.subject}</CardTitle>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {ticket.user_name}
              </span>
              <span>{ticket.user_email}</span>
              <span>
                Created {format(new Date(ticket.created_at), "MMM d, yyyy")}
              </span>
            </div>
          </div>
          <Select
            value={ticket.status}
            onValueChange={(value) => onStatusChange(value as SupportTicket["status"])}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex flex-col h-[450px]">
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isAdmin = msg.is_admin;
                return (
                  <div
                    key={msg.id}
                    className={cn("flex", isAdmin ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] rounded-lg px-3 py-2",
                        isAdmin ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      {!isAdmin && (
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {ticket.user_name}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p
                        className={cn(
                          "text-[10px] mt-1",
                          isAdmin ? "text-primary-foreground/70" : "text-muted-foreground"
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

        {ticket.status !== "closed" && (
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Type your reply..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                maxLength={1000}
              />
              <Button size="icon" onClick={handleSend} disabled={!newMessage.trim() || sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
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
    <Badge variant="outline" className={cn("text-[10px] capitalize shrink-0", variants[status])}>
      {status.replace("_", " ")}
    </Badge>
  );
};

export default AdminSupport;
