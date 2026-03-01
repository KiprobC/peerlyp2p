import { Bell, Check, CheckCheck, Star, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

export const NotificationPopover = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const navigate = useNavigate();

  const getTypeColor = (type: string, needsRating?: boolean) => {
    if (needsRating) return "bg-accent/15 text-accent";
    switch (type) {
      case "trade": return "bg-primary/15 text-primary";
      case "payment": return "bg-green-500/15 text-green-500";
      case "kyc": return "bg-blue-500/15 text-blue-500";
      case "system": return "bg-warning/15 text-warning";
      case "message": return "bg-purple-500/15 text-purple-500";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) markAsRead(notification.id);
    const data = notification.data as Record<string, any> | null;
    if (data?.action === "complete_profile") { navigate("/profile-setup"); return; }
    switch (notification.type) {
      case "trade":
      case "message":
        if (data?.trade_id) navigate(`/trade/${data.trade_id}`);
        else navigate("/trades");
        break;
      case "payment": navigate("/dashboard"); break;
      case "kyc":
        if (data?.status === "rejected" || data?.status === "pending") navigate("/kyc-upload");
        else navigate("/profile");
        break;
      default: navigate("/dashboard"); break;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4.5 min-w-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-2xl" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7 text-primary">
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[280px]">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div>
              {notifications.slice(0, 10).map((notification) => {
                const data = notification.data as Record<string, any> | null;
                const needsRating = data?.needs_rating === true;
                const needsProfileSetup = data?.action === "complete_profile";
                
                return (
                  <div
                    key={notification.id}
                    className={`px-3 py-2.5 hover:bg-secondary/40 cursor-pointer transition-colors ${
                      !notification.read ? "bg-primary/5" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getTypeColor(notification.type, needsRating)}`}>
                        {needsRating ? "rate" : needsProfileSetup ? "action" : notification.type}
                      </span>
                      {needsRating && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-accent/50 text-accent gap-1 rounded-full">
                          <Star className="h-2.5 w-2.5 fill-accent" /> Rate
                        </Badge>
                      )}
                      {needsProfileSetup && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-primary/50 text-primary gap-1 rounded-full">
                          <UserPlus className="h-2.5 w-2.5" /> Setup
                        </Badge>
                      )}
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-primary ml-auto flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="font-medium text-sm mt-1">{notification.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
                    {needsProfileSetup && (
                      <Button size="sm" className="mt-2 h-7 text-xs rounded-full" onClick={(e) => { e.stopPropagation(); handleNotificationClick(notification); }}>
                        <UserPlus className="w-3 h-3 mr-1" /> Complete Profile
                      </Button>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
