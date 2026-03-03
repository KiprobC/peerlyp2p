import { Link } from "react-router-dom";
import { AlertTriangle, Shield, Clock, Ban, CreditCard, TrendingUp, Globe, Lock, Power } from "lucide-react";
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
          description: result.message || "Your current verification level does not allow this action. Please complete KYC verification to continue.",
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
      case "PAYMENT_METHOD_RESTRICTED":
        return {
          icon: CreditCard,
          title: "Payment Method Restricted",
          description: result.message || "This payment method is not available for your account. Upgrade your verification to unlock more options.",
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
          description: result.message || "The trade amount exceeds your current limit. Upgrade your verification to increase your limits.",
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
          description: result.message || `You've reached your ${isDaily ? "daily" : "monthly"} trading limit. Upgrade your verification for higher limits, or try again ${isDaily ? "tomorrow" : "next month"}.`,
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
          description: result.message || "You've reached the maximum number of trades allowed today. Please try again tomorrow or upgrade your verification.",
          variant: "default" as const,
          action: (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <Link to="/kyc-upload">
                Upgrade for More Trades
              </Link>
            </Button>
          ),
        };
      
      case "MAX_OFFERS_REACHED":
        return {
          icon: Ban,
          title: "Maximum Offers Reached",
          description: result.message || "You've reached the maximum number of active offers. Deactivate or complete existing offers to create new ones.",
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
          title: "Too Many Requests",
          description: result.message || "You're making requests too quickly. Please wait a moment before trying again.",
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

      case "KYC_LIMIT_EXCEEDED":
        return {
          icon: Shield,
          title: "Verification Upgrade Required",
          description: result.message || "Your current verification level does not support this trade amount. Please upgrade your KYC to continue.",
          variant: "destructive" as const,
          action: (
            <Button asChild size="sm" className="gap-1">
              <Link to="/kyc-upload">
                <Shield className="w-3 h-3" />
                Upgrade Verification
              </Link>
            </Button>
          ),
        };

      case "COUNTRY_RESTRICTED":
        return {
          icon: Globe,
          title: "Region Restricted",
          description: result.message || "Trading is not available in your region, or your verification level doesn't meet the minimum requirement for your country.",
          variant: "destructive" as const,
          action: (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <Link to="/kyc-upload">
                <Shield className="w-3 h-3" />
                Verify Identity
              </Link>
            </Button>
          ),
        };

      case "USER_FROZEN":
        return {
          icon: Lock,
          title: "Account Restricted",
          description: result.message || "Your account has been temporarily restricted. Please contact support for assistance.",
          variant: "destructive" as const,
          action: null,
        };

      case "PLATFORM_DISABLED":
      case "OFFER_CREATION_DISABLED":
      case "TRADE_INITIATION_DISABLED":
      case "ESCROW_DISABLED":
      case "TRANSFERS_DISABLED":
        return {
          icon: Power,
          title: "Temporarily Unavailable",
          description: result.message || "This feature is temporarily disabled for maintenance. Please try again later.",
          variant: "default" as const,
          action: null,
        };

      case "VALIDATION_ERROR":
      case "NETWORK_ERROR":
      case "SERVER_ERROR":
        return {
          icon: AlertTriangle,
          title: "Something Went Wrong",
          description: result.message || "We couldn't process your request. Please check your connection and try again.",
          variant: "destructive" as const,
          action: onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try Again
            </Button>
          ),
        };
      
      default:
        return {
          icon: AlertTriangle,
          title: "Action Not Allowed",
          description: result.message || "This action cannot be completed right now. Please verify your account or contact support if the issue persists.",
          variant: "destructive" as const,
          action: (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <Link to="/kyc-upload">
                <Shield className="w-3 h-3" />
                Check Verification
              </Link>
            </Button>
          ),
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
        <p>{details.description}</p>
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
