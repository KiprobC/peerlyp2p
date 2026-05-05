-- Speed up cooldown lookups
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_created
  ON public.kyc_submissions(user_id, created_at DESC);

-- Server-side guarded submit: cooldown + active-state check
CREATE OR REPLACE FUNCTION public.submit_kyc_application(
  p_country_code text,
  p_id_type text,
  p_id_number text,
  p_full_name text,
  p_date_of_birth date,
  p_id_front_url text,
  p_id_back_url text,
  p_selfie_url text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Block if already verified
  SELECT kyc_status INTO v_profile_status FROM public.profiles WHERE user_id = v_user;
  IF v_profile_status = 'verified'::kyc_status THEN
    RAISE EXCEPTION 'ALREADY_VERIFIED';
  END IF;

  -- Cooldown: 10 minutes between attempts
  SELECT created_at INTO v_recent
  FROM public.kyc_submissions
  WHERE user_id = v_user
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_recent IS NOT NULL AND v_recent > now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'COOLDOWN_ACTIVE: try again after %', (v_recent + interval '10 minutes');
  END IF;

  -- Block when an in-flight submission exists
  SELECT count(*) INTO v_active_count
  FROM public.kyc_submissions
  WHERE user_id = v_user
    AND status IN ('pending', 'needs_review', 'auto_approved', 'manually_approved');

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'SUBMISSION_IN_PROGRESS';
  END IF;

  INSERT INTO public.kyc_submissions(
    user_id, country_code, id_type, id_number, full_name, date_of_birth,
    id_front_url, id_back_url, selfie_url, status
  ) VALUES (
    v_user, p_country_code, p_id_type, p_id_number, p_full_name, p_date_of_birth,
    p_id_front_url, p_id_back_url, p_selfie_url, 'pending'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'submission_id', v_id);
END;
$$;

-- Re-link existing fingerprints to new submission for the same user
CREATE OR REPLACE FUNCTION public.claim_kyc_fingerprints(
  p_submission_id uuid,
  p_user_id uuid,
  p_fingerprints jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_existing_user uuid;
  v_conflicts jsonb := '[]'::jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_fingerprints)
  LOOP
    SELECT user_id INTO v_existing_user
    FROM public.kyc_document_fingerprints
    WHERE fingerprint = (v_item->>'fingerprint')
      AND kind = (v_item->>'kind')
    LIMIT 1;

    IF v_existing_user IS NOT NULL AND v_existing_user <> p_user_id THEN
      v_conflicts := v_conflicts || jsonb_build_object(
        'kind', v_item->>'kind',
        'existing_user', v_existing_user
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_conflicts) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'conflicts', v_conflicts);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_fingerprints)
  LOOP
    INSERT INTO public.kyc_document_fingerprints (fingerprint, kind, user_id, submission_id)
    VALUES (v_item->>'fingerprint', v_item->>'kind', p_user_id, p_submission_id)
    ON CONFLICT (fingerprint, kind) DO UPDATE
      SET submission_id = EXCLUDED.submission_id
      WHERE public.kyc_document_fingerprints.user_id = EXCLUDED.user_id;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;