
CREATE OR REPLACE FUNCTION public.get_trader_public_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  -- Trade counts
  SELECT 
    count(*),
    count(*) FILTER (WHERE status = 'completed'),
    count(*) FILTER (WHERE status = 'disputed')
  INTO v_total_trades, v_completed_trades, v_disputed_trades
  FROM trades
  WHERE buyer_id = p_user_id OR seller_id = p_user_id;

  v_completion_rate := CASE WHEN v_total_trades > 0 THEN round((v_completed_trades::numeric / v_total_trades) * 100) ELSE 0 END;
  v_dispute_rate := CASE WHEN v_total_trades > 0 THEN round((v_disputed_trades::numeric / v_total_trades) * 100) ELSE 0 END;

  -- Volume from completed trades
  SELECT 
    coalesce(sum(fiat_amount), 0),
    coalesce(min(fiat_currency), 'KES')
  INTO v_total_volume, v_volume_currency
  FROM trades
  WHERE (buyer_id = p_user_id OR seller_id = p_user_id) AND status = 'completed';

  -- Average release time
  SELECT round(avg(EXTRACT(EPOCH FROM (completed_at - payment_confirmed_at)) / 60))
  INTO v_avg_release_minutes
  FROM trades
  WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
    AND status = 'completed'
    AND payment_confirmed_at IS NOT NULL
    AND completed_at IS NOT NULL
    AND completed_at > payment_confirmed_at
    AND EXTRACT(EPOCH FROM (completed_at - payment_confirmed_at)) / 60 < 10080;

  -- Ratings
  SELECT coalesce(avg(rating), 0), count(*)
  INTO v_avg_rating, v_rating_count
  FROM trade_ratings
  WHERE rated_id = p_user_id;

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
    'ratingCount', v_rating_count
  );

  RETURN result;
END;
$$;

-- Function to get public reviews for a trader
CREATE OR REPLACE FUNCTION public.get_trader_reviews(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'rating', r.rating,
      'comment', r.comment,
      'created_at', r.created_at,
      'rater_username', p.username
    ) ORDER BY r.created_at DESC
  ), '[]'::jsonb)
  INTO result
  FROM trade_ratings r
  LEFT JOIN profiles p ON p.user_id = r.rater_id
  WHERE r.rated_id = p_user_id;

  RETURN result;
END;
$$;
