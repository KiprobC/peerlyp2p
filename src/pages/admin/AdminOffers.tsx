import { useAdminOffers } from "@/hooks/useAdmin";
import { DataTable } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const AdminOffers = () => {
  const { offers, loading, deactivateOffer, deleteOffer } = useAdminOffers();

  const handleDeactivate = async (id: string) => {
    const { error } = await deactivateOffer(id);
    toast[error ? "error" : "success"](error ? "Failed to deactivate" : "Offer deactivated");
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteOffer(id);
    toast[error ? "error" : "success"](error ? "Failed to delete" : "Offer deleted");
  };

  const columns = [
    { key: "type", header: "Type", render: (o: typeof offers[0]) => <Badge variant={o.type === "buy" ? "default" : "destructive"}>{o.type}</Badge> },
    { key: "crypto_type", header: "Crypto", render: (o: typeof offers[0]) => <span>{o.crypto_amount} {o.crypto_type}</span> },
    { key: "price_per_unit", header: "Price", render: (o: typeof offers[0]) => <span>{o.fiat_currency} {o.price_per_unit.toLocaleString()}</span> },
    { key: "is_active", header: "Status", render: (o: typeof offers[0]) => <Badge variant={o.is_active ? "default" : "secondary"}>{o.is_active ? "Active" : "Inactive"}</Badge> },
    { key: "actions", header: "", sortable: false, render: (o: typeof offers[0]) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => handleDeactivate(o.id)}><Power className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Offer Management</h1>
        <p className="text-muted-foreground">View and manage all platform offers</p>
      </div>
      <DataTable data={offers} columns={columns} searchPlaceholder="Search offers..." loading={loading} />
    </div>
  );
};
