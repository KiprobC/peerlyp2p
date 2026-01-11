import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useThemeInit } from "@/hooks/useThemeInit";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useRealtimeWallets } from "@/hooks/useRealtimeWallets";
import Index from "./pages/Index";
import Marketplace from "./pages/Marketplace";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProfileSetup from "./pages/ProfileSetup";
import Dashboard from "./pages/Dashboard";
import HowItWorks from "./pages/HowItWorks";
import CreateOffer from "./pages/CreateOffer";
import Trade from "./pages/Trade";
import Trades from "./pages/Trades";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Settings from "./pages/Settings";
import KYCUpload from "./pages/KYCUpload";
import MyOffers from "./pages/MyOffers";
import OfferAnalytics from "./pages/OfferAnalytics";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import WalletDeposit from "./pages/WalletDeposit";
import WalletWithdraw from "./pages/WalletWithdraw";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminOverview } from "./pages/admin/AdminOverview";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminDisputes } from "./pages/admin/AdminDisputes";
import { AdminAnalytics } from "./pages/admin/AdminAnalytics";
import { AdminTrades } from "./pages/admin/AdminTrades";
import { AdminOffers } from "./pages/admin/AdminOffers";
import { AdminWallets, AdminTransactions } from "./pages/admin/AdminWallets";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { AdminLogs } from "./pages/admin/AdminLogs";
import AdminNotifications from "./pages/admin/AdminNotifications";
import { AdminFees } from "./pages/admin/AdminFees";
import { AdminEscrow } from "./pages/admin/AdminEscrow";
import AdminKYC from "./pages/admin/AdminKYC";
import { AdminTreasury } from "./pages/admin/AdminTreasury";
import AdminDeposits from "./pages/admin/AdminDeposits";
import { AdminModeration } from "./pages/admin/AdminModeration";
import AdminSecurity from "./pages/admin/AdminSecurity";
import AdminPaymentMethods from "./pages/admin/AdminPaymentMethods";
import { AdminRoles } from "./pages/admin/AdminRoles";
import AdminSupport from "./pages/admin/AdminSupport";
import { ModeratorLayout } from "./pages/moderator/ModeratorLayout";
import { ModeratorDashboard } from "./pages/moderator/ModeratorDashboard";
import { ModeratorDisputes } from "./pages/moderator/ModeratorDisputes";

const queryClient = new QueryClient();

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  useThemeInit();
  useOnlineStatus();
  useRealtimeWallets();
  
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route
        path="/wallet/deposit"
        element={
          <ProtectedRoute>
            <WalletDeposit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet/withdraw"
        element={
          <ProtectedRoute>
            <WalletWithdraw />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile-setup"
        element={
          <ProtectedRoute>
            <ProfileSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create-offer"
        element={
          <ProtectedRoute>
            <CreateOffer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trade/:id"
        element={
          <ProtectedRoute>
            <Trade />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trades"
        element={
          <ProtectedRoute>
            <Trades />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/edit"
        element={
          <ProtectedRoute>
            <EditProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/kyc"
        element={
          <ProtectedRoute>
            <KYCUpload />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-offers"
        element={
          <ProtectedRoute>
            <MyOffers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/offer-analytics"
        element={
          <ProtectedRoute>
            <OfferAnalytics />
          </ProtectedRoute>
        }
      />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="offers" element={<AdminOffers />} />
        <Route path="trades" element={<AdminTrades />} />
        <Route path="wallets" element={<AdminWallets />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="deposits" element={<AdminDeposits />} />
        <Route path="fees" element={<AdminFees />} />
        <Route path="escrow" element={<AdminEscrow />} />
        <Route path="kyc" element={<AdminKYC />} />
        <Route path="disputes" element={<AdminDisputes />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="security" element={<AdminSecurity />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="treasury" element={<AdminTreasury />} />
        <Route path="moderation" element={<AdminModeration />} />
        <Route path="payment-methods" element={<AdminPaymentMethods />} />
        <Route path="roles" element={<AdminRoles />} />
        <Route path="support" element={<AdminSupport />} />
      </Route>
      <Route path="/moderator" element={<ModeratorLayout />}>
        <Route index element={<ModeratorDashboard />} />
        <Route path="disputes" element={<ModeratorDisputes />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <MobileBottomNav />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
