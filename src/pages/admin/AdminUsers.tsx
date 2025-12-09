import { useState } from "react";
import { Shield, ShieldCheck, ShieldX, Clock, MoreVertical, Eye, Ban, MessageSquare } from "lucide-react";
import { useAdminUsers } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/admin/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const kycStatusConfig = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" as const },
  submitted: { label: "Submitted", icon: Shield, variant: "outline" as const },
  verified: { label: "Verified", icon: ShieldCheck, variant: "default" as const },
  rejected: { label: "Rejected", icon: ShieldX, variant: "destructive" as const },
};

export const AdminUsers = () => {
  const { users, loading, updateUserKYC, addUserNote } = useAdminUsers();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleKYCUpdate = async (userId: string, status: "pending" | "submitted" | "verified" | "rejected") => {
    const { error } = await updateUserKYC(userId, status);
    if (error) {
      toast.error("Failed to update KYC status");
    } else {
      toast.success(`KYC status updated to ${status}`);
    }
  };

  const handleAddNote = async () => {
    if (!selectedUser || !noteText.trim()) return;
    setSaving(true);
    const { error } = await addUserNote(selectedUser, noteText);
    setSaving(false);
    if (error) {
      toast.error("Failed to add note");
    } else {
      toast.success("Note added successfully");
      setSelectedUser(null);
      setNoteText("");
    }
  };

  const columns = [
    {
      key: "full_name",
      header: "User",
      render: (user: typeof users[0]) => (
        <div>
          <p className="font-medium">{user.full_name || "No name"}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      ),
    },
    {
      key: "kyc_status",
      header: "KYC Status",
      render: (user: typeof users[0]) => {
        const config = kycStatusConfig[user.kyc_status];
        return (
          <Badge variant={config.variant} className="gap-1">
            <config.icon className="h-3 w-3" />
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: "total_trades",
      header: "Trades",
      render: (user: typeof users[0]) => (
        <span>{user.successful_trades}/{user.total_trades}</span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      render: (user: typeof users[0]) => (
        <span className="text-accent">★ {user.rating?.toFixed(1) || "0.0"}</span>
      ),
    },
    {
      key: "created_at",
      header: "Joined",
      render: (user: typeof users[0]) => (
        <span className="text-muted-foreground text-sm">
          {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      render: (user: typeof users[0]) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleKYCUpdate(user.user_id, "verified")}>
              <ShieldCheck className="h-4 w-4 mr-2 text-primary" />Verify KYC
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleKYCUpdate(user.user_id, "rejected")}>
              <ShieldX className="h-4 w-4 mr-2 text-destructive" />Reject KYC
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedUser(user.user_id)}>
              <MessageSquare className="h-4 w-4 mr-2" />Add Note
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage users, KYC verification, and accounts</p>
      </div>

      <DataTable
        data={users}
        columns={columns}
        searchPlaceholder="Search users by name or email..."
        loading={loading}
        emptyMessage="No users found"
      />

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admin Note</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter note about this user..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={saving}>{saving ? "Saving..." : "Add Note"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
