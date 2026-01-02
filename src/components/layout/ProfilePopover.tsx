import { Link } from "react-router-dom";
import { User, Settings, LogOut, Wallet, FileText, Shield, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useAdminRole } from "@/hooks/useAdmin";
import { Separator } from "@/components/ui/separator";

export const ProfilePopover = () => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { isAdmin } = useAdminRole();

  const getInitials = (username: string | null) => {
    if (!username) return "U";
    return username.slice(0, 2).toUpperCase();
  };

  const getVerificationBadge = () => {
    if (profile?.is_verified) {
      return <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">Verified</span>;
    }
    if (profile?.kyc_status === "submitted") {
      return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500">Pending</span>;
    }
    return <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Unverified</span>;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(profile?.username)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(profile?.username)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">@{profile?.username || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {getVerificationBadge()}
            {isAdmin && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">Admin</span>
            )}
          </div>
        </div>
        
        <Separator />
        
        <div className="p-2">
          <Link to="/profile">
            <Button variant="ghost" className="w-full justify-start h-9" size="sm">
              <User className="h-4 w-4 mr-2" />
              My Profile
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="ghost" className="w-full justify-start h-9" size="sm">
              <Wallet className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Link to="/trades">
            <Button variant="ghost" className="w-full justify-start h-9" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              My Trades
            </Button>
          </Link>
          <Link to="/my-offers">
            <Button variant="ghost" className="w-full justify-start h-9" size="sm">
              <Tag className="h-4 w-4 mr-2" />
              My Offers
            </Button>
          </Link>
          <Link to="/settings">
            <Button variant="ghost" className="w-full justify-start h-9" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
          {isAdmin && (
            <Link to="/admin">
              <Button variant="ghost" className="w-full justify-start h-9" size="sm">
                <Shield className="h-4 w-4 mr-2" />
                Admin Panel
              </Button>
            </Link>
          )}
        </div>
        
        <Separator />
        
        <div className="p-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start h-9 text-destructive hover:text-destructive hover:bg-destructive/10" 
            size="sm"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
