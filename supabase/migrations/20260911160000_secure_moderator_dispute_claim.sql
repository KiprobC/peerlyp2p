-- Claim a dispute and synchronize trade ownership atomically.
CREATE OR REPLACE FUNCTION public.claim_dispute_moderator(p_trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_assignment public.dispute_assignments%ROWTYPE;
  v_availability public.moderator_availability%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'moderator'::app_role) THEN
    RAISE EXCEPTION 'Only moderators can claim disputes' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_availability
  FROM public.moderator_availability
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND OR v_availability.status <> 'online'
     OR v_availability.active_cases_count >= v_availability.max_cases THEN
    RETURN jsonb_build_object('success', false, 'error', 'Moderator must be online and have available capacity');
  END IF;

  SELECT * INTO v_assignment
  FROM public.dispute_assignments
  WHERE trade_id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute assignment not found');
  END IF;

  IF v_assignment.status <> 'assigned' OR v_assignment.first_response_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This dispute has already been claimed');
  END IF;

  UPDATE public.dispute_assignments
  SET assigned_to = v_uid,
      status = 'in_review',
      first_response_at = now(),
      updated_at = now()
  WHERE id = v_assignment.id;

  UPDATE public.trades
  SET assigned_moderator_id = v_uid,
      updated_at = now()
  WHERE id = p_trade_id;

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'assigned_to', v_uid
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_dispute_moderator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_dispute_moderator(uuid) TO authenticated, service_role;
