
-- 1. Archive duplicates
CREATE TABLE IF NOT EXISTS public.trade_ratings_archive (
  id uuid PRIMARY KEY,
  trade_id uuid,
  rater_id uuid,
  rated_id uuid,
  rating integer,
  comment text,
  created_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_reason text NOT NULL DEFAULT 'duplicate_reviewer_pair'
);
GRANT ALL ON public.trade_ratings_archive TO service_role;
ALTER TABLE public.trade_ratings_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view rating archive" ON public.trade_ratings_archive;
CREATE POLICY "Admins can view rating archive" ON public.trade_ratings_archive
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.trade_ratings_archive TO authenticated;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY rater_id, rated_id ORDER BY created_at ASC, id ASC) rn
  FROM public.trade_ratings
), dupes AS (
  SELECT r.* FROM public.trade_ratings r JOIN ranked k ON k.id = r.id WHERE k.rn > 1
)
INSERT INTO public.trade_ratings_archive (id, trade_id, rater_id, rated_id, rating, comment, created_at)
SELECT id, trade_id, rater_id, rated_id, rating, comment, created_at FROM dupes
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.trade_ratings r
USING public.trade_ratings_archive a
WHERE a.id = r.id;

-- 2. Enforce one review per reviewer/trader pair
CREATE UNIQUE INDEX IF NOT EXISTS trade_ratings_unique_reviewer_pair
  ON public.trade_ratings (rater_id, rated_id);

-- 3. Helper for the frontend
CREATE OR REPLACE FUNCTION public.has_reviewed_trader(p_rated_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trade_ratings
    WHERE rater_id = auth.uid() AND rated_id = p_rated_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_reviewed_trader(uuid) TO authenticated;

-- 4. Stats with unique reviewers + sentiment breakdown
CREATE OR REPLACE FUNCTION public.get_trader_public_stats(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_total_trades integer;
  v_completed_trades integer;
  v_disputed_trades integer;
  v_completion_rate integer;
  v_dispute_rate integer;
  v_total_volume numeric;
  v_volume_currency text;
  v_avg_release_minutes numeric;
  v_avg_rating numeric;
  v_rating_count integer;
  v_unique_reviewers integer;
  v_positive integer;
  v_neutral integer;
  v_negative integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status = 'completed'), count(*) FILTER (WHERE status = 'disputed')
  INTO v_total_trades, v_completed_trades, v_disputed_trades
  FROM trades WHERE buyer_id = p_user_id OR seller_id = p_user_id;

  v_completion_rate := CASE WHEN v_total_trades > 0 THEN round((v_completed_trades::numeric / v_total_trades) * 100) ELSE 0 END;
  v_dispute_rate := CASE WHEN v_total_trades > 0 THEN round((v_disputed_trades::numeric / v_total_trades) * 100) ELSE 0 END;

  SELECT coalesce(sum(fiat_amount), 0), coalesce(min(fiat_currency), 'KES')
  INTO v_total_volume, v_volume_currency
  FROM trades WHERE (buyer_id = p_user_id OR seller_id = p_user_id) AND status = 'completed';

  SELECT round(avg(EXTRACT(EPOCH FROM (completed_at - payment_confirmed_at)) / 60))
  INTO v_avg_release_minutes
  FROM trades
  WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
    AND status = 'completed' AND payment_confirmed_at IS NOT NULL AND completed_at IS NOT NULL
    AND completed_at > payment_confirmed_at
    AND EXTRACT(EPOCH FROM (completed_at - payment_confirmed_at)) / 60 < 10080;

  SELECT coalesce(avg(rating), 0), count(*), count(DISTINCT rater_id),
         count(*) FILTER (WHERE rating >= 4), count(*) FILTER (WHERE rating = 3), count(*) FILTER (WHERE rating <= 2)
  INTO v_avg_rating, v_rating_count, v_unique_reviewers, v_positive, v_neutral, v_negative
  FROM trade_ratings WHERE rated_id = p_user_id;

  result := jsonb_build_object(
    'totalTrades', v_total_trades,
    'completedTrades', v_completed_trades,
    'disputeCount', v_disputed_trades,
    'completionRate', v_completion_rate,
    'disputeRate', v_dispute_rate,
    'totalVolume', v_total_volume,
    'volumeCurrency', v_volume_currency,
    'avgReleaseTimeMinutes', v_avg_release_minutes,
    'avgRating', round(v_avg_rating, 1),
    'ratingCount', v_rating_count,
    'uniqueReviewers', v_unique_reviewers,
    'positiveCount', v_positive,
    'neutralCount', v_neutral,
    'negativeCount', v_negative
  );
  RETURN result;
END;
$function$;
