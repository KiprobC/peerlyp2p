import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Bell,
  CheckCircle,
  DollarSign,
  MessageSquare,
  Shield,
  Settings,
  Star,
  UserPlus,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

const iconMap: Record<string, typeof Bell> = {
  trade: DollarSign,
  payment: DollarSign,
  kyc: Shield,
  system: Settings,
  message: MessageSquare,
  rate: Star,
};

const Notifications = () => {
  const { notifications, loading, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Navigate based on notification type and data
    const data = notification.data as Record<string, any> | null;
    
    // Handle special actions first
    if (data?.action === "complete_profile") {
      navigate("/profile-setup");
      return;
    }
    
    switch (notification.type) {
      case "trade":
      case "message":
        if (data?.trade_id) {
          navigate(`/trade/${data.trade_id}`);
        } else {
          navigate("/trades");
        }
        break;
      case "payment":
        if (data?.transfer_id || notification.title?.toLowerCase().includes("transfer")) {
          navigate("/wallet/history");
        } else {
          navigate("/wallet-deposit");
        }
        break;
      case "kyc":
        if (data?.status === "rejected" || data?.status === "pending") {
          navigate("/kyc-upload");
        } else {
          navigate("/profile");
        }
        break;
      case "system":
      default:
        navigate("/dashboard");
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-lg font-semibold ml-2">Notifications</h1>
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-24 md:pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const data = notification.data as Record<string, any> | null;
                const needsRating = data?.needs_rating === true;
                const needsProfileSetup = data?.action === "complete_profile";
                const Icon = needsRating ? Star : needsProfileSetup ? UserPlus : (iconMap[notification.type] || Bell);
                
                return (
                  <div
                    key={notification.id}
                    className={`glass-card cursor-pointer transition-all ${
                      !notification.read ? "border-primary/30 bg-primary/5" : ""
                    } ${needsRating ? "border-accent/30" : ""} ${needsProfileSetup ? "border-primary/50" : ""}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          needsRating ? "bg-accent/20" : needsProfileSetup ? "bg-primary/20" : (!notification.read ? "bg-primary/20" : "bg-secondary")
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 ${
                            needsRating ? "text-accent fill-accent" : needsProfileSetup ? "text-primary" : (!notification.read ? "text-primary" : "text-muted-foreground")
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              className={`font-medium ${
                                !notification.read ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {notification.title}
                            </h3>
                            {needsRating && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-accent/50 text-accent gap-1">
                                <Star className="h-2.5 w-2.5 fill-accent" />
                                Rate now
                              </Badge>
                            )}
                          </div>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-2" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        {needsProfileSetup && (
                          <Button
                            size="sm"
                            className="mt-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notification);
                            }}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Complete Profile
                          </Button>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No notifications yet</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Notifications;
