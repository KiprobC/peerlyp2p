import { useState, useEffect } from "react";
import { Star, Shield, MapPin, Calendar, MessageSquare } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface TraderProfilePopoverProps {
  userId: string;
  children: React.ReactNode;
}

interface TraderProfile {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  country: string | null;
  rating: number | null;
  total_trades: number | null;
  is_verified: boolean | null;
  created_at: string;
}

interface TradeRating {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  rater_name: string | null;
}

export const TraderProfilePopover = ({ userId, children }: TraderProfilePopoverProps) => {
  const [profile, setProfile] = useState<TraderProfile | null>(null);
  const [ratings, setRatings] = useState<TradeRating[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTraderData = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url, country, rating, total_trades, is_verified, created_at")
        .eq("user_id", userId)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch recent ratings with rater names
      const { data: ratingsData } = await supabase
        .from("trade_ratings")
        .select("id, rating, comment, created_at, rater_id")
        .eq("rated_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (ratingsData && ratingsData.length > 0) {
        // Fetch rater names
        const raterIds = ratingsData.map(r => r.rater_id);
        const { data: ratersData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", raterIds);

        const raterMap = new Map(ratersData?.map(r => [r.user_id, r.full_name]) || []);

        setRatings(ratingsData.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          rater_name: raterMap.get(r.rater_id) || "Anonymous"
        })));
      }
    } catch (error) {
      console.error("Error fetching trader data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild onClick={fetchTraderData}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
        ) : profile ? (
          <div>
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary font-bold text-xl">
                      {profile.full_name?.charAt(0) || "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">
                      {profile.full_name || profile.username || "Anonymous"}
                    </span>
                    {profile.is_verified && (
                      <Shield className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  {profile.username && profile.full_name && (
                    <p className="text-sm text-muted-foreground">@{profile.username}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-4 border-b border-border grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <span className="text-sm">
                  <span className="font-semibold">{profile.rating?.toFixed(1) || "0.0"}</span>
                  <span className="text-muted-foreground"> rating</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-semibold">{profile.total_trades || 0}</span>
                  <span className="text-muted-foreground"> trades</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {profile.country || "Unknown"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(profile.created_at), { addSuffix: false })}
                </span>
              </div>
            </div>

            {/* Recent Reviews */}
            <div className="p-4">
              <h4 className="font-semibold text-sm mb-3">Recent Reviews</h4>
              {ratings.length > 0 ? (
                <ScrollArea className="h-[150px]">
                  <div className="space-y-3">
                    {ratings.map((review) => (
                      <div key={review.id} className="border-b border-border/50 pb-2 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{review.rater_name}</span>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < review.rating
                                    ? "text-accent fill-accent"
                                    : "text-muted-foreground"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {review.comment}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No reviews yet
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            Profile not found
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
