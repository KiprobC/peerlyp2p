import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, ShieldCheck, ShieldX, Clock, Edit, Camera } from "lucide-react";
import { Profile } from "@/hooks/useProfile";
import { Link } from "react-router-dom";
import { MFAStatusBadge } from "@/components/mfa/MFAStatusBadge";
import { useMFA } from "@/hooks/useMFA";

interface ProfileHeaderProps {
  profile: Profile | null;
  onEditPhoto?: () => void;
}

const kycStatusConfig = {
  pending: { label: "Unverified", icon: Shield, variant: "secondary" as const, color: "text-muted-foreground" },
  submitted: { label: "Pending Review", icon: Clock, variant: "outline" as const, color: "text-warning" },
  verified: { label: "Verified", icon: ShieldCheck, variant: "default" as const, color: "text-primary" },
  rejected: { label: "Rejected", icon: ShieldX, variant: "destructive" as const, color: "text-destructive" },
};

export const ProfileHeader = ({ profile, onEditPhoto }: ProfileHeaderProps) => {
  const kycStatus = profile?.kyc_status || "pending";
  const statusConfig = kycStatusConfig[kycStatus];
  const StatusIcon = statusConfig.icon;
  const { isEnabled: mfaEnabled, loading: mfaLoading } = useMFA();

  return (
    <div className="glass-card">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* Avatar */}
        <div className="relative group">
          <Avatar className="w-24 h-24 border-4 border-primary/20">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.username || "User"} />
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
              {profile?.username?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          {onEditPhoto && (
            <button
              onClick={onEditPhoto}
              className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* User Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">@{profile?.username || "User"}</h1>
            <Badge variant={statusConfig.variant} className="flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </Badge>
            {!mfaLoading && <MFAStatusBadge enabled={mfaEnabled} />}
          </div>
          
          {profile?.full_name && (
            <p className="text-lg text-muted-foreground mb-1">{profile.full_name}</p>
          )}
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>{profile?.email}</span>
            {profile?.phone && <span>•</span>}
            {profile?.phone && <span>{profile.phone}</span>}
          </div>

          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-primary font-semibold">{profile?.total_trades || 0}</span>
              <span className="text-muted-foreground">trades</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-primary font-semibold">⭐ {profile?.rating?.toFixed(1) || "0.0"}</span>
              <span className="text-muted-foreground">rating</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link to="/profile/edit">
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </Link>
          {kycStatus !== "verified" && (
            <Link to="/profile/kyc">
              <Button variant="default" size="sm">
                <Shield className="w-4 h-4 mr-2" />
                {kycStatus === "pending" ? "Verify Now" : "Update KYC"}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
