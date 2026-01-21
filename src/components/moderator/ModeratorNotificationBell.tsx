import { Bell, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useModeratorNotifications } from "@/hooks/useModeratorNotifications";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const priorityStyles: Record<string, string> = {
  high: "bg-destructive/20 text-destructive border-destructive/30",
  medium: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  low: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  normal: "bg-muted text-muted-foreground border-border",
};

export const ModeratorNotificationBell = () => {
  const { notifications, unreadCount, markAsViewed, loading } = useModeratorNotifications();
  const navigate = useNavigate();

  const handleClick = (notification: any) => {
    markAsViewed(notification.id);
    navigate(`/trade/${notification.trade_id}`);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-blue-500/10 to-violet-500/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h4 className="font-semibold">Dispute Assignments</h4>
          </div>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="bg-destructive/20 text-destructive">
              {unreadCount} pending
            </Badge>
          )}
        </div>
        <ScrollArea className="h-[350px]">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">
              <Clock className="h-6 w-6 mx-auto mb-2 animate-spin" />
              <p className="text-sm">Loading assignments...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">All caught up!</p>
              <p className="text-sm mt-1">No pending disputes assigned to you.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 hover:bg-secondary/50 cursor-pointer transition-colors"
                  onClick={() => handleClick(notification)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs capitalize",
                            priorityStyles[notification.priority || "normal"]
                          )}
                        >
                          {notification.priority || "normal"} priority
                        </Badge>
                      </div>
                      
                      {notification.trade && (
                        <p className="font-medium text-sm">
                          {notification.trade.crypto_amount} {notification.trade.crypto_type} / {notification.trade.fiat_currency} {notification.trade.fiat_amount.toLocaleString()}
                        </p>
                      )}
                      
                      {notification.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.notes}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    
                    <Button size="sm" variant="ghost" className="shrink-0">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="p-3 border-t border-border bg-muted/30">
            <Button 
              variant="outline" 
              className="w-full" 
              size="sm"
              onClick={() => navigate("/moderator/disputes")}
            >
              View All Disputes
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
