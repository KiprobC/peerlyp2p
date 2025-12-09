import { useAdminTrades } from "@/hooks/useAdmin";
import { DataTable } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "outline",
  payment_sent: "outline",
  completed: "default",
  disputed: "destructive",
  cancelled: "destructive",
};

export const AdminTrades = () => {
  const { trades, loading } = useAdminTrades();

  const columns = [
    { key: "id", header: "Trade ID", render: (t: typeof trades[0]) => <span className="font-mono text-xs">{t.id.slice(0, 8)}</span> },
    { key: "crypto_type", header: "Crypto", render: (t: typeof trades[0]) => <span>{t.crypto_amount} {t.crypto_type}</span> },
    { key: "fiat_amount", header: "Value", render: (t: typeof trades[0]) => <span>{t.fiat_currency} {t.fiat_amount.toLocaleString()}</span> },
    { key: "status", header: "Status", render: (t: typeof trades[0]) => <Badge variant={statusVariants[t.status] || "secondary"}>{t.status}</Badge> },
    { key: "created_at", header: "Created", render: (t: typeof trades[0]) => <span className="text-muted-foreground text-sm">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Trade Monitoring</h1>
        <p className="text-muted-foreground">View and manage all platform trades</p>
      </div>
      <DataTable data={trades} columns={columns} searchPlaceholder="Search trades..." loading={loading} />
    </div>
  );
};
