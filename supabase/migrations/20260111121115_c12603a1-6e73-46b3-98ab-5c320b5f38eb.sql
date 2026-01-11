-- Create OTP codes table for time-limited, single-use verification codes
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  action_type TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'email',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_otp_codes_user_action ON public.otp_codes(user_id, action_type, expires_at);
CREATE INDEX idx_otp_codes_cleanup ON public.otp_codes(expires_at) WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own OTP records (for status checks)
CREATE POLICY "Users can view own OTP status"
ON public.otp_codes FOR SELECT
USING (auth.uid() = user_id);

-- Only backend functions can insert/update OTPs (via SECURITY DEFINER functions)
CREATE POLICY "Service role only for OTP management"
ON public.otp_codes FOR ALL
USING (false)
WITH CHECK (false);

-- Create security events table for audit logging
CREATE TABLE public.security_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  method TEXT,
  status TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for security events
CREATE INDEX idx_security_events_user ON public.security_events(user_id, created_at DESC);
CREATE INDEX idx_security_events_action ON public.security_events(action_type, created_at DESC);
CREATE INDEX idx_security_events_status ON public.security_events(status, created_at DESC);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own security events
CREATE POLICY "Users can view own security events"
ON public.security_events FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all security events
CREATE POLICY "Admins can view all security events"
ON public.security_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create OTP rate limiting table
CREATE TABLE public.otp_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  identifier TEXT NOT NULL,
  action_type TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index for rate limiting
CREATE UNIQUE INDEX idx_otp_rate_limits_unique ON public.otp_rate_limits(identifier, action_type);
CREATE INDEX idx_otp_rate_limits_cleanup ON public.otp_rate_limits(last_attempt_at);

-- Enable RLS
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct access - only via SECURITY DEFINER functions
CREATE POLICY "No direct access to rate limits"
ON public.otp_rate_limits FOR ALL
USING (false)
WITH CHECK (false);

-- Create function to generate OTP code
CREATE OR REPLACE FUNCTION public.generate_otp_code(
  p_user_id UUID,
  p_action_type TEXT,
  p_method TEXT DEFAULT 'email',
  p_expiry_minutes INTEGER DEFAULT 10,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code TEXT;
  v_code_hash TEXT;
  v_rate_limit RECORD;
  v_existing_valid INTEGER;
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
  
  -- Hash the code using pgcrypto
  v_code_hash := encode(digest(v_code, 'sha256'), 'hex');
  
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

-- Create function to verify OTP code
CREATE OR REPLACE FUNCTION public.verify_otp_code(
  p_user_id UUID,
  p_code TEXT,
  p_action_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_otp RECORD;
  v_code_hash TEXT;
  v_rate_limit RECORD;
BEGIN
  -- Check verification rate limiting (separate from request limiting)
  SELECT * INTO v_rate_limit
  FROM public.otp_rate_limits
  WHERE identifier = p_user_id::text || '_verify' AND action_type = p_action_type;
  
  IF FOUND AND v_rate_limit.locked_until IS NOT NULL AND v_rate_limit.locked_until > now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many failed attempts. Please request a new code.',
      'locked_until', v_rate_limit.locked_until
    );
  END IF;
  
  -- Hash the provided code
  v_code_hash := encode(digest(p_code, 'sha256'), 'hex');
  
  -- Find valid OTP
  SELECT * INTO v_otp
  FROM public.otp_codes
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND used_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- Log failed attempt
    INSERT INTO public.security_events (user_id, action_type, method, status, metadata)
    VALUES (p_user_id, 'otp_verify', 'email', 'failed', jsonb_build_object('reason', 'no_valid_code', 'action', p_action_type));
    
    RETURN jsonb_build_object('success', false, 'error', 'No valid code found. Please request a new one.');
  END IF;
  
  -- Check attempts
  IF v_otp.attempts >= v_otp.max_attempts THEN
    UPDATE public.otp_codes SET used_at = now() WHERE id = v_otp.id;
    
    INSERT INTO public.security_events (user_id, action_type, method, status, metadata)
    VALUES (p_user_id, 'otp_verify', 'email', 'failed', jsonb_build_object('reason', 'max_attempts', 'action', p_action_type));
    
    RETURN jsonb_build_object('success', false, 'error', 'Maximum attempts exceeded. Please request a new code.');
  END IF;
  
  -- Verify code
  IF v_otp.code_hash = v_code_hash THEN
    -- Mark as used
    UPDATE public.otp_codes SET used_at = now() WHERE id = v_otp.id;
    
    -- Clear rate limits
    DELETE FROM public.otp_rate_limits WHERE identifier IN (p_user_id::text, p_user_id::text || '_verify') AND action_type = p_action_type;
    
    -- Log success
    INSERT INTO public.security_events (user_id, action_type, method, status, metadata)
    VALUES (p_user_id, 'otp_verify', 'email', 'success', jsonb_build_object('action', p_action_type));
    
    RETURN jsonb_build_object('success', true);
  ELSE
    -- Increment attempts
    UPDATE public.otp_codes SET attempts = attempts + 1 WHERE id = v_otp.id;
    
    -- Track verification attempts for rate limiting
    INSERT INTO public.otp_rate_limits (identifier, action_type, user_id)
    VALUES (p_user_id::text || '_verify', p_action_type, p_user_id)
    ON CONFLICT (identifier, action_type) DO UPDATE SET
      attempt_count = otp_rate_limits.attempt_count + 1,
      last_attempt_at = now(),
      locked_until = CASE WHEN otp_rate_limits.attempt_count >= 4 THEN now() + interval '15 minutes' ELSE NULL END;
    
    -- Log failed attempt
    INSERT INTO public.security_events (user_id, action_type, method, status, metadata)
    VALUES (p_user_id, 'otp_verify', 'email', 'failed', jsonb_build_object('reason', 'invalid_code', 'action', p_action_type, 'attempts', v_otp.attempts + 1));
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid code. Please try again.',
      'attempts_remaining', v_otp.max_attempts - v_otp.attempts - 1
    );
  END IF;
END;
$$;

-- Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action_type TEXT,
  p_status TEXT,
  p_method TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.security_events (user_id, action_type, method, status, ip_address, user_agent, metadata)
  VALUES (auth.uid(), p_action_type, p_method, p_status, p_ip_address, p_user_agent, p_metadata)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Create cleanup function for expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Delete OTPs older than 24 hours
  DELETE FROM public.otp_codes
  WHERE expires_at < now() - interval '24 hours';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  -- Clean up old rate limits
  DELETE FROM public.otp_rate_limits
  WHERE last_attempt_at < now() - interval '24 hours';
  
  RETURN v_deleted;
END;
$$;