import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/admin/DataTable";
import { StatsCard } from "@/components/admin/StatsCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Globe,
  CreditCard,
  Plus,
  Loader2,
  Smartphone,
  Building2,
  Wallet,
  Settings2,
} from "lucide-react";

interface Country {
  id: string;
  code: string;
  name: string;
  currency_code: string;
  currency_symbol: string;
  flag_emoji: string;
  is_active: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
  display_name: string;
  icon: string;
  description: string;
  is_active: boolean;
}

interface CountryPaymentMethod {
  id: string;
  country_id: string;
  payment_method_id: string;
  is_active: boolean;
  priority: number;
  countries: Country;
  payment_methods: PaymentMethod;
}

const AdminPaymentMethods = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [countryPaymentMethods, setCountryPaymentMethods] = useState<CountryPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingMethod, setAddingMethod] = useState(false);
  const [newMethodData, setNewMethodData] = useState({
    country_id: "",
    payment_method_id: "",
    priority: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [countriesRes, methodsRes, cpmRes] = await Promise.all([
        supabase.from("countries").select("*").order("name"),
        supabase.from("payment_methods").select("*").order("display_name"),
        supabase
          .from("country_payment_methods")
          .select(`*, countries(*), payment_methods(*)`)
          .order("priority"),
      ]);

      if (countriesRes.error) throw countriesRes.error;
      if (methodsRes.error) throw methodsRes.error;
      if (cpmRes.error) throw cpmRes.error;

      setCountries(countriesRes.data || []);
      setPaymentMethods(methodsRes.data || []);
      setCountryPaymentMethods(cpmRes.data as CountryPaymentMethod[] || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const toggleCountryPaymentMethod = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("country_payment_methods")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      
      setCountryPaymentMethods((prev) =>
        prev.map((cpm) => (cpm.id === id ? { ...cpm, is_active: isActive } : cpm))
      );
      toast.success(`Payment method ${isActive ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error("Error updating:", error);
      toast.error("Failed to update");
    }
  };

  const addCountryPaymentMethod = async () => {
    if (!newMethodData.country_id || !newMethodData.payment_method_id) {
      toast.error("Please select both country and payment method");
      return;
    }

    setAddingMethod(true);
    try {
      const { error } = await supabase.from("country_payment_methods").insert({
        country_id: newMethodData.country_id,
        payment_method_id: newMethodData.payment_method_id,
        priority: newMethodData.priority,
        is_active: true,
      });

      if (error) throw error;

      toast.success("Payment method added to country");
      setShowAddDialog(false);
      setNewMethodData({ country_id: "", payment_method_id: "", priority: 0 });
      fetchData();
    } catch (error: any) {
      console.error("Error adding:", error);
      toast.error(error.message || "Failed to add");
    } finally {
      setAddingMethod(false);
    }
  };

  const filteredCPMs = selectedCountry
    ? countryPaymentMethods.filter((cpm) => cpm.country_id === selectedCountry)
    : countryPaymentMethods;

  const columns = [
    {
      key: "country",
      header: "Country",
      render: (cpm: CountryPaymentMethod) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{cpm.countries?.flag_emoji}</span>
          <span>{cpm.countries?.name}</span>
          <Badge variant="outline" className="text-xs">
            {cpm.countries?.currency_code}
          </Badge>
        </div>
      ),
    },
    {
      key: "method",
      header: "Payment Method",
      render: (cpm: CountryPaymentMethod) => (
        <div className="flex items-center gap-2">
          {cpm.payment_methods?.icon === "smartphone" && <Smartphone className="w-4 h-4" />}
          {cpm.payment_methods?.icon === "building" && <Building2 className="w-4 h-4" />}
          {cpm.payment_methods?.icon === "wallet" && <Wallet className="w-4 h-4" />}
          {cpm.payment_methods?.icon === "credit-card" && <CreditCard className="w-4 h-4" />}
          <span>{cpm.payment_methods?.display_name}</span>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (cpm: CountryPaymentMethod) => (
        <Badge variant="secondary">{cpm.priority}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (cpm: CountryPaymentMethod) => (
        <Switch
          checked={cpm.is_active}
          onCheckedChange={(checked) => toggleCountryPaymentMethod(cpm.id, checked)}
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payment Methods</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add to Country
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Countries"
          value={countries.filter((c) => c.is_active).length}
          icon={Globe}
          subtitle="Active countries"
        />
        <StatsCard
          title="Payment Methods"
          value={paymentMethods.filter((m) => m.is_active).length}
          icon={CreditCard}
          subtitle="Available methods"
        />
        <StatsCard
          title="Configurations"
          value={countryPaymentMethods.filter((c) => c.is_active).length}
          icon={Settings2}
          subtitle="Active country-method links"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Country Payment Methods</CardTitle>
              <CardDescription>
                Manage which payment methods are available in each country
              </CardDescription>
            </div>
            <Select
              value={selectedCountry || "all"}
              onValueChange={(v) => setSelectedCountry(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map((country) => (
                  <SelectItem key={country.id} value={country.id}>
                    {country.flag_emoji} {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filteredCPMs} />
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method to Country</DialogTitle>
            <DialogDescription>
              Link a payment method to a specific country
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select
                value={newMethodData.country_id}
                onValueChange={(v) =>
                  setNewMethodData((prev) => ({ ...prev, country_id: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.flag_emoji} {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={newMethodData.payment_method_id}
                onValueChange={(v) =>
                  setNewMethodData((prev) => ({ ...prev, payment_method_id: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority (lower = higher priority)</Label>
              <Input
                type="number"
                value={newMethodData.priority}
                onChange={(e) =>
                  setNewMethodData((prev) => ({
                    ...prev,
                    priority: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addCountryPaymentMethod} disabled={addingMethod}>
              {addingMethod && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaymentMethods;
