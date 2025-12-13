import { useState } from "react";
import { usePlatformFees, PlatformFee } from "@/hooks/usePlatformFees";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Percent, DollarSign, Save, Loader2 } from "lucide-react";

export const AdminFees = () => {
  const { fees, loading, updateFee } = usePlatformFees();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlatformFee>>({});
  const [saving, setSaving] = useState(false);

  const startEditing = (fee: PlatformFee) => {
    setEditingId(fee.id);
    setEditForm({
      percentage: fee.percentage,
      min_amount: fee.min_amount,
      max_amount: fee.max_amount,
      is_active: fee.is_active,
      description: fee.description,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    const success = await updateFee(id, editForm);
    if (success) {
      setEditingId(null);
      setEditForm({});
    }
    setSaving(false);
  };

  const getFeeTypeLabel = (type: string) => {
    switch (type) {
      case "trade": return "Trade Fee";
      case "deposit": return "Deposit Fee";
      case "withdrawal": return "Withdrawal Fee";
      case "escrow": return "Escrow Fee";
      default: return type;
    }
  };

  const getFeeTypeIcon = (type: string) => {
    switch (type) {
      case "trade": return "💱";
      case "deposit": return "📥";
      case "withdrawal": return "📤";
      case "escrow": return "🔒";
      default: return "💰";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Fee Management</h1>
        <p className="text-muted-foreground">Configure platform fees for trades, deposits, and withdrawals</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {fees.map((fee) => (
          <Card key={fee.id} className={`${!fee.is_active ? 'opacity-50' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span>{getFeeTypeIcon(fee.fee_type)}</span>
                {getFeeTypeLabel(fee.fee_type)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{fee.percentage}%</span>
                {!fee.is_active && <Badge variant="secondary">Disabled</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fee Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {fees.map((fee) => (
          <Card key={fee.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getFeeTypeIcon(fee.fee_type)}</span>
                  <div>
                    <CardTitle>{getFeeTypeLabel(fee.fee_type)}</CardTitle>
                    <CardDescription>{fee.description}</CardDescription>
                  </div>
                </div>
                <Badge variant={fee.is_active ? "default" : "secondary"}>
                  {fee.is_active ? "Active" : "Disabled"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {editingId === fee.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`percentage-${fee.id}`}>Percentage (%)</Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`percentage-${fee.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className="pl-9"
                          value={editForm.percentage ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, percentage: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`min-${fee.id}`}>Min Amount</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`min-${fee.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-9"
                          value={editForm.min_amount ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, min_amount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`max-${fee.id}`}>Max Amount</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`max-${fee.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-9"
                          placeholder="No limit"
                          value={editForm.max_amount ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, max_amount: e.target.value ? parseFloat(e.target.value) : null })}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`desc-${fee.id}`}>Description</Label>
                    <Textarea
                      id={`desc-${fee.id}`}
                      value={editForm.description ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`active-${fee.id}`}
                        checked={editForm.is_active ?? true}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                      />
                      <Label htmlFor={`active-${fee.id}`}>Fee Enabled</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={cancelEditing}>Cancel</Button>
                      <Button onClick={() => handleSave(fee.id)} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Percentage</p>
                      <p className="text-lg font-semibold">{fee.percentage}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Min Amount</p>
                      <p className="text-lg font-semibold">${fee.min_amount || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Max Amount</p>
                      <p className="text-lg font-semibold">{fee.max_amount ? `$${fee.max_amount}` : "No limit"}</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => startEditing(fee)}>
                      Edit Fee
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
