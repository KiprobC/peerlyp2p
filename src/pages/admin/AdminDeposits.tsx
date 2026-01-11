import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatsCard } from "@/components/admin/StatsCard";
import { DataTable } from "@/components/admin/DataTable";
import { Wallet, Search, RefreshCw, Clock, CheckCircle, AlertCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

interface DepositAddress {
  id: string;
  user_id: string;
  crypto_type: string;
  address: string;
  network: string | null;
  is_active: boolean;
  total_deposited: number;
  pending_amount: number;
  last_deposit_at: string | null;
  last_monitored_at: string | null;
  created_at: string;
  user_email?: string;
  username?: string;
}

export const AdminDeposits = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [cryptoFilter, setCryptoFilter] = useState<string>("all");

  const { data: depositAddresses = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-deposit-addresses"],
    queryFn: async () => {
      const { data: addresses, error } = await supabase
        .from("deposit_addresses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set((addresses || []).map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, username")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (addresses || []).map(addr => ({
        ...addr,
        user_email: profileMap.get(addr.user_id)?.email || null,
        username: profileMap.get(addr.user_id)?.username || null,
      })) as DepositAddress[];
    },
  });

  const filteredAddresses = depositAddresses.filter(addr => {
    const matchesSearch = 
      addr.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      addr.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      addr.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      addr.user_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCrypto = cryptoFilter === "all" || addr.crypto_type === cryptoFilter;
    
    return matchesSearch && matchesCrypto;
  });

  const totalPendingDeposits = depositAddresses.reduce((sum, a) => sum + Number(a.pending_amount), 0);
  const addressesWithPending = depositAddresses.filter(a => Number(a.pending_amount) > 0).length;
  const activeAddresses = depositAddresses.filter(a => a.is_active).length;

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied to clipboard");
  };

  const getCryptoColors = (crypto: string) => {
    switch (crypto) {
      case "BTC": return "text-amber-500";
      case "ETH": return "text-blue-500";
      case "USDT": return "text-emerald-500";
      default: return "text-muted-foreground";
    }
  };

  const columns = [
    {
      key: "user",
      header: "User",
      render: (addr: DepositAddress) => (
        <div>
          <p className="font-medium text-sm">
            {addr.username ? `@${addr.username}` : addr.user_id.slice(0, 12) + "..."}
          </p>
          {addr.user_email && (
            <p className="text-xs text-muted-foreground">{addr.user_email}</p>
          )}
        </div>
      ),
    },
    {
      key: "crypto_type",
      header: "Crypto",
      render: (addr: DepositAddress) => (
        <span className={`font-bold ${getCryptoColors(addr.crypto_type)}`}>
          {addr.crypto_type}
        </span>
      ),
    },
    {
      key: "address",
      header: "Address",
      render: (addr: DepositAddress) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">
            {addr.address.slice(0, 10)}...{addr.address.slice(-8)}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={() => copyAddress(addr.address)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      key: "pending_amount",
      header: "Pending",
      render: (addr: DepositAddress) => (
        <div>
          {Number(addr.pending_amount) > 0 ? (
            <Badge variant="outline" className="border-yellow-500 text-yellow-500">
              {Number(addr.pending_amount).toFixed(6)}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">0</span>
          )}
        </div>
      ),
    },
    {
      key: "total_deposited",
      header: "Total Deposited",
      render: (addr: DepositAddress) => (
        <span className="font-mono text-sm">
          {Number(addr.total_deposited).toFixed(6)}
        </span>
      ),
    },
    {
      key: "last_deposit_at",
      header: "Last Deposit",
      render: (addr: DepositAddress) => (
        <span className="text-sm text-muted-foreground">
          {addr.last_deposit_at 
            ? formatDistanceToNow(new Date(addr.last_deposit_at), { addSuffix: true })
            : "Never"}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      render: (addr: DepositAddress) => (
        <Badge variant={addr.is_active ? "default" : "secondary"}>
          {addr.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Deposit Addresses</h1>
        <p className="text-muted-foreground">Monitor all user deposit addresses and pending deposits</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Addresses"
          value={depositAddresses.length}
          icon={Wallet}
          variant="primary"
        />
        <StatsCard
          title="Active Addresses"
          value={activeAddresses}
          icon={CheckCircle}
          variant="success"
        />
        <StatsCard
          title="With Pending"
          value={addressesWithPending}
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="Total Pending"
          value={totalPendingDeposits.toFixed(6)}
          icon={AlertCircle}
          variant={totalPendingDeposits > 0 ? "warning" : "default"}
        />
      </div>

      {/* Pending Deposits Alert */}
      {addressesWithPending > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-medium">Pending Deposits Detected</p>
                <p className="text-sm text-muted-foreground">
                  {addressesWithPending} address{addressesWithPending > 1 ? "es have" : " has"} pending deposits awaiting confirmation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-4 items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by address, user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-1">
            {["all", "BTC", "ETH", "USDT"].map((crypto) => (
              <Button
                key={crypto}
                variant={cryptoFilter === crypto ? "default" : "outline"}
                size="sm"
                onClick={() => setCryptoFilter(crypto)}
                className={cryptoFilter === crypto ? "" : getCryptoColors(crypto)}
              >
                {crypto === "all" ? "All" : crypto}
              </Button>
            ))}
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Addresses Table */}
      <DataTable
        data={filteredAddresses}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Search addresses..."
        emptyMessage="No deposit addresses found"
      />
    </div>
  );
};

export default AdminDeposits;