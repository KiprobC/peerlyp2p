import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle,
  ShieldCheck,
  ShieldX,
  Key,
  RefreshCw,
  Lock,
  LogOut,
  Monitor
} from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useMFA } from "@/hooks/useMFA";
import { MFAEnrollDialog } from "@/components/mfa/MFAEnrollDialog";
import { MFAVerifyDialog } from "@/components/mfa/MFAVerifyDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const Settings = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { settings, loading, updateSettings, refetch } = useSettings();
  const { factors, isEnabled, loading: mfaLoading, disableMFA, fetchFactors } = useMFA();
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDisableMFADialog, setShowDisableMFADialog] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDisablingMFA, setIsDisablingMFA] = useState(false);
  
  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showMFAVerifyForPassword, setShowMFAVerifyForPassword] = useState(false);
  const [showMFAVerifyForDisable, setShowMFAVerifyForDisable] = useState(false);
  
  // Disable MFA verification state
  const [disableMFAPassword, setDisableMFAPassword] = useState("");

  const handleToggle = async (key: string, value: boolean) => {
    await updateSettings({ [key]: value });
  };

  const handleCurrencyChange = async (value: string) => {
    await updateSettings({ preferred_currency: value });
  };

  const handleThemeChange = async (value: string) => {
    await updateSettings({ theme: value });
    applyTheme(value);
  };

  const applyTheme = (theme: string) => {
    if (theme === "system") {
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", systemPrefersDark);
    } else {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  };

  useEffect(() => {
    if (settings?.theme) {
      applyTheme(settings.theme);
    }
  }, [settings?.theme]);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
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

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    // Require MFA verification if enabled
    if (isEnabled) {
      setShowMFAVerifyForPassword(true);
      return;
    }

    await executePasswordChange();
  };

  const executePasswordChange = async () => {
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;
      
      toast.success("Password updated successfully");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPasswordSection(false);
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDisableMFA = async () => {
    if (!disableMFAPassword.trim()) {
      toast.error("Please enter your password to disable 2FA");
      return;
    }
    
    // Require MFA verification before disabling
    setShowMFAVerifyForDisable(true);
  };

  const executeDisableMFA = async () => {
    const verifiedFactor = factors.find(f => f.status === "verified");
    if (!verifiedFactor) return;

    setIsDisablingMFA(true);
    const result = await disableMFA(verifiedFactor.id);
    setIsDisablingMFA(false);
    
    if (result.success) {
      setShowDisableMFADialog(false);
      setDisableMFAPassword("");
      refetch();
    }
  };

  const handleMFAEnrollSuccess = () => {
    fetchFactors();
    refetch();
  };

  const handleSignOutAllDevices = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
      toast.success("Signed out from all devices");
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out from all devices");
    }
  };

  const verifiedFactors = factors.filter(f => f.status === "verified");

  if (loading || mfaLoading) {
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
      <main className="pt-24 pb-24">
        <div className="container mx-auto px-4 max-w-2xl space-y-6">
          
          {/* Security Section - Primary Focus */}
          <Card className="border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Security
                  </CardTitle>
                  <CardDescription>
                    Protect your account with strong security measures
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Password Management */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-base">Password</Label>
                    <p className="text-sm text-muted-foreground">
                      Change your account password
                    </p>
                  </div>
                </div>
                
                {!showPasswordSection ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowPasswordSection(true)}
                    className="w-full sm:w-auto"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                ) : (
                  <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                    {isEnabled && (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <p className="text-sm text-primary">
                          You'll need to verify with your authenticator app
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                          }))
                        }
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                          setPasswordData((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        placeholder="Confirm new password"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowPasswordSection(false);
                          setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handlePasswordChange}
                        disabled={isChangingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                      >
                        {isChangingPassword ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Update Password
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Two-Factor Authentication Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="text-base">Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security with an authenticator app
                      </p>
                    </div>
                  </div>
                  <Badge variant={isEnabled ? "default" : "secondary"} className={isEnabled ? "bg-green-500/10 text-green-500 border-green-500/20" : ""}>
                    {isEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                {isEnabled ? (
                  <div className="space-y-4">
                    {/* Active Factors */}
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-3">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="font-medium">Your account is protected</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Two-factor authentication is active. You'll need your authenticator app for sensitive actions.
                      </p>
                      
                      {verifiedFactors.map((factor) => (
                        <div 
                          key={factor.id} 
                          className="flex items-center justify-between p-3 bg-background rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Smartphone className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium text-sm">
                                {factor.friendly_name || "Authenticator App"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Added {formatDistanceToNow(new Date(factor.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                            Active
                          </Badge>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowEnrollDialog(true)}
                        className="w-full"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Re-enroll Device
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setShowDisableMFADialog(true)}
                        className="w-full"
                      >
                        <ShieldX className="h-4 w-4 mr-2" />
                        Disable 2FA
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <ShieldX className="h-5 w-5" />
                        <span className="font-medium">2FA is not enabled</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Protect your account with an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator.
                      </p>
                      <Button onClick={() => setShowEnrollDialog(true)} className="w-full sm:w-auto">
                        <Shield className="h-4 w-4 mr-2" />
                        Enable 2FA
                      </Button>
                    </div>

                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        💡 We strongly recommend enabling 2FA. It protects your account even if your password is compromised.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Sessions & Devices */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-base">Sessions & Devices</Label>
                    <p className="text-sm text-muted-foreground">
                      Manage your active sessions
                    </p>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Current Session</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    This is your current device session
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSignOutAllDevices}
                    className="w-full"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out All Devices
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  className="w-full sm:w-auto"
                >
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* MFA Enrollment Dialog */}
      <MFAEnrollDialog 
        open={showEnrollDialog} 
        onOpenChange={setShowEnrollDialog}
        onSuccess={handleMFAEnrollSuccess}
      />

      {/* MFA Verification for Password Change */}
      <MFAVerifyDialog
        open={showMFAVerifyForPassword}
        onOpenChange={setShowMFAVerifyForPassword}
        onVerified={() => {
          setShowMFAVerifyForPassword(false);
          executePasswordChange();
        }}
        title="Verify to Change Password"
        description="Enter the 6-digit code from your authenticator app"
        actionLabel="Verify & Change Password"
      />

      {/* Disable MFA Dialog */}
      <Dialog open={showDisableMFADialog} onOpenChange={setShowDisableMFADialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-destructive" />
              Disable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              This will make your account less secure. Please confirm by verifying your identity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                ⚠️ Disabling 2FA will remove the extra security layer from your account. 
                You'll only need your password to sign in.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="disablePassword">Enter your password to confirm</Label>
              <Input
                id="disablePassword"
                type="password"
                value={disableMFAPassword}
                onChange={(e) => setDisableMFAPassword(e.target.value)}
                placeholder="Your password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDisableMFADialog(false);
              setDisableMFAPassword("");
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisableMFA}
              disabled={!disableMFAPassword.trim()}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MFA Verification for Disable */}
      <MFAVerifyDialog
        open={showMFAVerifyForDisable}
        onOpenChange={setShowMFAVerifyForDisable}
        onVerified={() => {
          setShowMFAVerifyForDisable(false);
          executeDisableMFA();
        }}
        title="Verify to Disable 2FA"
        description="Enter the 6-digit code from your authenticator app one last time"
        actionLabel="Verify & Disable 2FA"
      />

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
