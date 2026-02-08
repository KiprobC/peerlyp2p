
-- Moderator availability tracking table
CREATE TABLE public.moderator_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy')),
  active_cases_count INTEGER NOT NULL DEFAULT 0,
  max_cases INTEGER NOT NULL DEFAULT 5,
  last_assigned_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.moderator_availability ENABLE ROW LEVEL SECURITY;

-- Moderators can read/update their own availability
CREATE POLICY "Moderators can view all availability"
  ON public.moderator_availability FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Moderators can update own availability"
  ON public.moderator_availability FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Moderators can insert own availability"
  ON public.moderator_availability FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can manage all
CREATE POLICY "Admins can manage all availability"
  ON public.moderator_availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add SLA fields to dispute_assignments
ALTER TABLE public.dispute_assignments
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_to UUID,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- Enable realtime for moderator_availability
ALTER PUBLICATION supabase_realtime ADD TABLE public.moderator_availability;

-- Function: Auto-assign moderator when dispute is created
CREATE OR REPLACE FUNCTION public.auto_assign_dispute_moderator(p_trade_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_moderator_id UUID;
  v_assignment_id UUID;
  v_sla_minutes INTEGER := 30;
  v_sla_deadline TIMESTAMPTZ;
  v_moderator_username TEXT;
BEGIN
  -- Check if already assigned
  IF EXISTS (SELECT 1 FROM dispute_assignments WHERE trade_id = p_trade_id AND status NOT IN ('resolved', 'cancelled')) THEN
    RETURN json_build_object('success', false, 'error', 'Dispute already has an active assignment');
  END IF;

  -- Find eligible moderator: online, under max cases, sorted by least cases then oldest assignment
  SELECT ma.user_id INTO v_moderator_id
  FROM moderator_availability ma
  INNER JOIN user_roles ur ON ur.user_id = ma.user_id AND ur.role IN ('moderator', 'admin')
  WHERE ma.status = 'online'
    AND ma.active_cases_count < ma.max_cases
  ORDER BY ma.active_cases_count ASC, ma.last_assigned_at ASC NULLS FIRST
  LIMIT 1;

  IF v_moderator_id IS NULL THEN
    -- No available moderator - try any moderator regardless of status (fallback to admin)
    SELECT ma.user_id INTO v_moderator_id
    FROM moderator_availability ma
    INNER JOIN user_roles ur ON ur.user_id = ma.user_id AND ur.role IN ('moderator', 'admin')
    WHERE ma.active_cases_count < ma.max_cases
    ORDER BY ma.active_cases_count ASC, ma.last_assigned_at ASC NULLS FIRST
    LIMIT 1;
  END IF;

  IF v_moderator_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No available moderators');
  END IF;

  v_sla_deadline := now() + (v_sla_minutes || ' minutes')::INTERVAL;

  -- Create assignment
  INSERT INTO dispute_assignments (
    trade_id, assigned_to, assigned_by, status, priority, sla_deadline
  ) VALUES (
    p_trade_id, v_moderator_id, v_moderator_id, 'assigned', 'normal', v_sla_deadline
  ) RETURNING id INTO v_assignment_id;

  -- Update trade with assigned moderator
  UPDATE trades SET assigned_moderator_id = v_moderator_id WHERE id = p_trade_id;

  -- Increment moderator's active case count and update last_assigned_at
  UPDATE moderator_availability
  SET active_cases_count = active_cases_count + 1,
      last_assigned_at = now(),
      updated_at = now()
  WHERE user_id = v_moderator_id;

  -- Get moderator username for system message
  SELECT username INTO v_moderator_username FROM profiles WHERE user_id = v_moderator_id;

  -- Send system message to trade chat
  INSERT INTO trade_messages (trade_id, sender_id, message, is_system)
  VALUES (p_trade_id, v_moderator_id, 
    '🛡️ Moderator @' || COALESCE(v_moderator_username, 'moderator') || ' has been assigned to this trade. Expected response within ' || v_sla_minutes || ' minutes.',
    true);

  -- Create notification for moderator
  PERFORM create_notification(
    v_moderator_id,
    'trade_update',
    'New Dispute Assigned',
    'A dispute requires your attention. Trade #' || LEFT(p_trade_id::text, 8),
    json_build_object('trade_id', p_trade_id, 'type', 'dispute_assignment')::jsonb
  );

  -- Log admin action
  INSERT INTO admin_actions (actor_id, actor_role, action_type, target_type, target_id, details)
  VALUES (v_moderator_id, 'moderator', 'dispute_auto_assigned', 'trade', p_trade_id::text,
    json_build_object('moderator_id', v_moderator_id, 'sla_deadline', v_sla_deadline));

  RETURN json_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'moderator_id', v_moderator_id,
    'sla_deadline', v_sla_deadline
  );
END;
$$;

-- Function: Escalate SLA-breached disputes
CREATE OR REPLACE FUNCTION public.escalate_breached_disputes()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute RECORD;
  v_escalated_count INTEGER := 0;
  v_new_moderator_id UUID;
  v_new_sla_deadline TIMESTAMPTZ;
  v_mod_username TEXT;
