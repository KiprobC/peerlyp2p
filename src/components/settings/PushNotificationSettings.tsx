import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export const PushNotificationSettings = () => {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!supported) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellOff className="h-4 w-4" /> Push notifications unavailable
          </CardTitle>
          <CardDescription>
            Open Peerly in your installed app or a supported browser to enable push alerts.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" /> Push notifications
        </CardTitle>
        <CardDescription>
          Get instant alerts for trades, deposits, disputes and moderator actions — even when Peerly is closed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {subscribed ? (
          <Button variant="outline" disabled={loading} onClick={() => unsubscribe()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Disable on this device
          </Button>
        ) : (
          <Button disabled={loading || permission === "denied"} onClick={() => subscribe()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {permission === "denied" ? "Blocked by browser" : "Enable push notifications"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
