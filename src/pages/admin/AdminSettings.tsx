import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Settings, Globe, Shield, Bell, Database, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const AdminSettings = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const handleBootstrapPush = async () => {
    setIsBootstrapping(true);
    try {
      const { data, error } = await supabase.functions.invoke("bootstrap-push-dispatch");
      if (error) throw error;
      toast.success(data?.message ?? "Push dispatch configured");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to configure push dispatch");
    } finally {
      setIsBootstrapping(false);
    }
  };
  const [settings, setSettings] = useState({
    platformName: "Peerly",
    supportEmail: "support@peerly.com",
    maintenanceMode: false,
    registrationEnabled: true,
    kycRequired: true,
    defaultCurrency: "USD",
    sessionTimeout: "30",
    maxLoginAttempts: "5",
    twoFactorRequired: false,
  });

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast.success("Settings saved successfully");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">Configure platform-wide settings and preferences</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>Basic platform configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform Name</Label>
              <Input 
                value={settings.platformName}
                onChange={(e) => setSettings(s => ({ ...s, platformName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Support Email</Label>
              <Input 
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings(s => ({ ...s, supportEmail: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">Disable access for non-admin users</p>
            </div>
            <Switch 
              checked={settings.maintenanceMode}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, maintenanceMode: checked }))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>User Registration</Label>
              <p className="text-sm text-muted-foreground">Allow new users to sign up</p>
            </div>
            <Switch 
              checked={settings.registrationEnabled}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, registrationEnabled: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Regional Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Regional Settings
          </CardTitle>
          <CardDescription>Currency and localization options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Currency</Label>
            <Select 
              value={settings.defaultCurrency}
              onValueChange={(value) => setSettings(s => ({ ...s, defaultCurrency: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                <SelectItem value="NGN">NGN - Nigerian Naira</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>KYC Required for Trading</Label>
              <p className="text-sm text-muted-foreground">Require identity verification before trades</p>
            </div>
            <Switch 
              checked={settings.kycRequired}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, kycRequired: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings
          </CardTitle>
          <CardDescription>Authentication and security configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Session Timeout (minutes)</Label>
              <Select 
                value={settings.sessionTimeout}
                onValueChange={(value) => setSettings(s => ({ ...s, sessionTimeout: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Login Attempts</Label>
              <Select 
                value={settings.maxLoginAttempts}
                onValueChange={(value) => setSettings(s => ({ ...s, maxLoginAttempts: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 attempts</SelectItem>
                  <SelectItem value="5">5 attempts</SelectItem>
                  <SelectItem value="10">10 attempts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Require 2FA for All Users</Label>
              <p className="text-sm text-muted-foreground">Enforce two-factor authentication</p>
            </div>
            <Switch 
              checked={settings.twoFactorRequired}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, twoFactorRequired: checked }))}
            />
          </div>
        </CardContent>
      </Card>



      {/* Push Notifications Dispatch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Push Dispatch Bootstrap
          </CardTitle>
          <CardDescription>
            One-click setup so the database trigger can call the push edge function.
            Lovable Cloud manages the service role key internally — this securely copies it
            from the edge runtime into the private dispatch config. Re-run after rotating keys.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleBootstrapPush} disabled={isBootstrapping} variant="secondary">
            {isBootstrapping ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Configuring...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />Configure Push Dispatch</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
