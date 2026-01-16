-- Recreate the generate_otp_code function to use extensions.digest explicitly
CREATE OR REPLACE FUNCTION public.generate_otp_code(
  p_user_id uuid,
  p_action_type text,
  p_method text DEFAULT 'email',
  p_expiry_minutes integer DEFAULT 10,
  p_metadata jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code TEXT;
  v_code_hash TEXT;
  v_rate_limit RECORD;
BEGIN
  -- Check rate limiting (max 5 OTP requests per 15 minutes)
  SELECT * INTO v_rate_limit
  FROM public.otp_rate_limits
  WHERE identifier = p_user_id::text AND action_type = p_action_type;
  
  IF FOUND THEN
    -- Check if locked
    IF v_rate_limit.locked_until IS NOT NULL AND v_rate_limit.locked_until > now() THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Too many attempts. Please try again later.',
        'locked_until', v_rate_limit.locked_until
      );
    END IF;
    
    -- Reset if first attempt was more than 15 minutes ago
    IF v_rate_limit.first_attempt_at < now() - interval '15 minutes' THEN
      UPDATE public.otp_rate_limits
      SET attempt_count = 1, first_attempt_at = now(), last_attempt_at = now(), locked_until = NULL
      WHERE id = v_rate_limit.id;
    ELSE
      -- Increment counter
      UPDATE public.otp_rate_limits
      SET attempt_count = attempt_count + 1, last_attempt_at = now(),
          locked_until = CASE WHEN attempt_count >= 5 THEN now() + interval '15 minutes' ELSE NULL END
      WHERE id = v_rate_limit.id
      RETURNING * INTO v_rate_limit;
      
      IF v_rate_limit.attempt_count > 5 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Too many OTP requests. Please wait 15 minutes.',
          'locked_until', v_rate_limit.locked_until
        );
      END IF;
    END IF;
  ELSE
    -- Create rate limit entry
    INSERT INTO public.otp_rate_limits (identifier, action_type, user_id)
    VALUES (p_user_id::text, p_action_type, p_user_id);
  END IF;
  
  -- Invalidate any existing unused codes for this action
  UPDATE public.otp_codes
  SET used_at = now()
  WHERE user_id = p_user_id AND action_type = p_action_type AND used_at IS NULL;
  
  -- Generate 6-digit code
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  
  -- Hash the code using pgcrypto (search_path includes extensions)
  v_code_hash := encode(digest(v_code::bytea, 'sha256'), 'hex');
  
  -- Store the hashed code
  INSERT INTO public.otp_codes (user_id, code_hash, action_type, method, expires_at, metadata)
  VALUES (p_user_id, v_code_hash, p_action_type, p_method, now() + (p_expiry_minutes || ' minutes')::interval, p_metadata);
  
  -- Log security event
  INSERT INTO public.security_events (user_id, action_type, method, status, metadata)
  VALUES (p_user_id, 'otp_generated', p_method, 'success', jsonb_build_object('action', p_action_type));
  
  RETURN jsonb_build_object(
    'success', true,
    'code', v_code,
    'expires_in_minutes', p_expiry_minutes
  );
END;
$$;

-- Also fix verify_otp_code to use the same search_path
CREATE OR REPLACE FUNCTION public.verify_otp_code(
  p_user_id uuid,
  p_code text,
  p_action_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_otp_record RECORD;
  v_code_hash TEXT;
  v_attempts_remaining INT;
BEGIN
  -- Hash the provided code
  v_code_hash := encode(digest(p_code::bytea, 'sha256'), 'hex');
  
  -- Find matching valid OTP
  SELECT * INTO v_otp_record
  FROM public.otp_codes
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND code_hash = v_code_hash
    AND used_at IS NULL
    AND expires_at > now()
    AND attempts < max_attempts
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    -- Mark as used
    UPDATE public.otp_codes
    SET used_at = now()
    WHERE id = v_otp_record.id;
    
    -- Clear rate limits on success
    DELETE FROM public.otp_rate_limits
    WHERE identifier = p_user_id::text AND action_type = p_action_type;
    
    RETURN jsonb_build_object('success', true);
  ELSE
    -- Check if there's an OTP that we should increment attempts on
    UPDATE public.otp_codes
    SET attempts = attempts + 1
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND used_at IS NULL
      AND expires_at > now()
    RETURNING max_attempts - attempts INTO v_attempts_remaining;
    
    IF v_attempts_remaining IS NOT NULL THEN
      IF v_attempts_remaining <= 0 THEN
        -- Max attempts reached
        UPDATE public.otp_codes
        SET used_at = now()
        WHERE user_id = p_user_id AND action_type = p_action_type AND used_at IS NULL;
        
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Too many invalid attempts. Please request a new code.',
          'attempts_remaining', 0
        );
      END IF;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid verification code',
        'attempts_remaining', v_attempts_remaining
      );
    END IF;
    
    -- No valid OTP found
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired verification code'
    );
  END IF;
END;
$$;