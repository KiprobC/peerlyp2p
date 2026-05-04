
-- 1. kyc_submissions table
CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  country_code text,
  id_type text,
  id_number text,
  full_name text,
  date_of_birth date,
  id_front_url text,
  id_back_url text,
  selfie_url text,
  id_front_hash text,
  id_back_hash text,
  selfie_hash text,
  status text NOT NULL DEFAULT 'pending',
  bot_score numeric DEFAULT 0,
  bot_checks jsonb DEFAULT '{}'::jsonb,
  bot_reason text,
  reviewer_id uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kyc_submissions_user ON public.kyc_submissions(user_id, created_at DESC);
CREATE INDEX idx_kyc_submissions_status ON public.kyc_submissions(status, created_at DESC);

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own submissions"
  ON public.kyc_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all submissions"
  ON public.kyc_submissions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update submissions"
  ON public.kyc_submissions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_kyc_submissions_updated
  BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. kyc_document_fingerprints — global dedup
CREATE TABLE public.kyc_document_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  kind text NOT NULL,
  user_id uuid NOT NULL,
  submission_id uuid REFERENCES public.kyc_submissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fingerprint, kind)
);

CREATE INDEX idx_kyc_fp_user ON public.kyc_document_fingerprints(user_id);

ALTER TABLE public.kyc_document_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view fingerprints"
  ON public.kyc_document_fingerprints FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. RPC: claim fingerprints atomically
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
    -- Check for existing claim by another user
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

  -- All clear: insert (skip duplicates from same user via ON CONFLICT)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_fingerprints)
  LOOP
    INSERT INTO public.kyc_document_fingerprints (fingerprint, kind, user_id, submission_id)
    VALUES (v_item->>'fingerprint', v_item->>'kind', p_user_id, p_submission_id)
    ON CONFLICT (fingerprint, kind) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. RPC: finalize decision (bot or admin)
CREATE OR REPLACE FUNCTION public.finalize_kyc_decision(
  p_submission_id uuid,
  p_decision text,
  p_reviewer uuid,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_profile_status kyc_status;
  v_notif_title text;
  v_notif_message text;
BEGIN
  SELECT user_id INTO v_user FROM public.kyc_submissions WHERE id = p_submission_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  UPDATE public.kyc_submissions
  SET status = p_decision,
      reviewer_id = p_reviewer,
      reviewed_at = now(),
      review_notes = COALESCE(p_notes, review_notes)
  WHERE id = p_submission_id;

  IF p_decision IN ('auto_approved', 'manually_approved') THEN
    v_profile_status := 'verified'::kyc_status;
    v_notif_title := 'KYC Verified';
    v_notif_message := 'Your identity has been verified. You now have full access.';
    UPDATE public.profiles
    SET kyc_status = v_profile_status,
        kyc_verified_at = now(),
        is_verified = true
    WHERE user_id = v_user;
  ELSIF p_decision IN ('auto_rejected', 'manually_rejected') THEN
    v_profile_status := 'rejected'::kyc_status;
    v_notif_title := 'KYC Rejected';
    v_notif_message := COALESCE('Your KYC was rejected: ' || p_notes, 'Your KYC submission was rejected.');
    UPDATE public.profiles
    SET kyc_status = v_profile_status
    WHERE user_id = v_user;
  ELSIF p_decision = 'needs_review' THEN
    v_notif_title := 'KYC Under Review';
    v_notif_message := 'Your documents need a manual review. We will notify you once complete.';
    UPDATE public.profiles
    SET kyc_status = 'submitted'::kyc_status
    WHERE user_id = v_user;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (v_user, 'kyc'::notification_type, v_notif_title, v_notif_message,
          jsonb_build_object('submission_id', p_submission_id, 'decision', p_decision));

  RETURN jsonb_build_object('ok', true, 'user_id', v_user);
END;
$$;
