import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Settings } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useWallets } from "@/hooks/useWallets";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileDetails } from "@/components/profile/ProfileDetails";
import { WalletSummary } from "@/components/profile/WalletSummary";
import { KYCStatus } from "@/components/profile/KYCStatus";

const Profile = () => {
  const { profile, loading: profileLoading } = useProfile();
  const { wallets, loading: walletsLoading } = useWallets();

  if (profileLoading || walletsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </nav>
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 max-w-4xl space-y-6">
            <Skeleton className="h-40 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
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
              <h1 className="text-xl font-bold">My Profile</h1>
            </div>
            <Link to="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-24 md:pb-16">
        <div className="container mx-auto px-4 max-w-4xl space-y-6">
          <ProfileHeader profile={profile} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProfileDetails profile={profile} />
            <div className="space-y-6">
              <WalletSummary wallets={wallets} />
              <KYCStatus profile={profile} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
