-- Update get_user_by_username to notify users with incomplete profiles
CREATE OR REPLACE FUNCTION public.get_user_by_username(p_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_record RECORD;
  v_sender_username text;
BEGIN
  -- Find user by username (case-insensitive)
  SELECT 
    p.user_id,
    p.username,
    p.avatar_url,
    p.rating,
    p.total_trades,
    p.is_verified,
    p.created_at,
    p.setup_completed
  INTO v_user_record
  FROM profiles p
  WHERE LOWER(p.username) = LOWER(p_username);
  
  -- If no user found, return null
  IF v_user_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- If user exists but hasn't completed setup, send them a notification and return error
  IF v_user_record.setup_completed = false THEN
    -- Get sender's username for the notification
    SELECT username INTO v_sender_username
    FROM profiles
    WHERE user_id = auth.uid();
    
    -- Create notification for the user with incomplete profile
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_user_record.user_id,
      'system',
      'Someone wants to send you crypto!',
      COALESCE('@' || v_sender_username, 'Someone') || ' tried to send you crypto, but your profile setup is incomplete. Complete your profile to receive transfers.',
      jsonb_build_object(
        'action', 'complete_profile',
        'sender_username', v_sender_username
      )
    );
    
    RETURN jsonb_build_object(
      'error', 'setup_incomplete',
      'username', v_user_record.username,
      'message', 'User has not completed profile setup'
    );
  END IF;
  
  -- Return user data for completed profiles
  RETURN jsonb_build_object(
    'user_id', v_user_record.user_id,
    'username', v_user_record.username,
    'avatar_url', v_user_record.avatar_url,
    'rating', COALESCE(v_user_record.rating, 0),
    'total_trades', COALESCE(v_user_record.total_trades, 0),
    'is_verified', COALESCE(v_user_record.is_verified, false),
    'member_since', v_user_record.created_at
  );
END;
$$;