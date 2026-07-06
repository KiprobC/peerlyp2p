import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  BarChart3,
} from "lucide-react";
import { useMyOffers, Offer } from "@/hooks/useOffers";
import { useTrades } from "@/hooks/useTrades";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cryptoInfo } from "@/hooks/useWallets";

const MyOffers = () => {
  const navigate = useNavigate();
  const { offers, loading, updateOffer, deleteOffer, refetch } = useMyOffers();
  const { trades } = useTrades();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [deleteConfirmOffer, setDeleteConfirmOffer] = useState<Offer | null>(null);
  const [editForm, setEditForm] = useState({
    price_per_unit: 0,
    min_amount: 0,
    max_amount: 0,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Check if offer has active trades
  const hasActiveTrades = (offerId: string) => {
    return trades.some(
      (t) =>
        t.offer_id === offerId &&
        ["pending", "confirmed", "payment_sent"].includes(t.status)
    );
  };

  // Check if offer has any trades (for deletion restriction)
  const hasAnyTrades = (offerId: string) => {
    return trades.some((t) => t.offer_id === offerId);
  };

  const getOfferStatus = (offer: Offer) => {
    if (hasActiveTrades(offer.id)) {
      return { label: "In Trade", variant: "secondary" as const, color: "text-blue-500" };
    }
    if (offer.is_active) {
      return { label: "Active", variant: "default" as const, color: "text-primary" };
    }
    return { label: "Paused", variant: "outline" as const, color: "text-muted-foreground" };
  };

  const handleToggleActive = async (offer: Offer) => {
    const { error } = await updateOffer(offer.id, { is_active: !offer.is_active });
    if (error) {
      toast.error("Failed to update offer status");
    } else {
      toast.success(offer.is_active ? "Offer paused" : "Offer activated");
    }
  };

  const handlePriceAdjust = async (offer: Offer, adjustment: number) => {
    const newPrice = Math.max(0, offer.price_per_unit + adjustment);
    const { error } = await updateOffer(offer.id, { price_per_unit: newPrice });
    if (error) {
      toast.error("Failed to adjust price");
    } else {
      toast.success(`Price ${adjustment > 0 ? "increased" : "decreased"}`);
    }
  };

  const openEditDialog = (offer: Offer) => {
    setEditingOffer(offer);
    setEditForm({
      price_per_unit: offer.price_per_unit,
      min_amount: offer.min_amount,
      max_amount: offer.max_amount,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingOffer) return;
    setSaving(true);
    const { error } = await updateOffer(editingOffer.id, editForm);
    setSaving(false);
    if (error) {
      toast.error("Failed to update offer");
    } else {
      toast.success("Offer updated successfully");
      setEditingOffer(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmOffer) return;
    
    if (hasActiveTrades(deleteConfirmOffer.id)) {
      toast.error("Cannot delete offer with active trades");
      setDeleteConfirmOffer(null);
      return;
    }

    setDeleting(true);
    const { error } = await deleteOffer(deleteConfirmOffer.id);
    setDeleting(false);
    if (error) {
      // Check if it's a foreign key constraint error (offer has trade history)
      if (error.message?.includes("foreign key") || error.code === "23503") {
        toast.error("Cannot delete offer with trade history. Deactivate it instead.");
      } else {
        toast.error(error.message || "Failed to delete offer");
      }
    } else {
      toast.success("Offer deleted");
    }
    setDeleteConfirmOffer(null);
  };

  const filteredOffers = offers.filter(
    (offer) =>
      offer.crypto_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex items-center h-16">
              <Skeleton className="h-8 w-32" />
            </div>
          </div>
        </nav>
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 max-w-4xl space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold">My Offers</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/create-offer">
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Offer
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-24 md:pb-16">
        <div className="container mx-auto px-4 max-w-4xl space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search offers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-card text-center">
              <p className="text-2xl font-bold text-primary">{offers.filter((o) => o.is_active).length}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
            <div className="glass-card text-center">
              <p className="text-2xl font-bold text-muted-foreground">{offers.filter((o) => !o.is_active).length}</p>
              <p className="text-sm text-muted-foreground">Paused</p>
            </div>
            <div className="glass-card text-center">
              <p className="text-2xl font-bold text-blue-500">{offers.filter((o) => hasActiveTrades(o.id)).length}</p>
              <p className="text-sm text-muted-foreground">In Trade</p>
            </div>
          </div>

          {/* Offers List */}
          {filteredOffers.length === 0 ? (
            <div className="glass-card text-center py-12">
              <p className="text-muted-foreground mb-4">No offers found</p>
              <Link to="/create-offer">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Offer
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOffers.map((offer) => {
                const status = getOfferStatus(offer);
                const info = cryptoInfo[offer.crypto_type] || { name: offer.crypto_type, icon: "?", color: "#888" };
                const inTrade = hasActiveTrades(offer.id);

                return (
                  <div key={offer.id} className="glass-card">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Offer Info */}
                      <div className="flex items-start gap-4">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
                          style={{ backgroundColor: `${info.color}20`, color: info.color }}
                        >
                          {info.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={offer.type === "buy" ? "default" : "secondary"}>
                              {offer.type.toUpperCase()}
                            </Badge>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          <p className="font-semibold">
                            {offer.crypto_amount} {offer.crypto_type}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            @ {offer.fiat_currency} {offer.price_per_unit.toLocaleString()} per unit
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Limits: {offer.fiat_currency} {offer.min_amount.toLocaleString()} - {offer.max_amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Created {formatDistanceToNow(new Date(offer.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-3">
                        {/* Toggle Active */}
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-muted-foreground">Active</span>
                          <Switch
                            checked={offer.is_active}
                            onCheckedChange={() => handleToggleActive(offer)}
                            disabled={inTrade}
                          />
                        </div>

                        {/* Quick Price Adjust */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handlePriceAdjust(offer, -100)}
                            disabled={inTrade}
                          >
                            <TrendingDown className="w-4 h-4" />
                          </Button>
                          <span className="text-sm font-medium min-w-[80px] text-center">
                            {offer.fiat_currency} {offer.price_per_unit.toLocaleString()}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handlePriceAdjust(offer, 100)}
                            disabled={inTrade}
                          >
                            <TrendingUp className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Edit/Delete Buttons */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => openEditDialog(offer)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteConfirmOffer(offer)}
                            disabled={inTrade}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingOffer} onOpenChange={() => setEditingOffer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Offer</DialogTitle>
            <DialogDescription>Update your offer details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Price per Unit ({editingOffer?.fiat_currency})</label>
              <Input
                type="number"
                value={editForm.price_per_unit}
                onChange={(e) => setEditForm((prev) => ({ ...prev, price_per_unit: Number(e.target.value) }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Min Amount</label>
                <Input
                  type="number"
                  value={editForm.min_amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, min_amount: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Max Amount</label>
                <Input
                  type="number"
                  value={editForm.max_amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, max_amount: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOffer(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmOffer} onOpenChange={() => setDeleteConfirmOffer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Offer
            </DialogTitle>
            <DialogDescription>
              {deleteConfirmOffer && hasAnyTrades(deleteConfirmOffer.id) ? (
                <span className="text-amber-500">
                  This offer has trade history and cannot be deleted. You can deactivate it instead to hide it from the marketplace.
                </span>
              ) : (
                "Are you sure you want to delete this offer? This action cannot be undone."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOffer(null)}>Cancel</Button>
            {deleteConfirmOffer && hasAnyTrades(deleteConfirmOffer.id) ? (
              <Button 
                variant="secondary" 
                onClick={async () => {
                  await updateOffer(deleteConfirmOffer.id, { is_active: false });
                  toast.success("Offer deactivated");
                  setDeleteConfirmOffer(null);
                }}
              >
                Deactivate Instead
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Offer"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyOffers;
