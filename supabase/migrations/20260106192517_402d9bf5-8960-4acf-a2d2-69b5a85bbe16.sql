-- Update get_user_by_username function to use dynamic trade counts from trades table
CREATE OR REPLACE FUNCTION public.get_user_by_username(p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_total_trades INTEGER;
  v_completed_trades INTEGER;
BEGIN
  -- Get profile data
  SELECT 
    p.user_id,
    p.username,
    p.avatar_url,
    p.rating,
    p.is_verified,
    p.created_at
  INTO v_profile
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(BTRIM(p_username)) AND p.setup_completed = true;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Calculate dynamic trade counts
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN status = 'completed' THEN 1 END)
  INTO v_total_trades, v_completed_trades
  FROM public.trades
  WHERE buyer_id = v_profile.user_id OR seller_id = v_profile.user_id;
  
  RETURN jsonb_build_object(
    'user_id', v_profile.user_id,
    'username', v_profile.username,
    'avatar_url', v_profile.avatar_url,
    'rating', v_profile.rating,
    'total_trades', COALESCE(v_total_trades, 0),
    'completed_trades', COALESCE(v_completed_trades, 0),
    'is_verified', v_profile.is_verified,
    'member_since', v_profile.created_at
  );
END;
$$;