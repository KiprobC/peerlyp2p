import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, CreditCard, AlertTriangle, Plus, Trash2, RefreshCw, Flag } from "lucide-react";
import { useCountryRiskSettings, usePaymentMethodRestrictions, useRiskFlags } from "@/hooks/usePlatformControls";
import { useCountries } from "@/hooks/useCountries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const kycTiers = [
  { value: 'unverified', label: 'Unverified' },
  { value: 'level_1', label: 'Level 1' },
  { value: 'level_2', label: 'Level 2' },
  { value: 'level_3', label: 'Level 3' },
];

const riskLevels = [
  { value: 'low', label: 'Low', color: 'bg-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'blocked', label: 'Blocked', color: 'bg-red-500' },
];

const flagTypes = [
  { value: 'country_mismatch', label: 'Country Mismatch' },
  { value: 'high_volume', label: 'High Volume' },
  { value: 'new_account', label: 'New Account' },
  { value: 'payment_pattern', label: 'Payment Pattern' },
  { value: 'custom', label: 'Custom' },
];

const flagActions = [
  { value: 'block', label: 'Block' },
  { value: 'require_review', label: 'Require Review' },
  { value: 'flag', label: 'Flag for Review' },
  { value: 'increase_kyc', label: 'Increase KYC Requirement' },
];

const severityLevels = [
  { value: 'low', label: 'Low', color: 'bg-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
];

export default function AdminRiskControls() {
  const { countrySettings, loading: countryLoading, upsertCountrySetting, deleteCountrySetting, refetch: refetchCountry } = useCountryRiskSettings();
  const { restrictions, loading: restrictionsLoading, upsertRestriction, deleteRestriction, refetch: refetchRestrictions } = usePaymentMethodRestrictions();
  const { riskFlags, loading: flagsLoading, createRiskFlag, updateRiskFlag, deleteRiskFlag, refetch: refetchFlags } = useRiskFlags();
  const { countries } = useCountries();

  const [countryDialogOpen, setCountryDialogOpen] = useState(false);
  const [restrictionDialogOpen, setRestrictionDialogOpen] = useState(false);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  
  const [newCountry, setNewCountry] = useState({
    country_code: '',
    trading_enabled: true,
    min_kyc_tier: 'unverified' as const,
    risk_level: 'low' as const,
    notes: '',
  });

  const [newRestriction, setNewRestriction] = useState({
    country_code: '',
    payment_method: '',
    is_allowed: true,
    min_kyc_tier: 'unverified' as const,
    notes: '',
  });

  const [newFlag, setNewFlag] = useState({
    flag_type: 'custom' as const,
    condition: {} as Record<string, unknown>,
    action: 'flag' as const,
    severity: 'medium' as const,
    is_active: true,
    description: '',
  });

  const handleSaveCountry = async () => {
    await upsertCountrySetting(newCountry);
    setCountryDialogOpen(false);
    setNewCountry({ country_code: '', trading_enabled: true, min_kyc_tier: 'unverified', risk_level: 'low', notes: '' });
  };

  const handleSaveRestriction = async () => {
    await upsertRestriction(newRestriction);
    setRestrictionDialogOpen(false);
    setNewRestriction({ country_code: '', payment_method: '', is_allowed: true, min_kyc_tier: 'unverified', notes: '' });
  };

  const handleSaveFlag = async () => {
    await createRiskFlag(newFlag);
    setFlagDialogOpen(false);
    setNewFlag({ flag_type: 'custom', condition: {}, action: 'flag', severity: 'medium', is_active: true, description: '' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Risk Controls</h1>
          <p className="text-xs text-muted-foreground">Country, payment method, and fraud pattern controls</p>
        </div>
      </div>

      <Tabs defaultValue="countries" className="space-y-4">
        <TabsList className="h-8">
          <TabsTrigger value="countries" className="text-xs px-3 h-6">
            <Globe className="h-3 w-3 mr-1" />
            Countries
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs px-3 h-6">
            <CreditCard className="h-3 w-3 mr-1" />
            Payment Methods
          </TabsTrigger>
          <TabsTrigger value="flags" className="text-xs px-3 h-6">
            <Flag className="h-3 w-3 mr-1" />
            Risk Flags
          </TabsTrigger>
        </TabsList>

        {/* Country Settings Tab */}
        <TabsContent value="countries" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Country Risk Settings</CardTitle>
                  <CardDescription className="text-xs">Configure trading restrictions by country</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={refetchCountry}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Dialog open={countryDialogOpen} onOpenChange={setCountryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-3 w-3 mr-1" />
                        Add Country
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Country Risk Setting</DialogTitle>
                        <DialogDescription>Configure trading restrictions for a country</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">Country</Label>
                          <Select value={newCountry.country_code} onValueChange={(v) => setNewCountry({ ...newCountry, country_code: v })}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              {countries.map((c) => (
                                <SelectItem key={c.code} value={c.code} className="text-sm">
                                  {c.flag_emoji} {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Label className="text-xs">Trading Enabled</Label>
                            <Switch
                              checked={newCountry.trading_enabled}
                              onCheckedChange={(v) => setNewCountry({ ...newCountry, trading_enabled: v })}
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Risk Level</Label>
                            <Select value={newCountry.risk_level} onValueChange={(v: any) => setNewCountry({ ...newCountry, risk_level: v })}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {riskLevels.map((r) => (
                                  <SelectItem key={r.value} value={r.value} className="text-sm">{r.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Minimum KYC Tier</Label>
                          <Select value={newCountry.min_kyc_tier} onValueChange={(v: any) => setNewCountry({ ...newCountry, min_kyc_tier: v })}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {kycTiers.map((t) => (
                                <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Notes</Label>
                          <Textarea
                            value={newCountry.notes}
                            onChange={(e) => setNewCountry({ ...newCountry, notes: e.target.value })}
                            className="text-sm"
                            placeholder="Internal notes..."
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setCountryDialogOpen(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveCountry}>Save</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {countryLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : countrySettings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No country restrictions configured. All countries are allowed with default settings.
                </div>
              ) : (
                <div className="space-y-2">
                  {countrySettings.map((setting) => {
                    const country = countries.find(c => c.code === setting.country_code);
                    const riskLevel = riskLevels.find(r => r.value === setting.risk_level);
                    return (
                      <div key={setting.id} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{country?.flag_emoji || '🏳️'}</span>
                          <div>
                            <div className="font-medium text-sm">{country?.name || setting.country_code}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant={setting.trading_enabled ? "default" : "destructive"} className="text-[10px] px-1">
                                {setting.trading_enabled ? "Enabled" : "Disabled"}
                              </Badge>
                              <Badge className={`text-[10px] px-1 ${riskLevel?.color}`}>
                                {riskLevel?.label}
                              </Badge>
                              <span>Min: {kycTiers.find(t => t.value === setting.min_kyc_tier)?.label}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteCountrySetting(setting.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Method Restrictions Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Payment Method Restrictions</CardTitle>
                  <CardDescription className="text-xs">Control which payment methods are allowed in each country</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={refetchRestrictions}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Dialog open={restrictionDialogOpen} onOpenChange={setRestrictionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-3 w-3 mr-1" />
                        Add Restriction
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Payment Restriction</DialogTitle>
                        <DialogDescription>Restrict a payment method in a specific country</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">Country</Label>
                          <Select value={newRestriction.country_code} onValueChange={(v) => setNewRestriction({ ...newRestriction, country_code: v })}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              {countries.map((c) => (
                                <SelectItem key={c.code} value={c.code} className="text-sm">
                                  {c.flag_emoji} {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Payment Method</Label>
                          <Input
                            value={newRestriction.payment_method}
                            onChange={(e) => setNewRestriction({ ...newRestriction, payment_method: e.target.value })}
                            className="h-8 text-sm"
                            placeholder="e.g., bank_transfer, mpesa"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Label className="text-xs">Is Allowed</Label>
                            <Switch
                              checked={newRestriction.is_allowed}
                              onCheckedChange={(v) => setNewRestriction({ ...newRestriction, is_allowed: v })}
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Minimum KYC</Label>
                            <Select value={newRestriction.min_kyc_tier} onValueChange={(v: any) => setNewRestriction({ ...newRestriction, min_kyc_tier: v })}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {kycTiers.map((t) => (
                                  <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setRestrictionDialogOpen(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveRestriction}>Save</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {restrictionsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : restrictions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No payment method restrictions. All methods allowed in all countries.
                </div>
              ) : (
                <div className="space-y-2">
                  {restrictions.map((restriction) => {
                    const country = countries.find(c => c.code === restriction.country_code);
                    return (
                      <div key={restriction.id} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-3">
                          <span>{country?.flag_emoji || '🏳️'}</span>
                          <div>
                            <div className="font-medium text-sm">{restriction.payment_method}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant={restriction.is_allowed ? "default" : "destructive"} className="text-[10px] px-1">
                                {restriction.is_allowed ? "Allowed" : "Blocked"}
                              </Badge>
                              <span>Min: {kycTiers.find(t => t.value === restriction.min_kyc_tier)?.label}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteRestriction(restriction.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Flags Tab */}
        <TabsContent value="flags" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Risk Flags</CardTitle>
                  <CardDescription className="text-xs">Configure fraud detection patterns and automated actions</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={refetchFlags}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-3 w-3 mr-1" />
                        Add Flag
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Risk Flag</DialogTitle>
                        <DialogDescription>Create a new fraud detection rule</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Flag Type</Label>
                            <Select value={newFlag.flag_type} onValueChange={(v: any) => setNewFlag({ ...newFlag, flag_type: v })}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {flagTypes.map((t) => (
                                  <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Action</Label>
                            <Select value={newFlag.action} onValueChange={(v: any) => setNewFlag({ ...newFlag, action: v })}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {flagActions.map((a) => (
                                  <SelectItem key={a.value} value={a.value} className="text-sm">{a.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Severity</Label>
                          <Select value={newFlag.severity} onValueChange={(v: any) => setNewFlag({ ...newFlag, severity: v })}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {severityLevels.map((s) => (
                                <SelectItem key={s.value} value={s.value} className="text-sm">{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Description</Label>
                          <Textarea
                            value={newFlag.description || ''}
                            onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
                            className="text-sm"
                            placeholder="Describe this risk flag..."
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setFlagDialogOpen(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveFlag}>Save</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {flagsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : riskFlags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No risk flags configured
                </div>
              ) : (
                <div className="space-y-2">
                  {riskFlags.map((flag) => {
                    const severity = severityLevels.find(s => s.value === flag.severity);
                    return (
                      <div key={flag.id} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${severity?.color}`} />
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {flagTypes.find(t => t.value === flag.flag_type)?.label}
                              {!flag.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {flag.description || 'No description'} • Action: {flagActions.find(a => a.value === flag.action)?.label}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={flag.is_active}
                            onCheckedChange={(v) => updateRiskFlag(flag.id, { is_active: v })}
                          />
                          <Button variant="ghost" size="sm" onClick={() => deleteRiskFlag(flag.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