BEGIN
  FOR v_dispute IN 
    SELECT da.id, da.trade_id, da.assigned_to
    FROM dispute_assignments da
    WHERE da.status IN ('assigned', 'in_review')
      AND da.sla_breached = false
      AND da.sla_deadline IS NOT NULL
      AND da.sla_deadline < now()
      AND da.first_response_at IS NULL
  LOOP
    -- Mark as SLA breached
    UPDATE dispute_assignments
    SET sla_breached = true, updated_at = now()
    WHERE id = v_dispute.id;

    -- Try to find a new moderator (different from current)
    SELECT ma.user_id INTO v_new_moderator_id
    FROM moderator_availability ma
    INNER JOIN user_roles ur ON ur.user_id = ma.user_id AND ur.role IN ('moderator', 'admin')
    WHERE ma.status = 'online'
      AND ma.active_cases_count < ma.max_cases
      AND ma.user_id != v_dispute.assigned_to
    ORDER BY ma.active_cases_count ASC
    LIMIT 1;

    IF v_new_moderator_id IS NOT NULL THEN
      v_new_sla_deadline := now() + '30 minutes'::INTERVAL;
      
      -- Decrement old moderator's count
      UPDATE moderator_availability
      SET active_cases_count = GREATEST(active_cases_count - 1, 0), updated_at = now()
      WHERE user_id = v_dispute.assigned_to;

      -- Update assignment with new moderator
      UPDATE dispute_assignments
      SET assigned_to = v_new_moderator_id,
          escalated = true,
          escalated_at = now(),
          escalated_to = v_new_moderator_id,
          escalation_reason = 'SLA breach - auto-escalated',
          sla_deadline = v_new_sla_deadline,
          sla_breached = false,
          status = 'assigned',
          updated_at = now()
      WHERE id = v_dispute.id;

      -- Update trade
      UPDATE trades SET assigned_moderator_id = v_new_moderator_id WHERE id = v_dispute.trade_id;

      -- Increment new moderator
      UPDATE moderator_availability
      SET active_cases_count = active_cases_count + 1,
          last_assigned_at = now(),
          updated_at = now()
      WHERE user_id = v_new_moderator_id;

      SELECT username INTO v_mod_username FROM profiles WHERE user_id = v_new_moderator_id;

      -- System message
      INSERT INTO trade_messages (trade_id, sender_id, message, is_system)
      VALUES (v_dispute.trade_id, v_new_moderator_id,
        '⚠️ This dispute has been escalated due to delayed response. Moderator @' || COALESCE(v_mod_username, 'moderator') || ' has been reassigned.',
        true);

      -- Notification
      PERFORM create_notification(
        v_new_moderator_id, 'trade_update', 'Escalated Dispute Assigned',
        'An escalated dispute requires urgent attention. Trade #' || LEFT(v_dispute.trade_id::text, 8),
        json_build_object('trade_id', v_dispute.trade_id, 'type', 'dispute_escalation', 'priority', 'high')::jsonb
      );

      -- Log
      INSERT INTO admin_actions (actor_id, actor_role, action_type, target_type, target_id, details)
      VALUES (v_new_moderator_id, 'moderator', 'dispute_escalated', 'trade', v_dispute.trade_id::text,
        json_build_object('previous_moderator', v_dispute.assigned_to, 'reason', 'sla_breach'));
    ELSE
      -- No available moderator - just mark as escalated
      UPDATE dispute_assignments
      SET escalated = true, escalated_at = now(), escalation_reason = 'SLA breach - no moderator available', updated_at = now()
      WHERE id = v_dispute.id;

      INSERT INTO trade_messages (trade_id, sender_id, message, is_system)
      VALUES (v_dispute.trade_id, v_dispute.assigned_to,
        '⚠️ This dispute has been escalated due to delayed response. An admin will review shortly.',
        true);
    END IF;

    v_escalated_count := v_escalated_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'escalated_count', v_escalated_count);
END;
$$;

-- Trigger: Auto-assign moderator when trade status changes to 'disputed'
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_on_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'disputed' AND (OLD.status IS NULL OR OLD.status != 'disputed') THEN
    PERFORM auto_assign_dispute_moderator(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_assign_dispute_trigger ON public.trades;
CREATE TRIGGER auto_assign_dispute_trigger
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_assign_on_dispute();

-- Function: Decrement active cases when dispute is resolved
CREATE OR REPLACE FUNCTION public.trigger_decrement_cases_on_resolve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    UPDATE moderator_availability
    SET active_cases_count = GREATEST(active_cases_count - 1, 0), updated_at = now()
    WHERE user_id = NEW.assigned_to;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS decrement_cases_on_resolve ON public.dispute_assignments;
CREATE TRIGGER decrement_cases_on_resolve
  AFTER UPDATE ON public.dispute_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_decrement_cases_on_resolve();
