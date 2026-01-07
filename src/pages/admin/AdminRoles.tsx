import React, { useState, useMemo } from "react";
import { 
  Shield, 
  ShieldCheck, 
  UserCog, 
  Crown, 
  Star, 
  TrendingUp, 
  Calendar, 
  CheckCircle2,
  Search,
  Filter,
  ChevronDown
} from "lucide-react";
import { useUserRoles, AppRole, UserWithRole } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const roleConfig = {
  admin: { 
    label: "Admin", 
    icon: Crown, 
    variant: "default" as const,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10"
  },
  moderator: { 
    label: "Moderator", 
    icon: ShieldCheck, 
    variant: "secondary" as const,
    color: "text-blue-500",
    bg: "bg-blue-500/10"
  },
  user: { 
    label: "User", 
    icon: Shield, 
    variant: "outline" as const,
    color: "text-muted-foreground",
    bg: "bg-muted"
  },
};

export const AdminRoles = () => {
  const { 
    users, 
    admins, 
    moderators, 
    regularUsers, 
    loading, 
    assignRole,
    getModeratorCandidates 
  } = useUserRoles();
  
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [targetRole, setTargetRole] = useState<AppRole | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Filters for candidate search
  const [minTrades, setMinTrades] = useState(5);
  const [minDays, setMinDays] = useState(30);
  const [minSuccessRate, setMinSuccessRate] = useState(80);
  const [showCandidatesOnly, setShowCandidatesOnly] = useState(false);

  const candidates = useMemo(() => 
    getModeratorCandidates(minTrades, minDays, minSuccessRate),
    [getModeratorCandidates, minTrades, minDays, minSuccessRate]
  );

  const filteredUsers = useMemo(() => {
    let result = showCandidatesOnly ? candidates : users;
    
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.username?.toLowerCase().includes(lowerSearch) ||
          u.full_name?.toLowerCase().includes(lowerSearch)
      );
    }
    
    return result;
  }, [users, candidates, search, showCandidatesOnly]);

  const handleRoleChange = async () => {
    if (!selectedUser || !targetRole) return;
    
    setSaving(true);
    const { error } = await assignRole(selectedUser.user_id, targetRole);
    setSaving(false);
    
    if (error) {
      toast.error("Failed to update role");
    } else {
      toast.success(`${selectedUser.username || "User"} is now a ${targetRole}`);
      setSelectedUser(null);
      setTargetRole(null);
    }
  };

  const openRoleDialog = (user: UserWithRole, role: AppRole) => {
    setSelectedUser(user);
    setTargetRole(role);
  };

  const UserCard = ({ user }: { user: UserWithRole }) => {
    const config = roleConfig[user.role];
    
    return (
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className={config.bg}>
                  <config.icon className={`h-5 w-5 ${config.color}`} />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">@{user.username || "unknown"}</span>
                  <Badge variant={config.variant} className="gap-1">
                    <config.icon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>
                {user.full_name && (
                  <p className="text-sm text-muted-foreground">{user.full_name}</p>
                )}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <UserCog className="h-4 w-4" />
                  Change Role
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {user.role !== "admin" && (
                  <DropdownMenuItem onClick={() => openRoleDialog(user, "admin")}>
                    <Crown className="h-4 w-4 mr-2 text-yellow-500" />
                    Promote to Admin
                  </DropdownMenuItem>
                )}
                {user.role !== "moderator" && (
                  <DropdownMenuItem onClick={() => openRoleDialog(user, "moderator")}>
                    <ShieldCheck className="h-4 w-4 mr-2 text-blue-500" />
                    {user.role === "admin" ? "Demote to" : "Promote to"} Moderator
                  </DropdownMenuItem>
                )}
                {user.role !== "user" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => openRoleDialog(user, "user")}
                      className="text-destructive"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Demote to User
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                <TrendingUp className="h-3 w-3" />
                Trades
              </div>
              <p className="font-semibold">{user.successful_trades}/{user.total_trades}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                <CheckCircle2 className="h-3 w-3" />
                Success
              </div>
              <p className="font-semibold">{user.success_rate}%</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                <Star className="h-3 w-3" />
                Rating
              </div>
              <p className="font-semibold text-yellow-500">★ {user.rating.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                <Calendar className="h-3 w-3" />
                Days
              </div>
              <p className="font-semibold">{user.days_on_platform}</p>
            </div>
          </div>
          
          {/* Additional Info */}
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}</span>
            <Badge variant={user.is_verified ? "default" : "outline"} className="text-xs">
              {user.is_verified ? "KYC Verified" : "Not Verified"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Role Management</h1>
        <p className="text-muted-foreground">
          Promote or demote users between Admin, Moderator, and User roles
        </p>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={roleConfig.admin.bg}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-yellow-500" />
              Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{admins.length}</p>
            <p className="text-sm text-muted-foreground">Full platform access</p>
          </CardContent>
        </Card>
        
        <Card className={roleConfig.moderator.bg}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-blue-500" />
              Moderators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{moderators.length}</p>
            <p className="text-sm text-muted-foreground">Dispute resolution access</p>
          </CardContent>
        </Card>
        
        <Card className={roleConfig.user.bg}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Regular Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{regularUsers.length}</p>
            <p className="text-sm text-muted-foreground">Standard trading access</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <TabsList>
            <TabsTrigger value="all">All Users ({users.length})</TabsTrigger>
            <TabsTrigger value="admins">Admins ({admins.length})</TabsTrigger>
            <TabsTrigger value="moderators">Moderators ({moderators.length})</TabsTrigger>
            <TabsTrigger value="candidates">Candidates ({candidates.length})</TabsTrigger>
          </TabsList>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by @username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredUsers.map((user) => (
              <UserCard key={user.user_id} user={user} />
            ))}
          </div>
          {filteredUsers.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No users found</p>
          )}
        </TabsContent>

        <TabsContent value="admins" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {admins.filter(u => 
              !search || 
              u.username?.toLowerCase().includes(search.toLowerCase()) ||
              u.full_name?.toLowerCase().includes(search.toLowerCase())
            ).map((user) => (
              <UserCard key={user.user_id} user={user} />
            ))}
          </div>
          {admins.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No admins configured</p>
          )}
        </TabsContent>

        <TabsContent value="moderators" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {moderators.filter(u => 
              !search || 
              u.username?.toLowerCase().includes(search.toLowerCase()) ||
              u.full_name?.toLowerCase().includes(search.toLowerCase())
            ).map((user) => (
              <UserCard key={user.user_id} user={user} />
            ))}
          </div>
          {moderators.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No moderators assigned yet</p>
          )}
        </TabsContent>

        <TabsContent value="candidates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Candidate Filters
              </CardTitle>
              <CardDescription>
                Adjust criteria to find suitable moderator candidates
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Label>Minimum Trades: {minTrades}</Label>
                <Slider
                  value={[minTrades]}
                  onValueChange={([v]) => setMinTrades(v)}
                  min={0}
                  max={50}
                  step={1}
                />
              </div>
              <div className="space-y-3">
                <Label>Days on Platform: {minDays}</Label>
                <Slider
                  value={[minDays]}
                  onValueChange={([v]) => setMinDays(v)}
                  min={0}
                  max={365}
                  step={1}
                />
              </div>
              <div className="space-y-3">
                <Label>Success Rate: {minSuccessRate}%</Label>
                <Slider
                  value={[minSuccessRate]}
                  onValueChange={([v]) => setMinSuccessRate(v)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {candidates.filter(u => 
              !search || 
              u.username?.toLowerCase().includes(search.toLowerCase()) ||
              u.full_name?.toLowerCase().includes(search.toLowerCase())
            ).map((user) => (
              <UserCard key={user.user_id} user={user} />
            ))}
          </div>
          {candidates.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No candidates match the current criteria. Try adjusting the filters.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Role Change Confirmation Dialog */}
      <Dialog open={!!selectedUser && !!targetRole} onOpenChange={() => { setSelectedUser(null); setTargetRole(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              You are about to change the role for @{selectedUser?.username || "user"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && targetRole && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4 py-4">
                <div className="text-center">
                  <Badge variant={roleConfig[selectedUser.role].variant} className="gap-1">
                    {React.createElement(roleConfig[selectedUser.role].icon, { className: "h-3 w-3" })}
                    {roleConfig[selectedUser.role].label}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Current</p>
                </div>
                <span className="text-2xl">→</span>
                <div className="text-center">
                  <Badge variant={roleConfig[targetRole].variant} className="gap-1">
                    {React.createElement(roleConfig[targetRole].icon, { className: "h-3 w-3" })}
                    {roleConfig[targetRole].label}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">New Role</p>
                </div>
              </div>
              
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <p><strong>User Stats:</strong></p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• {selectedUser.total_trades} total trades ({selectedUser.success_rate}% success)</li>
                  <li>• {selectedUser.days_on_platform} days on platform</li>
                  <li>• Rating: ★ {selectedUser.rating.toFixed(1)}</li>
                  <li>• KYC: {selectedUser.is_verified ? "Verified" : "Not Verified"}</li>
                </ul>
              </div>
              
              {targetRole === "admin" && (
                <p className="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                  ⚠️ Admins have full platform access including treasury and user management.
                </p>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedUser(null); setTargetRole(null); }}>
              Cancel
            </Button>
            <Button onClick={handleRoleChange} disabled={saving}>
              {saving ? "Updating..." : "Confirm Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
