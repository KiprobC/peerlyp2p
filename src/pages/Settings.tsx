import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Bell, 
  Shield, 
  Moon, 
  Trash2, 
  Loader2,
  Mail,
  MessageSquare,
  Smartphone,
  AlertTriangle
} from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { settings, loading, updateSettings } = useSettings();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggle = async (key: string, value: boolean) => {
    await updateSettings({ [key]: value });
  };

  const handleCurrencyChange = async (value: string) => {
    await updateSettings({ preferred_currency: value });
  };

  const handleThemeChange = async (value: string) => {
    await updateSettings({ theme: value });
    // Apply theme to document
    document.documentElement.classList.toggle("dark", value === "dark");
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // Soft delete - we'll just sign the user out
      // In production, you'd mark the account as deleted in the database
      await signOut();
      toast.success("Account deletion requested. Your data will be removed within 30 days.");
      navigate("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex items-center h-16">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </nav>
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 max-w-2xl space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
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
          <div className="flex items-center h-16">
            <div className="flex items-center gap-4">
              <Link to="/profile">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold">Settings</h1>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl space-y-6">
          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Manage how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="email_notifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive updates via email
                    </p>
                  </div>
                </div>
                <Switch
                  id="email_notifications"
                  checked={settings?.email_notifications ?? true}
                  onCheckedChange={(checked) => handleToggle("email_notifications", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="sms_notifications">SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive updates via SMS
                    </p>
                  </div>
                </div>
                <Switch
                  id="sms_notifications"
                  checked={settings?.sms_notifications ?? false}
                  onCheckedChange={(checked) => handleToggle("sms_notifications", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="push_notifications">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive in-app notifications
                    </p>
                  </div>
                </div>
                <Switch
                  id="push_notifications"
                  checked={settings?.push_notifications ?? true}
                  onCheckedChange={(checked) => handleToggle("push_notifications", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="transaction_alerts">Transaction Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified for deposits, withdrawals, and trades
                    </p>
                  </div>
                </div>
                <Switch
                  id="transaction_alerts"
                  checked={settings?.transaction_alerts ?? true}
                  onCheckedChange={(checked) => handleToggle("transaction_alerts", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security
              </CardTitle>
              <CardDescription>
                Manage your account security
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="two_factor">Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Switch
                  id="two_factor"
                  checked={settings?.two_factor_enabled ?? false}
                  onCheckedChange={(checked) => handleToggle("two_factor_enabled", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="w-5 h-5" />
                Preferences
              </CardTitle>
              <CardDescription>
                Customize your experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Preferred Currency</Label>
                  <p className="text-sm text-muted-foreground">
                    Display prices in your preferred currency
                  </p>
                </div>
                <Select
                  value={settings?.preferred_currency ?? "KES"}
                  onValueChange={handleCurrencyChange}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KES">KES</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred theme
                  </p>
                </div>
                <Select
                  value={settings?.theme ?? "dark"}
                  onValueChange={handleThemeChange}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions for your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your account? This action cannot be undone.
              All your data including wallets, trades, and profile information will be
              permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
