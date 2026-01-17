import { Link } from "react-router-dom";
import { AlertTriangle, Shield, Clock, Ban, CreditCard, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ValidationResult, formatLimit, getTierInfo, KYCTier } from "@/hooks/useKYCLimits";
import { cn } from "@/lib/utils";

interface KYCLimitErrorProps {
  result: ValidationResult;
  className?: string;
  onRetry?: () => void;
}

export function KYCLimitError({ result, className, onRetry }: KYCLimitErrorProps) {
  if (result.allowed) return null;

  const getErrorDetails = () => {
    switch (result.error_code) {
      case "BUY_OFFERS_NOT_ALLOWED":
      case "SELL_OFFERS_NOT_ALLOWED":
        return {
          icon: Ban,
          title: "Verification Required",
          variant: "destructive" as const,
          action: (
            <Button asChild size="sm" className="gap-1">
              <Link to="/kyc-upload">
                <Shield className="w-3 h-3" />
                Complete Verification
              </Link>
            </Button>
          ),
        };
      
      case "PAYMENT_METHOD_NOT_ALLOWED":
        return {
          icon: CreditCard,
          title: "Payment Method Restricted",
          variant: "default" as const,
          extra: result.allowed_methods && (
            <p className="text-xs mt-1 text-muted-foreground">
              Available methods: {result.allowed_methods.join(", ")}
            </p>
          ),
          action: (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <Link to="/kyc-upload">
                <Shield className="w-3 h-3" />
                Upgrade to Unlock
              </Link>
            </Button>
          ),
        };
      
      case "AMOUNT_EXCEEDS_LIMIT":
        return {
          icon: TrendingUp,
          title: "Amount Limit Exceeded",
          variant: "default" as const,
          extra: result.max_allowed && (
            <p className="text-xs mt-1">
              Your limit: <span className="font-semibold text-primary">{formatLimit(result.max_allowed)}</span>
            </p>
          ),
          action: (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <Link to="/kyc-upload">
                Increase Limits
              </Link>
            </Button>
          ),
        };
      
      case "DAILY_LIMIT_EXCEEDED":
      case "MONTHLY_LIMIT_EXCEEDED":
        const isDaily = result.error_code === "DAILY_LIMIT_EXCEEDED";
        return {
          icon: Clock,
          title: isDaily ? "Daily Limit Reached" : "Monthly Limit Reached",
          variant: "default" as const,
          extra: (
            <p className="text-xs mt-1 text-muted-foreground">
              Used: {formatLimit(result.current_usage || 0)} / {formatLimit(isDaily ? result.daily_limit || 0 : result.monthly_limit || 0)}
            </p>
          ),
          action: (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <Link to="/kyc-upload">
                Upgrade for Higher Limits
              </Link>
            </Button>
          ),
        };
      
      case "DAILY_TRADE_COUNT_EXCEEDED":
        return {
          icon: Clock,
          title: "Daily Trade Count Reached",
          variant: "default" as const,
          action: null,
        };
      
      case "MAX_OFFERS_REACHED":
        return {
          icon: Ban,
          title: "Maximum Offers Reached",
          variant: "default" as const,
          action: (
            <Button asChild size="sm" variant="outline">
              <Link to="/my-offers">Manage Offers</Link>
            </Button>
          ),
        };
      
      case "RATE_LIMITED":
        return {
          icon: Clock,
          title: "Please Wait",
          variant: "default" as const,
          extra: result.retry_after && (
            <p className="text-xs mt-1 text-muted-foreground">
              Try again in {Math.ceil(result.retry_after)} seconds
            </p>
          ),
          action: onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          ),
        };
      
      default:
        return {
          icon: AlertTriangle,
          title: "Action Not Allowed",
          variant: "destructive" as const,
          action: null,
        };
    }
  };

  const details = getErrorDetails();
  const Icon = details.icon;

  return (
    <Alert variant={details.variant} className={cn("", className)}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{details.title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{result.message}</p>
        {details.extra}
        {result.required_tier && (
          <p className="text-xs">
            Required: <span className={getTierInfo(result.required_tier).color}>
              {getTierInfo(result.required_tier).icon} {getTierInfo(result.required_tier).label}
            </span>
          </p>
        )}
        {details.action && <div className="mt-2">{details.action}</div>}
      </AlertDescription>
    </Alert>
  );
}