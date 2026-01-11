import { AlertTriangle, Shield, Lock, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Alert {
  id: string;
  type: "warning" | "error" | "info";
  title: string;
  description: string;
  link?: string;
  linkText?: string;
  icon?: typeof AlertTriangle;
}

interface AdminAlertsProps {
  pendingKYC: number;
  disputedTrades: number;
  largeEscrowThreshold?: number;
  totalEscrowLocked: number;
  failedTransactions?: number;
}

export const AdminAlerts = ({
  pendingKYC,
  disputedTrades,
  largeEscrowThreshold = 1,
  totalEscrowLocked,
  failedTransactions = 0,
}: AdminAlertsProps) => {
  const alerts: Alert[] = [];

  // KYC backlog alert
  if (pendingKYC >= 5) {
    alerts.push({
      id: "kyc-backlog",
      type: pendingKYC >= 10 ? "error" : "warning",
      title: `KYC Backlog: ${pendingKYC} pending`,
      description: "Users are waiting for identity verification. Process these to prevent delays.",
      link: "/admin/kyc",
      linkText: "Review KYC",
      icon: Shield,
    });
  }

  // Dispute alert
  if (disputedTrades > 0) {
    alerts.push({
      id: "disputes",
      type: disputedTrades >= 3 ? "error" : "warning",
      title: `${disputedTrades} Active Dispute${disputedTrades > 1 ? "s" : ""}`,
      description: "Trade disputes require immediate attention to prevent user escalation.",
      link: "/admin/disputes",
      linkText: "Resolve Disputes",
      icon: AlertTriangle,
    });
  }

  // Large escrow alert
  if (totalEscrowLocked >= largeEscrowThreshold) {
    alerts.push({
      id: "large-escrow",
      type: "info",
      title: `High Escrow Volume: ${totalEscrowLocked.toFixed(4)} BTC equivalent`,
      description: "Large amounts are currently locked in escrow. Monitor for any irregularities.",
      link: "/admin/escrow",
      linkText: "View Escrow",
      icon: Lock,
    });
  }

  // Failed transactions
  if (failedTransactions > 0) {
    alerts.push({
      id: "failed-tx",
      type: "warning",
      title: `${failedTransactions} Failed Transaction${failedTransactions > 1 ? "s" : ""}`,
      description: "Some transactions have failed and may need manual intervention.",
      link: "/admin/transactions",
      linkText: "View Transactions",
      icon: TrendingUp,
    });
  }

  if (alerts.length === 0) {
    return null;
  }

  const getAlertStyles = (type: Alert["type"]) => {
    switch (type) {
      case "error":
        return "border-destructive/50 bg-destructive/5";
      case "warning":
        return "border-yellow-500/50 bg-yellow-500/5";
      case "info":
        return "border-primary/50 bg-primary/5";
    }
  };

  const getBadgeVariant = (type: Alert["type"]) => {
    switch (type) {
      case "error":
        return "destructive" as const;
      case "warning":
        return "outline" as const;
      case "info":
        return "secondary" as const;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          Platform Alerts ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => {
          const Icon = alert.icon || AlertTriangle;
          return (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border ${getAlertStyles(alert.type)}`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${
                  alert.type === "error" ? "text-destructive" :
                  alert.type === "warning" ? "text-yellow-500" : "text-primary"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{alert.title}</span>
                    <Badge variant={getBadgeVariant(alert.type)} className="text-xs">
                      {alert.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.description}</p>
                  {alert.link && (
                    <Link to={alert.link}>
                      <Button variant="link" size="sm" className="px-0 mt-2 h-auto">
                        {alert.linkText} →
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};