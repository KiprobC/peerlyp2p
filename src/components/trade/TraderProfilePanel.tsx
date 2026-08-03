import { useState, useEffect } from "react";
import {
  Shield, Star, Clock, TrendingUp, AlertTriangle, CreditCard,
  Heart, Ban, ChevronLeft, Users, BarChart3, Timer, Percent,
  CheckCircle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTraderProfile } from "@/hooks/useTraderProfile";
import { isUserOnline } from "@/hooks/useOnlineStatus";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTraderRisk } from "@/hooks/useTraderRisk";

const riskConfig: Record<string, { label: string; color: string; emoji: string }> = {
  trusted: { label: "Trusted", color: "text-green-500", emoji: "🟢" },
  normal: { label: "Normal", color: "text-yellow-500", emoji: "🟡" },
  watchlist: { label: "Watchlist", color: "text-orange-500", emoji: "🟠" },
  high_risk: { label: "High Risk", color: "text-destructive", emoji: "🔴" },
};

const RiskBadge = ({ userId }: { userId: string }) => {
  const { riskData } = useTraderRisk(userId);
  if (!riskData || riskData.total_trades < 3) return null;
  const config = riskConfig[riskData.risk_level] || riskConfig.normal;
  return (
    <div className={cn("flex items-center gap-1 text-xs font-medium mt-0.5", config.color)}>
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </div>
  );
};

