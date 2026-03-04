import { useState, useEffect } from "react";
import {
  Shield, Star, Clock, TrendingUp, AlertTriangle, CreditCard,
  Heart, Ban, ChevronRight, Users, BarChart3, Timer, Percent,
  CheckCircle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTraderProfile } from "@/hooks/useTraderProfile";
import { isUserOnline } from "@/hooks/useOnlineStatus";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface TraderProfilePanelProps {
  targetUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TraderProfilePanel = ({ targetUserId, open, onOpenChange }: TraderProfilePanelProps) => {
  const isMobile = useIsMobile();
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

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
    : 0;

  const content = loading ? (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  ) : profile ? (
    <ScrollArea className="h-full">
      <div className="pb-8">
        {/* Header */}
        <div className="p-5 text-center">
          <div className="relative mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden mb-3">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary font-bold text-2xl">
                {profile.username?.charAt(0)?.toUpperCase() || "?"}
              </span>
            )}
            <div className={cn(
              "absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2 border-card",
              online ? "bg-green-500" : "bg-muted-foreground/40"
            )} />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <h3 className="font-semibold text-lg">@{profile.username || "Anonymous"}</h3>
            {profile.is_verified && <Shield className="w-4 h-4 text-primary" />}
          </div>
          {profile.full_name && (
            <p className="text-sm text-muted-foreground">{profile.full_name}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {online ? (
              <span className="text-green-500 font-medium">Online</span>
            ) : profile.last_seen ? (
              <>Last seen {formatDistanceToNow(new Date(profile.last_seen), { addSuffix: true })}</>
            ) : (
              "Offline"
            )}
            {" · "}Member since {format(new Date(profile.created_at), "MMM yyyy")}
          </p>
        </div>

        <Separator />

        {/* Trust & Performance Metrics */}
        <div className="p-5">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Performance
          </h4>
          <div className="grid grid-cols-2 gap-3">
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
              sub={reviews.length > 0 ? `${reviews.length} reviews` : undefined}
            />
          </div>
        </div>

        <Separator />

        {/* Reviews */}
        <div className="p-5">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" /> Reviews ({reviews.length})
          </h4>
          <Tabs value={reviewTab} onValueChange={setReviewTab}>
            <TabsList className="w-full h-8 mb-3">
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
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {filteredReviews.map(review => (
                    <div key={review.id} className="bg-secondary/40 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          @{review.rater_username || "Anonymous"}
                        </span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn("w-3 h-3", i < review.rating
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-muted-foreground/30"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-xs text-muted-foreground line-clamp-3">{review.comment}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No reviews yet</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <Separator />

        {/* Payment Methods */}
        {paymentMethods.length > 0 && (
          <>
            <div className="p-5">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
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
        <div className="p-5 space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Actions
          </h4>
          <Button
            variant={isTrusted ? "default" : "outline"}
            className="w-full justify-between rounded-xl"
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
            className="w-full justify-between rounded-xl"
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
    </ScrollArea>
  ) : (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      Profile not found
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="pb-0">
              <DrawerTitle className="text-center">Trader Profile</DrawerTitle>
            </DrawerHeader>
            {content}
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent className="w-[400px] sm:w-[420px] p-0">
            <SheetHeader className="p-5 pb-0">
              <SheetTitle>Trader Profile</SheetTitle>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      )}

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

// Small metric card component
const MetricCard = ({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) => (
  <div className="bg-secondary/40 rounded-xl p-3 flex items-center gap-2.5">
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
