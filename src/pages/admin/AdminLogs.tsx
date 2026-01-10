import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Search, 
  RefreshCw, 
  Shield, 
  User, 
  ArrowRightLeft, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Download
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";

interface AdminAction {
  id: string;
  actor_id: string;
  actor_role: string;
  action_type: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  details: Record<string, any> | null;
  created_at: string;
  actor_profile?: {
    username: string | null;
    full_name: string | null;
  };
}

const actionIcons: Record<string, typeof Shield> = {
  kyc_approved: CheckCircle,
  kyc_rejected: XCircle,
  dispute_assigned: AlertTriangle,
  dispute_resolved: CheckCircle,
  user_banned: XCircle,
  role_changed: Shield,
  trade_cancelled: XCircle,
  escrow_released: ArrowRightLeft,
};

const actionColors: Record<string, string> = {
  kyc_approved: "text-green-500",
  kyc_rejected: "text-destructive",
  dispute_assigned: "text-yellow-500",
  dispute_resolved: "text-green-500",
  user_banned: "text-destructive",
  role_changed: "text-primary",
  trade_cancelled: "text-destructive",
  escrow_released: "text-primary",
};

export const AdminLogs = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data: actions, error } = await supabase
        .from("admin_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      // Fetch actor profiles
      const actorIds = [...new Set((actions || []).map(a => a.actor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, full_name")
        .in("user_id", actorIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (actions || []).map(action => ({
        ...action,
        actor_profile: profileMap.get(action.actor_id),
      })) as AdminAction[];
    },
  });

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor_profile?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.reason?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === "all" || log.action_type === filterType;
    
    return matchesSearch && matchesType;
  });

  const uniqueActionTypes = [...new Set(logs.map(l => l.action_type))];

  const handleExport = () => {
    const csvContent = [
      ["Date", "Actor", "Role", "Action", "Target Type", "Target ID", "Reason"].join(","),
      ...filteredLogs.map(log => [
        format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
        log.actor_profile?.username || log.actor_id.slice(0, 8),
        log.actor_role,
        log.action_type,
        log.target_type,
        log.target_id?.slice(0, 8) || "-",
        `"${log.reason || ""}"`,
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Security & Audit Logs</h1>
        <p className="text-muted-foreground">View all administrative actions and security events</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{logs.length}</p>
              <p className="text-sm text-muted-foreground">Total Actions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-500">
                {logs.filter(l => l.action_type.includes("approved") || l.action_type.includes("resolved")).length}
              </p>
              <p className="text-sm text-muted-foreground">Approvals</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-500">
                {logs.filter(l => l.action_type.includes("dispute")).length}
              </p>
              <p className="text-sm text-muted-foreground">Disputes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-destructive">
                {logs.filter(l => l.action_type.includes("rejected") || l.action_type.includes("banned")).length}
              </p>
              <p className="text-sm text-muted-foreground">Rejections</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActionTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Trail
          </CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {logs.length} records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No logs found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => {
                  const Icon = actionIcons[log.action_type] || Clock;
                  const colorClass = actionColors[log.action_type] || "text-muted-foreground";
                  
                  return (
                    <div 
                      key={log.id}
                      className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className={`shrink-0 ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            @{log.actor_profile?.username || log.actor_id.slice(0, 8)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {log.actor_role}
                          </Badge>
                          <span className="text-muted-foreground">performed</span>
                          <Badge variant="secondary">
                            {log.action_type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          <span>on {log.target_type}</span>
                          {log.target_id && (
                            <span className="font-mono ml-1">#{log.target_id.slice(0, 8)}</span>
                          )}
                        </div>
                        {log.reason && (
                          <p className="text-sm mt-1 text-muted-foreground italic">
                            "{log.reason}"
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