interface TraderProfilePanelProps {
  targetUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TraderProfilePanel = ({ targetUserId, open, onOpenChange }: TraderProfilePanelProps) => {
  const {
    profile, metrics, reviews, paymentMethods,
    isTrusted, isBlocked, loading,
    fetchAll, toggleTrust, toggleBlock,
  } = useTraderProfile();

  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState("all");

  useEffect(() => {
    if (open && targetUserId) {
      fetchAll(targetUserId);
    }
  }, [open, targetUserId, fetchAll]);

  const online = profile ? isUserOnline(profile.last_seen) : false;

  const filteredReviews = reviews.filter(r => {
    if (reviewTab === "positive") return r.rating >= 4;
    if (reviewTab === "neutral") return r.rating === 3;
    if (reviewTab === "negative") return r.rating <= 2;
    return true;
  });

  const avgRating = metrics?.avgRating || 0;
  const ratingCount = metrics?.ratingCount || 0;

  if (!open) return null;

  return (
    <>
      {/* Full-page overlay */}
      <div className="fixed inset-0 z-[60] bg-background flex flex-col overflow-hidden animate-in slide-in-from-right-full duration-200">
        {/* Sticky header */}
        <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border/40">
          <div className="container mx-auto px-4 max-w-2xl">
            <div className="flex items-center h-14 gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full"
                onClick={() => onOpenChange(false)}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h1 className="font-semibold text-lg">Trader Profile</h1>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          ) : profile ? (
            <div className="container mx-auto px-4 max-w-2xl pb-12">
              {/* Header */}
              <div className="py-8 text-center">
                <div className="relative mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden mb-4">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary font-bold text-3xl">
                      {profile.username?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  )}
                  <div className={cn(
                    "absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-background",
                    online ? "bg-green-500" : "bg-muted-foreground/40"
                  )} />
                </div>
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <h2 className="font-bold text-xl">@{profile.username || "Anonymous"}</h2>
                  {profile.is_verified && <Shield className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <RiskBadge userId={targetUserId} />
                  {isTrusted && (
                    <Badge
                      title="You marked this trader as trusted. Trusted traders are highlighted in your marketplace."
                      className="gap-1.5 rounded-xl px-3 py-1 text-xs font-semibold bg-green-500/15 text-green-500 border border-green-500/30 hover:bg-green-500/20"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                      Trusted
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2" title={`Joined ${format(new Date(profile.created_at), "d MMM yyyy")}`}>
                  {online ? (
                    <span className="text-green-500 font-medium">Online now</span>
                  ) : profile.last_seen ? (
                    <>Active {formatDistanceToNow(new Date(profile.last_seen), { addSuffix: true })}</>
                  ) : (
                    "Offline"
                  )}
                  {" · "}Account age: {formatAccountAge(profile.created_at)}
                </p>

              </div>

              <Separator />

              {/* Performance Metrics */}
              <div className="py-6">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Performance
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricCard
                    icon={<CheckCircle className="w-4 h-4 text-green-500" />}
                    label="Completion"
                    value={`${metrics?.completionRate || 0}%`}
                  />
                  <MetricCard
                    icon={<TrendingUp className="w-4 h-4 text-primary" />}
                    label="Trades"
                    value={`${metrics?.completedTrades || 0}`}
                    sub={`of ${metrics?.totalTrades || 0}`}
                  />
                  <MetricCard
                    icon={<Users className="w-4 h-4 text-muted-foreground" />}
                    label="Volume"
                    value={`${(metrics?.totalVolume || 0).toLocaleString()}`}
                    sub={metrics?.volumeCurrency}
                  />
                  <MetricCard
                    icon={<Timer className="w-4 h-4 text-accent" />}
                    label="Avg Release"
                    value={metrics?.avgReleaseTimeMinutes != null
                      ? metrics.avgReleaseTimeMinutes < 60
                        ? `${metrics.avgReleaseTimeMinutes}m`
                        : `${Math.round(metrics.avgReleaseTimeMinutes / 60)}h`
                      : "N/A"}
                  />
                  <MetricCard
                    icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
                    label="Dispute Rate"
                    value={`${metrics?.disputeRate || 0}%`}
                  />
                  <MetricCard
                    icon={<Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    label="Rating"
                    value={avgRating > 0 ? avgRating.toFixed(1) : "N/A"}
                    sub={ratingCount > 0
                      ? `${metrics?.uniqueReviewers ?? ratingCount} trader${(metrics?.uniqueReviewers ?? ratingCount) === 1 ? "" : "s"}`
                      : undefined}
                  />
                </div>
              </div>

              <Separator />

              {/* Reviews */}
              <div className="py-6">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" /> Reviews ({metrics?.uniqueReviewers ?? reviews.length})
                </h4>
                <p className="text-xs text-muted-foreground -mt-2 mb-4">
                  One review per trader — repeat trades don&apos;t inflate scores.
                </p>
                <Tabs value={reviewTab} onValueChange={setReviewTab}>
                  <TabsList className="w-full h-9 mb-4">
                    <TabsTrigger value="all" className="text-xs flex-1">All</TabsTrigger>
                    <TabsTrigger value="positive" className="text-xs flex-1">
                      Positive ({reviews.filter(r => r.rating >= 4).length})
                    </TabsTrigger>
                    <TabsTrigger value="neutral" className="text-xs flex-1">
                      Neutral ({reviews.filter(r => r.rating === 3).length})
                    </TabsTrigger>
                    <TabsTrigger value="negative" className="text-xs flex-1">
                      Negative ({reviews.filter(r => r.rating <= 2).length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value={reviewTab} className="mt-0">
                    {filteredReviews.length > 0 ? (
                      <div className="space-y-3">
                        {filteredReviews.map(review => (
                          <div key={review.id} className="bg-secondary/40 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium">
                                @{review.rater_username || "Anonymous"}
                              </span>
                              <div className="flex gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={cn("w-3.5 h-3.5", i < review.rating
                                      ? "text-yellow-500 fill-yellow-500"
                                      : "text-muted-foreground/30"
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                            {review.comment && (
                              <p className="text-sm text-muted-foreground">{review.comment}</p>
                            )}
                            <p className="text-xs text-muted-foreground/60 mt-1.5">
                              {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No reviews yet</p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              <Separator />

              {/* Payment Methods */}
              {paymentMethods.length > 0 && (
                <>
                  <div className="py-6">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Payment Methods
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {paymentMethods.map(pm => (
                        <Badge key={pm.name} variant="secondary" className="rounded-xl px-3 py-1.5 text-xs">
                          {pm.display_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* User Controls */}
              <div className="py-6 space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Actions
                </h4>
                <Button
                  variant={isTrusted ? "default" : "outline"}
                  className="w-full justify-between rounded-xl h-12"
                  onClick={() => toggleTrust(targetUserId)}
                >
                  <span className="flex items-center gap-2">
                    <Heart className={cn("w-4 h-4", isTrusted && "fill-current")} />
                    {isTrusted ? "Trusted" : "Trust User"}
                  </span>
                  {isTrusted && <CheckCircle className="w-4 h-4" />}
                </Button>
                <Button
                  variant={isBlocked ? "destructive" : "outline"}
                  className="w-full justify-between rounded-xl h-12"
                  onClick={() => {
                    if (isBlocked) {
                      toggleBlock(targetUserId);
                    } else {
                      setBlockConfirmOpen(true);
                    }
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Ban className="w-4 h-4" />
                    {isBlocked ? "Blocked" : "Block User"}
                  </span>
                  {isBlocked && <X className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Profile not found
            </div>
          )}
        </div>
      </div>

      {/* Block confirmation */}
      <AlertDialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block this trader?</AlertDialogTitle>
            <AlertDialogDescription>
              This trader won't be able to create trades with you or see your offers. You can unblock them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                toggleBlock(targetUserId);
                setBlockConfirmOpen(false);
              }}
            >
              Block User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const MetricCard = ({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) => (
  <div className="bg-secondary/40 rounded-xl p-3.5 flex items-center gap-2.5">
    {icon}
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm leading-tight">
        {value}
        {sub && <span className="text-xs text-muted-foreground font-normal ml-1">{sub}</span>}
      </p>
    </div>
  </div>
);
