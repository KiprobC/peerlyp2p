-- Enforce the minimum KYC age at the submission boundary.
CREATE OR REPLACE FUNCTION public.submit_kyc_application(
  p_country_code text,
  p_id_type text,
  p_id_number text,
  p_full_name text,
  p_date_of_birth date,
  p_id_front_url text,
  p_id_back_url text,
  p_selfie_url text,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_recent timestamptz;
  v_active_count int;
  v_profile_status kyc_status;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF COALESCE(trim(p_country_code), '') = ''
     OR COALESCE(trim(p_id_type), '') = ''
     OR COALESCE(trim(p_id_number), '') = ''
     OR COALESCE(trim(p_full_name), '') = ''
     OR p_date_of_birth IS NULL
     OR COALESCE(trim(p_id_front_url), '') = ''
      OR COALESCE(trim(p_id_back_url), '') = ''
     OR COALESCE(trim(p_selfie_url), '') = '' THEN
    RAISE EXCEPTION 'MISSING_FIELDS';
  END IF;

  IF p_date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'MINIMUM_AGE_NOT_MET';
  END IF;

  SELECT kyc_status INTO v_profile_status FROM public.profiles WHERE user_id = v_user;
  IF v_profile_status = 'verified'::kyc_status THEN
    RAISE EXCEPTION 'ALREADY_VERIFIED';
  END IF;

  -- Only in-flight or approved submissions block a new attempt.
  SELECT count(*) INTO v_active_count
  FROM public.kyc_submissions
  WHERE user_id = v_user
    AND status IN ('pending', 'needs_review', 'auto_approved', 'manually_approved');

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'SUBMISSION_IN_PROGRESS';
  END IF;

  -- Cooldown between rejected retries
  SELECT created_at INTO v_recent
  FROM public.kyc_submissions
  WHERE user_id = v_user
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_recent IS NOT NULL AND v_recent > now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'COOLDOWN_ACTIVE: try again after %', (v_recent + interval '5 minutes');
  END IF;

  -- Keep the profile in sync with what was actually submitted
  UPDATE public.profiles
  SET kyc_country      = p_country_code,
      country          = COALESCE(country, p_country_code),
      id_type          = p_id_type,
      id_number        = p_id_number,
      full_name        = p_full_name,
      date_of_birth    = p_date_of_birth,
      phone            = COALESCE(NULLIF(trim(COALESCE(p_phone, '')), ''), phone),
      id_front_url     = p_id_front_url,
      id_back_url      = COALESCE(p_id_back_url, id_back_url),
      selfie_url       = p_selfie_url,
      kyc_status       = 'submitted'::kyc_status,
      kyc_submitted_at = now()
  WHERE user_id = v_user;

  INSERT INTO public.kyc_submissions(
    user_id, country_code, id_type, id_number, full_name, date_of_birth,
    id_front_url, id_back_url, selfie_url, status
  ) VALUES (
    v_user, p_country_code, p_id_type, p_id_number, p_full_name, p_date_of_birth,
    p_id_front_url, p_id_back_url, p_selfie_url, 'pending'
  )
  RETURNING id INTO v_id;

  PERFORM public.notify_admins(
    'kyc'::notification_type,
    'New identity verification',
    COALESCE(p_full_name, 'A user') || ' submitted documents for verification.',
    jsonb_build_object('submission_id', v_id, 'user_id', v_user, 'link', '/admin/kyc')
  );

  RETURN jsonb_build_object('ok', true, 'submission_id', v_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_kyc_application(text, text, text, text, date, text, text, text, text) TO authenticated;
