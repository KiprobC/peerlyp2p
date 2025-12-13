import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

export const NotificationPopover = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();

  const getTypeColor = (type: string) => {
    switch (type) {
      case "trade": return "bg-primary/20 text-primary";
      case "payment": return "bg-green-500/20 text-green-500";
      case "kyc": return "bg-blue-500/20 text-blue-500";
      case "system": return "bg-yellow-500/20 text-yellow-500";
      case "message": return "bg-purple-500/20 text-purple-500";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-xs h-7"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 hover:bg-secondary/50 cursor-pointer transition-colors ${
                    !notification.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(notification.type)}`}>
                      {notification.type}
                    </span>
                    {!notification.read && (
                      <span className="h-2 w-2 rounded-full bg-primary ml-auto flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="font-medium text-sm mt-1">{notification.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
