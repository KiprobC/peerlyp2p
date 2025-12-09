import { useState } from "react";
import { Search, Shield, ShieldCheck, ShieldX, Clock, MoreVertical } from "lucide-react";
import { useAdminUsers } from "@/hooks/useAdmin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const kycStatusConfig = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" as const },
  submitted: { label: "Submitted", icon: Shield, variant: "outline" as const },
  verified: { label: "Verified", icon: ShieldCheck, variant: "default" as const },
  rejected: { label: "Rejected", icon: ShieldX, variant: "destructive" as const },
};

export const AdminUsers = () => {
  const { users, loading, updateUserKYC } = useAdminUsers();
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState<string>("all");

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.phone?.includes(search);

    const matchesKYC = kycFilter === "all" || user.kyc_status === kycFilter;

    return matchesSearch && matchesKYC;
  });

  const handleKYCUpdate = async (userId: string, status: "pending" | "submitted" | "verified" | "rejected") => {
    const { error } = await updateUserKYC(userId, status);
    if (error) {
      toast.error("Failed to update KYC status");
    } else {
      toast.success(`KYC status updated to ${status}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage user accounts and KYC verification</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {["all", "pending", "submitted", "verified", "rejected"].map((status) => (
            <Button
              key={status}
              variant={kycFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setKycFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      <div className="glass-card p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>User</TableHead>
              <TableHead>KYC Status</TableHead>
              <TableHead>Trades</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const kycConfig = kycStatusConfig[user.kyc_status];
                return (
                  <TableRow key={user.id} className="border-border">
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.full_name || "No name"}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {user.phone && (
                          <p className="text-xs text-muted-foreground">{user.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={kycConfig.variant} className="gap-1">
                        <kycConfig.icon className="h-3 w-3" />
                        {kycConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{user.successful_trades}/{user.total_trades} trades</p>
                        <p className="text-muted-foreground">
                          {user.total_trades > 0
                            ? `${((user.successful_trades / user.total_trades) * 100).toFixed(0)}% success`
                            : "No trades"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-accent">★</span>
                        <span>{user.rating?.toFixed(1) || "0.0"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleKYCUpdate(user.user_id, "verified")}>
                            <ShieldCheck className="h-4 w-4 mr-2 text-primary" />
                            Verify KYC
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleKYCUpdate(user.user_id, "rejected")}>
                            <ShieldX className="h-4 w-4 mr-2 text-destructive" />
                            Reject KYC
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleKYCUpdate(user.user_id, "pending")}>
                            <Clock className="h-4 w-4 mr-2" />
                            Reset to Pending
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Showing {filteredUsers.length} of {users.length} users
      </p>
    </div>
  );
};
