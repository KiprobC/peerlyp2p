import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Bell, 
  Shield, 
  Moon, 
  Trash2, 
  Loader2,
  Mail,
  Smartphone,
  User,
  Wallet,
  Globe,
  Lock,
  ShieldCheck,
  ShieldX,
  Key,
  RefreshCw,
  LogOut,
  Monitor,
  HelpCircle,
  FileWarning,
  BadgeCheck,
  Eye,
  Languages,
  Palette,
  DollarSign,
  MessageSquare,
  AlertTriangle
} from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useMFA } from "@/hooks/useMFA";
import { MFAEnrollDialog } from "@/components/mfa/MFAEnrollDialog";
import { MFAVerifyDialog } from "@/components/mfa/MFAVerifyDialog";
import { OTPVerificationDialog } from "@/components/security/OTPVerificationDialog";
import { SettingsItem, SettingsSection } from "@/components/settings/SettingsItem";
import SupportChatDialog from "@/components/support/SupportChatDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const Settings = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { settings, loading, updateSettings, refetch } = useSettings();
  const { factors, isEnabled, loading: mfaLoading, disableMFA, fetchFactors } = useMFA();
  
  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDisableMFADialog, setShowDisableMFADialog] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);
  const [showSupportChat, setShowSupportChat] = useState(false);
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDisablingMFA, setIsDisablingMFA] = useState(false);
  
  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showMFAVerifyForPassword, setShowMFAVerifyForPassword] = useState(false);
  const [showMFAVerifyForDisable, setShowMFAVerifyForDisable] = useState(false);
  
  // Disable MFA verification state
  const [disableMFAPassword, setDisableMFAPassword] = useState("");

  // OTP verification states
  const [showOTPForPassword, setShowOTPForPassword] = useState(false);
  const [showOTPForDisable2FA, setShowOTPForDisable2FA] = useState(false);
  const [showOTPForEnable2FA, setShowOTPForEnable2FA] = useState(false);
  const [showOTPForDelete, setShowOTPForDelete] = useState(false);

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

  const executeDeleteAccount = async () => {
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

    // Always require OTP verification for password changes
    setShowPasswordDialog(false);
    setShowOTPForPassword(true);
  };

  const handlePasswordOTPVerified = async () => {
    setShowOTPForPassword(false);
    
    // If MFA is enabled, also require MFA verification
    if (isEnabled) {
      setShowMFAVerifyForPassword(true);
    } else {
      await executePasswordChange();
    }
  };

  const executePasswordChange = async () => {
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;
      
      toast.success("Password updated successfully");
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setShowPasswordDialog(false);
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
    // Require OTP verification first
    setShowDisableMFADialog(false);
    setShowOTPForDisable2FA(true);
  };

  const handleDisable2FAOTPVerified = async () => {
    setShowOTPForDisable2FA(false);
    // Now require the existing 2FA code
    setShowMFAVerifyForDisable(true);
  };

  const handleEnable2FA = () => {
    setShowSecurityDialog(false);
    // Require OTP verification before enabling 2FA
    setShowOTPForEnable2FA(true);
  };

  const handleEnable2FAOTPVerified = () => {
    setShowOTPForEnable2FA(false);
    setShowEnrollDialog(true);
  };

  const handleDeleteAccount = async () => {
    // Require OTP verification before deleting account
    setShowDeleteDialog(false);
    setShowOTPForDelete(true);
  };

  const handleDeleteOTPVerified = async () => {
    setShowOTPForDelete(false);
    await executeDeleteAccount();
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

  const getKYCStatusText = () => {
    switch (profile?.kyc_status) {
      case "verified": return "Verified";
      case "submitted": return "Under Review";
      case "rejected": return "Rejected";
      default: return "Not Verified";
    }
  };

  const getKYCStatusColor = () => {
    switch (profile?.kyc_status) {
      case "verified": return "#22c55e";
      case "submitted": return "#f59e0b";
      case "rejected": return "#ef4444";
      default: return "#6b7280";
    }
  };

  if (loading || mfaLoading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex items-center h-14">
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </nav>
        <main className="pt-20 pb-16 px-4">
          <div className="max-w-lg mx-auto space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-14">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="mr-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-16 pb-24">
        <div className="max-w-lg mx-auto">
          
          {/* Account Section */}
          <SettingsSection title="Account">
            <SettingsItem
              icon={User}
              iconColor="#6366f1"
              label="Profile"
              subtitle={profile?.username ? `@${profile.username}` : "Edit your profile"}
              onClick={() => navigate("/edit-profile")}
            />
            <SettingsItem
              icon={Shield}
              iconColor="#22c55e"
              label="Security"
              subtitle={isEnabled ? "2FA Enabled" : "Password & 2FA"}
              onClick={() => setShowSecurityDialog(true)}
            />
            <SettingsItem
              icon={Wallet}
              iconColor="#f59e0b"
              label="Wallet"
              subtitle="Balances, deposits & withdrawals"
              onClick={() => navigate("/dashboard")}
            />
            <SettingsItem
              icon={Palette}
              iconColor="#8b5cf6"
              label="Preferences"
              subtitle={`${settings?.theme || "Dark"} theme, ${settings?.preferred_currency || "KES"}`}
              onClick={() => setShowPreferencesDialog(true)}
            />
          </SettingsSection>

          {/* Notifications Section */}
          <SettingsSection title="Notifications">
            <SettingsItem
              icon={Bell}
              iconColor="#3b82f6"
              label="Push Notifications"
              toggle={{
                checked: settings?.push_notifications ?? true,
                onCheckedChange: (checked) => handleToggle("push_notifications", checked),
              }}
            />
            <SettingsItem
              icon={Mail}
              iconColor="#ec4899"
              label="Email Notifications"
              toggle={{
                checked: settings?.email_notifications ?? true,
                onCheckedChange: (checked) => handleToggle("email_notifications", checked),
              }}
            />
            <SettingsItem
              icon={AlertTriangle}
              iconColor="#f59e0b"
              label="Transaction Alerts"
              subtitle="Deposits, withdrawals & trades"
              toggle={{
                checked: settings?.transaction_alerts ?? true,
                onCheckedChange: (checked) => handleToggle("transaction_alerts", checked),
              }}
            />
          </SettingsSection>

          {/* Privacy & Safety Section */}
          <SettingsSection title="Privacy & Safety">
            <SettingsItem
              icon={Eye}
              iconColor="#6b7280"
              label="Privacy"
              subtitle="Manage your data visibility"
              onClick={() => navigate("/privacy-policy")}
            />
            <SettingsItem
              icon={BadgeCheck}
              iconColor={getKYCStatusColor()}
              label="KYC & Verification"
              subtitle={getKYCStatusText()}
              onClick={() => navigate("/kyc")}
            />
          </SettingsSection>

          {/* Support Section */}
          <SettingsSection title="Support">
            <SettingsItem
              icon={HelpCircle}
              iconColor="#06b6d4"
              label="Help & FAQ"
              subtitle="How Peerly works"
              onClick={() => navigate("/how-it-works")}
            />
            <SettingsItem
              icon={MessageSquare}
              iconColor="#10b981"
              label="Contact Support"
              subtitle="Chat with our team"
              onClick={() => setShowSupportChat(true)}
            />
            <SettingsItem
              icon={FileWarning}
              iconColor="#f97316"
              label="Report a Problem"
              subtitle="Help us improve"
              onClick={() => setShowSupportChat(true)}
            />
          </SettingsSection>

          {/* Danger Zone */}
          <SettingsSection title="Danger Zone">
            <SettingsItem
              icon={Trash2}
              label="Delete Account"
              subtitle="Permanently remove your data"
              onClick={() => setShowDeleteDialog(true)}
              destructive
              chevron={false}
            />
          </SettingsSection>

        </div>
      </main>

      {/* Security Dialog */}
      <Dialog open={showSecurityDialog} onOpenChange={setShowSecurityDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Security
            </DialogTitle>
            <DialogDescription>
              Manage your account security settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Password */}
            <div 
              className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => {
                setShowSecurityDialog(false);
                setShowPasswordDialog(true);
              }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Change Password</p>
                <p className="text-sm text-muted-foreground">Update your account password</p>
              </div>
            </div>

            {/* 2FA Status */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-4 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isEnabled ? "bg-green-500/10" : "bg-muted"}`}>
                  {isEnabled ? (
                    <ShieldCheck className="w-5 h-5 text-green-500" />
                  ) : (
                    <ShieldX className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    {isEnabled ? "Your account is protected" : "Add extra security"}
                  </p>
                </div>
                <Badge variant={isEnabled ? "default" : "secondary"} className={isEnabled ? "bg-green-500/10 text-green-500" : ""}>
                  {isEnabled ? "On" : "Off"}
                </Badge>
              </div>
              
              {isEnabled ? (
                <div className="space-y-2">
                  {verifiedFactors.map((factor) => (
                    <div key={factor.id} className="flex items-center gap-3 p-2 bg-background rounded-lg text-sm">
                      <Smartphone className="w-4 h-4 text-primary" />
                      <span className="flex-1">{factor.friendly_name || "Authenticator"}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(factor.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setShowSecurityDialog(false);
                        setShowEnrollDialog(true);
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Re-enroll
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setShowSecurityDialog(false);
                        setShowDisableMFADialog(true);
                      }}
                    >
                      Disable
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  className="w-full"
                  onClick={handleEnable2FA}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Enable 2FA
                </Button>
              )}
            </div>

            {/* Sessions */}
            <div 
              className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => {
                setShowSecurityDialog(false);
                setShowSessionsDialog(true);
              }}
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Monitor className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Active Sessions</p>
                <p className="text-sm text-muted-foreground">Manage logged-in devices</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sessions Dialog */}
      <Dialog open={showSessionsDialog} onOpenChange={setShowSessionsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Active Sessions
            </DialogTitle>
            <DialogDescription>
              Manage your logged-in devices
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3 mb-2">
                <Monitor className="w-5 h-5 text-green-500" />
                <span className="font-medium">Current Device</span>
                <Badge variant="secondary" className="text-xs">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">This is your current session</p>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                handleSignOutAllDevices();
                setShowSessionsDialog(false);
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out All Devices
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Enter your new password below
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {isEnabled && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <p className="text-sm text-primary">You'll verify with your authenticator app</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Enter new password"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={isChangingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
            >
              {isChangingPassword && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preferences Dialog */}
      <Dialog open={showPreferencesDialog} onOpenChange={setShowPreferencesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Preferences
            </DialogTitle>
            <DialogDescription>
              Customize your Peerly experience
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Moon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-muted-foreground">App appearance</p>
                </div>
              </div>
              <Select value={settings?.theme ?? "dark"} onValueChange={handleThemeChange}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Currency</p>
                  <p className="text-sm text-muted-foreground">Display currency</p>
                </div>
              </div>
              <Select value={settings?.preferred_currency ?? "KES"} onValueChange={handleCurrencyChange}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KES">KES</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="NGN">NGN</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Languages className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Language</p>
                  <p className="text-sm text-muted-foreground">Coming soon</p>
                </div>
              </div>
              <Select value="en" disabled>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              This will make your account less secure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                ⚠️ Disabling 2FA removes the extra security layer from your account.
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
        description="Enter the 6-digit code one last time"
        actionLabel="Verify & Disable 2FA"
      />

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              Are you sure? This action cannot be undone. All your data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              Your wallets, trades, and profile information will be permanently removed within 30 days.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Support Chat Dialog */}
      <SupportChatDialog 
        open={showSupportChat} 
        onOpenChange={setShowSupportChat} 
      />

      {/* OTP Verification Dialogs */}
      <OTPVerificationDialog
        open={showOTPForPassword}
        onOpenChange={setShowOTPForPassword}
        onVerified={handlePasswordOTPVerified}
        actionType="password_change"
        title="Verify Password Change"
        description="For your security, please verify your identity"
        actionLabel="Verify"
        requireMFA={isEnabled}
      />

      <OTPVerificationDialog
        open={showOTPForEnable2FA}
        onOpenChange={setShowOTPForEnable2FA}
        onVerified={handleEnable2FAOTPVerified}
        actionType="enable_2fa"
        title="Verify to Enable 2FA"
        description="Confirm your identity before enabling two-factor authentication"
        actionLabel="Continue"
      />

      <OTPVerificationDialog
        open={showOTPForDisable2FA}
        onOpenChange={setShowOTPForDisable2FA}
        onVerified={handleDisable2FAOTPVerified}
        actionType="disable_2fa"
        title="Verify to Disable 2FA"
        description="Confirm your identity before disabling two-factor authentication"
        actionLabel="Continue"
      />

      <OTPVerificationDialog
        open={showOTPForDelete}
        onOpenChange={setShowOTPForDelete}
        onVerified={handleDeleteOTPVerified}
        actionType="delete_account"
        title="Verify Account Deletion"
        description="This is a permanent action. Verify your identity to proceed."
        actionLabel="Verify & Delete"
        requireMFA={isEnabled}
      />
    </div>
  );
};

export default Settings;
