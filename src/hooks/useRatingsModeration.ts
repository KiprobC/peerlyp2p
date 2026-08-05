import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ModeratedRating {
  id: string;
  trade_id: string;
  rater_id: string;
  rated_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  rater_username?: string | null;
  rated_username?: string | null;
}

export interface ArchivedRating extends ModeratedRating {
  archived_at: string;
  archive_reason: string;
}

export const useRatingsModeration = () => {
  const [ratings, setRatings] = useState<ModeratedRating[]>([]);
  const [archived, setArchived] = useState<ArchivedRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const attachUsernames = async <T extends { rater_id: string | null; rated_id: string | null }>(
    rows: T[],
  ) => {
    const ids = [
      ...new Set(rows.flatMap((r) => [r.rater_id, r.rated_id]).filter(Boolean) as string[]),
    ];
    if (ids.length === 0) return rows.map((r) => ({ ...r }));
    const { data: profiles } = await (supabase as any)
      .from("public_profiles")
      .select("user_id, username")
      .in("user_id", ids);
    const map = new Map<string, string | null>(
      (profiles || []).map((p: any) => [p.user_id, p.username]),
    );
    return rows.map((r) => ({
      ...r,
      rater_username: r.rater_id ? map.get(r.rater_id) ?? null : null,
      rated_username: r.rated_id ? map.get(r.rated_id) ?? null : null,
    }));
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [live, gone] = await Promise.all([
        supabase
          .from("trade_ratings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        (supabase as any)
          .from("trade_ratings_archive")
          .select("*")
          .order("archived_at", { ascending: false })
          .limit(200),
      ]);
      if (live.error) throw live.error;
      setRatings((await attachUsernames((live.data || []) as any)) as ModeratedRating[]);
      setArchived((await attachUsernames((gone.data || []) as any)) as ArchivedRating[]);
    } catch (e) {
      console.error("Failed to load ratings", e);
      toast.error("Could not load ratings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const removeRating = useCallback(
    async (ratingId: string, reason: string) => {
      setWorking(true);
      try {
        const { error } = await (supabase.rpc as any)("admin_remove_rating", {
          p_rating_id: ratingId,
          p_reason: reason,
        });
        if (error) throw error;
        toast.success("Rating removed and reputation recalculated");
        await fetchAll();
        return true;
      } catch (e: any) {
        toast.error(e?.message ?? "Could not remove the rating");
        return false;
      } finally {
        setWorking(false);
      }
    },
    [fetchAll],
  );

  return { ratings, archived, loading, working, removeRating, refetch: fetchAll };
};

export default useRatingsModeration;
