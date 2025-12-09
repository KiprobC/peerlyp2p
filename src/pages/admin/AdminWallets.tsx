import { useAdminWallets, useAdminTransactions } from "@/hooks/useAdmin";
import { DataTable } from "@/components/admin/DataTable";
import { StatsCard } from "@/components/admin/StatsCard";
import { Wallet, Lock } from "lucide-react";

export const AdminWallets = () => {
  const { wallets, totalEscrowLocked, loading } = useAdminWallets();

  const totalBTC = wallets.filter(w => w.crypto_type === "BTC").reduce((s, w) => s + Number(w.balance), 0);
  const totalUSDT = wallets.filter(w => w.crypto_type === "USDT").reduce((s, w) => s + Number(w.balance), 0);

  const columns = [
    { key: "user_id", header: "User", render: (w: typeof wallets[0]) => <span className="font-mono text-xs">{w.user_id.slice(0, 12)}...</span> },
    { key: "crypto_type", header: "Crypto" },
    { key: "balance", header: "Balance", render: (w: typeof wallets[0]) => <span>{Number(w.balance).toFixed(6)}</span> },
    { key: "locked_balance", header: "Locked", render: (w: typeof wallets[0]) => <span className="text-accent">{Number(w.locked_balance).toFixed(6)}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Wallet Management</h1>
        <p className="text-muted-foreground">View all user wallets and balances</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard title="Total BTC" value={totalBTC.toFixed(6)} icon={Wallet} variant="primary" />
        <StatsCard title="Total USDT" value={totalUSDT.toFixed(2)} icon={Wallet} variant="success" />
        <StatsCard title="Total Escrow Locked" value={totalEscrowLocked.toFixed(6)} icon={Lock} variant="warning" />
      </div>
      <DataTable data={wallets} columns={columns} searchPlaceholder="Search wallets..." loading={loading} />
    </div>
  );
};

export const AdminTransactions = () => {
  const { transactions, loading } = useAdminTransactions();

  const columns = [
    { key: "type", header: "Type" },
    { key: "amount", header: "Amount", render: (t: typeof transactions[0]) => <span>{t.amount} {t.crypto_type}</span> },
    { key: "status", header: "Status" },
    { key: "mpesa_receipt", header: "MPESA Receipt", render: (t: typeof transactions[0]) => <span>{t.mpesa_receipt || "-"}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Transactions</h1>
        <p className="text-muted-foreground">View all wallet transactions</p>
      </div>
      <DataTable data={transactions} columns={columns} searchPlaceholder="Search transactions..." loading={loading} />
    </div>
  );
};
