-- ============================================================
-- 1. SECURITY: wallets / deposit_addresses insert hardening
-- ============================================================
DROP POLICY IF EXISTS "Users can insert their own wallets" ON public.wallets;
CREATE POLICY "Users can insert their own wallets"
ON public.wallets FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(balance, 0) = 0
  AND COALESCE(locked_balance, 0) = 0
);

DROP POLICY IF EXISTS "Users can insert their own deposit addresses" ON public.deposit_addresses;
CREATE POLICY "Users can insert their own deposit addresses"
ON public.deposit_addresses FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(total_deposited, 0) = 0
  AND COALESCE(pending_amount, 0) = 0
);

-- ============================================================
-- 2. KYC: submission entrypoint (persists identity data + notifies admins)
-- ============================================================
DROP FUNCTION IF EXISTS public.submit_kyc_application(text, text, text, text, date, text, text, text);

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
     OR COALESCE(trim(p_selfie_url), '') = '' THEN
    RAISE EXCEPTION 'MISSING_FIELDS';
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

-- ============================================================
-- 3. KYC: bot failure safety net
-- ============================================================
CREATE OR REPLACE FUNCTION public.kyc_job_failed(p_submission_id uuid, p_error text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.kyc_submissions WHERE id = p_submission_id;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  UPDATE public.kyc_submissions
  SET status = CASE WHEN status = 'pending' THEN 'needs_review' ELSE status END,
      bot_reason = COALESCE(NULLIF(bot_reason, ''), 'bot_failed'),
      review_notes = COALESCE(review_notes, '') || E'\n[auto-verify failure] ' || COALESCE(p_error, 'unknown')
  WHERE id = p_submission_id;

  UPDATE public.profiles
  SET kyc_status = 'submitted'::kyc_status
  WHERE user_id = v_user AND kyc_status <> 'verified'::kyc_status;

  INSERT INTO public.admin_actions (actor_id, actor_role, action_type, target_type, target_id, details)
  VALUES (NULL, 'admin'::app_role, 'kyc_bot_failure', 'kyc_submission', p_submission_id,
          jsonb_build_object('error', COALESCE(p_error, 'unknown'), 'user_id', v_user));

  PERFORM public.notify_admins(
    'system'::notification_type,
    'Automatic verification failed',
    'A verification job failed and was moved to manual review.',
    jsonb_build_object('submission_id', p_submission_id, 'link', '/admin/kyc')
  );

  RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.kyc_job_failed(uuid, text) TO authenticated, service_role;

-- ============================================================
-- 4. Admin pending-work counters (sidebar badges)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_pending_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT jsonb_build_object(
    'kyc', (SELECT count(*) FROM public.kyc_submissions WHERE status IN ('pending','needs_review')),
    'disputes', (SELECT count(*) FROM public.trades WHERE status = 'disputed'::trade_status),
    'deposits', (SELECT count(*) FROM public.deposit_requests WHERE status::text = 'pending'),
    'withdrawals', (SELECT count(*) FROM public.withdrawal_requests WHERE status::text = 'pending'),
    'recovery', (SELECT count(*) FROM public.account_recovery_requests WHERE status::text = 'pending'),
    'support', (SELECT count(*) FROM public.support_tickets WHERE status::text IN ('open','pending')),
    'risk', (SELECT count(*) FROM public.user_risk_alerts WHERE COALESCE(resolved, false) = false)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_pending_counts() TO authenticated;

-- ============================================================
-- 5. Admin alerts for queues that had none
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_admins_new_queue_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'deposit_requests' THEN
    PERFORM public.notify_admins('system'::notification_type, 'New deposit awaiting review',
      'A user submitted a deposit for confirmation.',
      jsonb_build_object('id', NEW.id, 'link', '/admin/manual-treasury'));
  ELSIF TG_TABLE_NAME = 'withdrawal_requests' THEN
    PERFORM public.notify_admins('system'::notification_type, 'New withdrawal awaiting processing',
      'A user requested a withdrawal.',
      jsonb_build_object('id', NEW.id, 'link', '/admin/manual-treasury'));
  ELSIF TG_TABLE_NAME = 'account_recovery_requests' THEN
    PERFORM public.notify_admins('system'::notification_type, 'New account recovery request',
      'A user requested help regaining access to their account.',
      jsonb_build_object('id', NEW.id, 'link', '/admin/account-recovery'));
  ELSIF TG_TABLE_NAME = 'support_tickets' THEN
    PERFORM public.notify_admins('message'::notification_type, 'New support ticket',
      'A user opened a support ticket.',
      jsonb_build_object('id', NEW.id, 'link', '/admin/support'));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_admins_deposit_requests ON public.deposit_requests;
CREATE TRIGGER trg_notify_admins_deposit_requests
AFTER INSERT ON public.deposit_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_queue_item();

DROP TRIGGER IF EXISTS trg_notify_admins_withdrawal_requests ON public.withdrawal_requests;
CREATE TRIGGER trg_notify_admins_withdrawal_requests
AFTER INSERT ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_queue_item();

DROP TRIGGER IF EXISTS trg_notify_admins_recovery_requests ON public.account_recovery_requests;
CREATE TRIGGER trg_notify_admins_recovery_requests
AFTER INSERT ON public.account_recovery_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_queue_item();

DROP TRIGGER IF EXISTS trg_notify_admins_support_tickets ON public.support_tickets;
CREATE TRIGGER trg_notify_admins_support_tickets
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_queue_item();

-- ============================================================
-- 6. Dispute auto-close when the traders settle it themselves
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_close_user_resolved_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'disputed'::trade_status
     AND NEW.status IN ('completed'::trade_status, 'cancelled'::trade_status) THEN

    UPDATE public.dispute_assignments
    SET status = 'resolved',
        resolved_at = now(),
        resolution_type = CASE WHEN NEW.status = 'completed'::trade_status
                               THEN 'release_to_buyer' ELSE 'cancelled' END,
        resolution_notes = COALESCE(resolution_notes, '') ||
          CASE WHEN COALESCE(resolution_notes, '') = '' THEN '' ELSE E'\n' END ||
          'Resolved by users before staff intervention.'
    WHERE trade_id = NEW.id AND status <> 'resolved';

    PERFORM public.notify_admins(
      'trade'::notification_type,
      'Dispute resolved by users',
      'Trade ' || left(NEW.id::text, 8) || ' was settled by the traders and removed from the active dispute queue.',
      jsonb_build_object('trade_id', NEW.id, 'link', '/admin/disputes', 'auto_resolved', true)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_close_user_resolved_dispute ON public.trades;
CREATE TRIGGER trg_auto_close_user_resolved_dispute
AFTER UPDATE OF status ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.auto_close_user_resolved_dispute();