import { useState } from "react";
import { Shield, ShieldCheck, ShieldX, MoreVertical, Eye, Search, RefreshCw, Loader2, Clock, Key, Smartphone, AlertTriangle, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserMFAStatus {
  user_id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  mfa_enabled: boolean;
  created_at: string;
  last_seen: string | null;
}

interface SecurityEvent {
  id: string;
  user_id: string;
  action_type: string;
  method: string | null;
  status: string;
  ip_address: string | null;
  created_at: string;
  user_email?: string;
  username?: string;
}

export const AdminSecurity = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserMFAStatus | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch all users with their MFA status
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-users-mfa"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, username, created_at, last_seen")
        .eq("setup_completed", true)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Check user_settings for two_factor_enabled
      const userIds = (profiles || []).map(p => p.user_id);
      const { data: settings } = await supabase
        .from("user_settings")
        .select("user_id, two_factor_enabled")
        .in("user_id", userIds);

      const settingsMap = new Map(settings?.map(s => [s.user_id, s.two_factor_enabled]) || []);

      return (profiles || []).map((profile) => ({
        ...profile,
        mfa_enabled: settingsMap.get(profile.user_id) || false,
      })) as UserMFAStatus[];
    },
  });

  // Fetch recent security events
  const { data: securityEvents = [], isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ["admin-security-events"],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set((events || []).map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, username")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (events || []).map(event => ({
        ...event,
        user_email: profileMap.get(event.user_id)?.email || null,
        username: profileMap.get(event.user_id)?.username || null,
      })) as SecurityEvent[];
    },
  });

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mfaEnabledCount = users.filter((u) => u.mfa_enabled).length;
  const mfaDisabledCount = users.filter((u) => !u.mfa_enabled).length;

  const handleViewDetails = (user: UserMFAStatus) => {
    setSelectedUser(user);
    setShowDetailsDialog(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Security Management</h1>
        <p className="text-muted-foreground">Monitor and manage user MFA status</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-2xl">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-green-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              MFA Enabled
            </CardDescription>
            <CardTitle className="text-2xl text-green-500">{mfaEnabledCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ShieldX className="h-4 w-4 text-yellow-500" />
              MFA Disabled
            </CardDescription>
            <CardTitle className="text-2xl text-yellow-500">{mfaDisabledCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium text-muted-foreground">User</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Username</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">MFA Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Last Seen</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.user_id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{user.full_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <span className="text-muted-foreground">
                          {user.username ? `@${user.username}` : "-"}
                        </span>
                      </td>
                      <td className="p-4">
                        {user.mfa_enabled ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <ShieldX className="h-3 w-3 mr-1" />
                            Disabled
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {user.last_seen
                            ? formatDistanceToNow(new Date(user.last_seen), { addSuffix: true })
                            : "Never"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              User Security Details
            </DialogTitle>
            <DialogDescription>
              View security information for this user
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedUser.full_name || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Username</p>
                  <p className="font-medium">
                    {selectedUser.username ? `@${selectedUser.username}` : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">MFA Status</p>
                  {selectedUser.mfa_enabled ? (
                    <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <ShieldX className="h-3 w-3 mr-1" />
                      Disabled
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(selectedUser.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Seen</p>
                  <p className="font-medium">
                    {selectedUser.last_seen
                      ? formatDistanceToNow(new Date(selectedUser.last_seen), { addSuffix: true })
                      : "Never"}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> For security reasons, admins cannot directly disable a user's MFA. 
                  Users must manage their own 2FA settings. If a user is locked out, 
                  they should contact support for account recovery.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSecurity;
