
-- Platform wallets table (for fees, escrow pool, refunds)
CREATE TABLE public.platform_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('fees', 'escrow_pool', 'refunds', 'operations')),
  crypto_type TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(wallet_type, crypto_type)
);

-- Treasury ledger (immutable record of all platform financial movements)
CREATE TABLE public.treasury_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_wallet_id UUID REFERENCES public.platform_wallets(id),
  ledger_type TEXT NOT NULL CHECK (ledger_type IN ('fee_collected', 'escrow_in', 'escrow_out', 'refund', 'adjustment', 'dispute_resolution')),
  amount NUMERIC NOT NULL,
  crypto_type TEXT NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  trade_id UUID REFERENCES public.trades(id),
  user_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin/Moderator action audit log
CREATE TABLE public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  actor_role app_role NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('trade', 'dispute', 'user', 'wallet', 'offer', 'kyc', 'fee', 'system')),
  target_id UUID,
  reason TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dispute assignments (which moderator handles which dispute)
CREATE TABLE public.dispute_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(id),
  assigned_to UUID NOT NULL,
  assigned_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_review', 'resolved', 'escalated')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_type TEXT CHECK (resolution_type IN ('release_to_buyer', 'release_to_seller', 'split', 'cancelled', 'escalated')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trade_id)
);

-- Trade audit trail (before/after balances for each trade action)
CREATE TABLE public.trade_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('created', 'escrow_locked', 'payment_sent', 'completed', 'disputed', 'cancelled', 'resolved')),
  actor_id UUID NOT NULL,
  seller_balance_before NUMERIC,
  seller_balance_after NUMERIC,
  seller_locked_before NUMERIC,
  seller_locked_after NUMERIC,
  buyer_balance_before NUMERIC,
  buyer_balance_after NUMERIC,
  escrow_amount NUMERIC,
  platform_fee NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.platform_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS Policies for platform_wallets (admin only)
CREATE POLICY "Admins can manage platform wallets"
ON public.platform_wallets FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for treasury_ledger (admin only read)
CREATE POLICY "Admins can view treasury ledger"
ON public.treasury_ledger FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for admin_actions (admin can see all, moderators see their own)
CREATE POLICY "Admins can view all admin actions"
ON public.admin_actions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view their own actions"
ON public.admin_actions FOR SELECT
USING (public.has_role(auth.uid(), 'moderator') AND actor_id = auth.uid());

-- RLS Policies for dispute_assignments
CREATE POLICY "Admins can manage all dispute assignments"
ON public.dispute_assignments FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view assigned disputes"
ON public.dispute_assignments FOR SELECT
USING (public.has_role(auth.uid(), 'moderator') AND assigned_to = auth.uid());

CREATE POLICY "Moderators can update assigned disputes"
ON public.dispute_assignments FOR UPDATE
USING (public.has_role(auth.uid(), 'moderator') AND assigned_to = auth.uid());

-- RLS Policies for trade_audit_trail
CREATE POLICY "Admins can view all audit trails"
ON public.trade_audit_trail FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view audit trails for assigned disputes"
ON public.trade_audit_trail FOR SELECT
USING (
  public.has_role(auth.uid(), 'moderator') AND 
  EXISTS (
    SELECT 1 FROM public.dispute_assignments 
    WHERE dispute_assignments.trade_id = trade_audit_trail.trade_id 
    AND dispute_assignments.assigned_to = auth.uid()
  )
);

-- Function to log admin/moderator actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action_type TEXT,
  p_target_type TEXT,
  p_target_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role app_role;
  v_action_id UUID;
BEGIN
  SELECT role INTO v_actor_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  
  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'User has no role assigned';
  END IF;
  
  INSERT INTO public.admin_actions (actor_id, actor_role, action_type, target_type, target_id, reason, details)
  VALUES (auth.uid(), v_actor_role, p_action_type, p_target_type, p_target_id, p_reason, p_details)
  RETURNING id INTO v_action_id;
  
  RETURN v_action_id;
END;
$$;

-- Function to assign moderator to dispute
CREATE OR REPLACE FUNCTION public.assign_dispute_moderator(
  p_trade_id UUID,
  p_moderator_id UUID,
  p_priority TEXT DEFAULT 'normal',
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id UUID;
  v_trade RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign disputes';
  END IF;
  
  IF NOT public.has_role(p_moderator_id, 'moderator') AND NOT public.has_role(p_moderator_id, 'admin') THEN
    RAISE EXCEPTION 'Target user is not a moderator';
  END IF;
  
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found';
  END IF;
  
  INSERT INTO public.dispute_assignments (trade_id, assigned_to, assigned_by, priority, notes)
  VALUES (p_trade_id, p_moderator_id, auth.uid(), p_priority, p_notes)
  ON CONFLICT (trade_id) DO UPDATE SET
    assigned_to = p_moderator_id,
    assigned_by = auth.uid(),
    priority = p_priority,
    notes = COALESCE(p_notes, dispute_assignments.notes),
    status = 'assigned',
    updated_at = now()
  RETURNING id INTO v_assignment_id;
  
  PERFORM public.log_admin_action(
    'dispute_assigned',
    'dispute',
    p_trade_id,
    p_notes,
    jsonb_build_object('moderator_id', p_moderator_id, 'priority', p_priority)
  );
  
  PERFORM public.create_notification(
    p_moderator_id,
    'system'::notification_type,
    'Dispute Assigned',
    format('You have been assigned to review dispute for trade %s', left(p_trade_id::text, 8)),
    jsonb_build_object('trade_id', p_trade_id)
  );
  
  PERFORM public.create_notification(
    v_trade.buyer_id,
    'trade'::notification_type,
    'Dispute Under Review',
    'A moderator has been assigned to review your dispute',
    jsonb_build_object('trade_id', p_trade_id)
  );
  
  PERFORM public.create_notification(
    v_trade.seller_id,
    'trade'::notification_type,
    'Dispute Under Review',
    'A moderator has been assigned to review your dispute',
    jsonb_build_object('trade_id', p_trade_id)
  );
  
  RETURN v_assignment_id;
END;
$$;

-- Function to resolve dispute (moderator or admin)
CREATE OR REPLACE FUNCTION public.resolve_dispute(
  p_trade_id UUID,
  p_resolution_type TEXT,
  p_resolution_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_assignment RECORD;
  v_seller_wallet_id UUID;
  v_buyer_wallet_id UUID;
  v_seller_balance NUMERIC;
  v_seller_locked NUMERIC;
  v_buyer_balance NUMERIC;
  v_is_admin BOOLEAN;
  v_is_assigned_mod BOOLEAN;
BEGIN
  v_is_admin := public.has_role(auth.uid(), 'admin');
  
  SELECT * INTO v_assignment FROM public.dispute_assignments WHERE trade_id = p_trade_id;
  v_is_assigned_mod := public.has_role(auth.uid(), 'moderator') AND v_assignment.assigned_to = auth.uid();
  
  IF NOT v_is_admin AND NOT v_is_assigned_mod THEN
    RAISE EXCEPTION 'Not authorized to resolve this dispute';
  END IF;
  
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id AND status = 'disputed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disputed trade not found';
  END IF;
  
  v_seller_wallet_id := public.get_or_create_wallet(v_trade.seller_id, v_trade.crypto_type);
  v_buyer_wallet_id := public.get_or_create_wallet(v_trade.buyer_id, v_trade.crypto_type);
  
  SELECT balance, locked_balance INTO v_seller_balance, v_seller_locked 
  FROM public.wallets WHERE id = v_seller_wallet_id;
  
  SELECT balance INTO v_buyer_balance FROM public.wallets WHERE id = v_buyer_wallet_id;
  
  CASE p_resolution_type
    WHEN 'release_to_buyer' THEN
      UPDATE public.wallets SET locked_balance = locked_balance - v_trade.crypto_amount WHERE id = v_seller_wallet_id;
      UPDATE public.wallets SET balance = balance + v_trade.crypto_amount WHERE id = v_buyer_wallet_id;
      UPDATE public.trades SET status = 'completed', escrow_released = true, completed_at = now() WHERE id = p_trade_id;
      
    WHEN 'release_to_seller' THEN
      UPDATE public.wallets SET locked_balance = locked_balance - v_trade.crypto_amount, balance = balance + v_trade.crypto_amount WHERE id = v_seller_wallet_id;
      UPDATE public.trades SET status = 'cancelled', escrow_released = true, cancelled_at = now() WHERE id = p_trade_id;
      
    WHEN 'split' THEN
      UPDATE public.wallets SET locked_balance = locked_balance - v_trade.crypto_amount, balance = balance + (v_trade.crypto_amount / 2) WHERE id = v_seller_wallet_id;
      UPDATE public.wallets SET balance = balance + (v_trade.crypto_amount / 2) WHERE id = v_buyer_wallet_id;
      UPDATE public.trades SET status = 'completed', escrow_released = true, completed_at = now() WHERE id = p_trade_id;
      
    ELSE
      RAISE EXCEPTION 'Invalid resolution type';
  END CASE;
  
  UPDATE public.dispute_assignments SET
    status = 'resolved',
    resolved_at = now(),
    resolution_type = p_resolution_type,
    resolution_notes = p_resolution_notes,
    updated_at = now()
  WHERE trade_id = p_trade_id;
  
  INSERT INTO public.trade_audit_trail (
    trade_id, action_type, actor_id,
    seller_balance_before, seller_balance_after, seller_locked_before, seller_locked_after,
    buyer_balance_before, buyer_balance_after, escrow_amount
  ) VALUES (
    p_trade_id, 'resolved', auth.uid(),
    v_seller_balance, 
    (SELECT balance FROM public.wallets WHERE id = v_seller_wallet_id),
    v_seller_locked,
    (SELECT locked_balance FROM public.wallets WHERE id = v_seller_wallet_id),
    v_buyer_balance,
    (SELECT balance FROM public.wallets WHERE id = v_buyer_wallet_id),
    v_trade.crypto_amount
  );
  
  PERFORM public.log_admin_action(
    'dispute_resolved',
    'dispute',
    p_trade_id,
    p_resolution_notes,
    jsonb_build_object('resolution_type', p_resolution_type, 'amount', v_trade.crypto_amount, 'crypto_type', v_trade.crypto_type)
  );
  
  PERFORM public.create_notification(
    v_trade.buyer_id,
    'trade'::notification_type,
    'Dispute Resolved',
    format('Your dispute has been resolved: %s', p_resolution_type),
    jsonb_build_object('trade_id', p_trade_id, 'resolution', p_resolution_type)
  );
  
  PERFORM public.create_notification(
    v_trade.seller_id,
    'trade'::notification_type,
    'Dispute Resolved',
    format('Your dispute has been resolved: %s', p_resolution_type),
    jsonb_build_object('trade_id', p_trade_id, 'resolution', p_resolution_type)
  );
  
  RETURN jsonb_build_object('success', true, 'resolution_type', p_resolution_type);
END;
$$;

-- Insert default platform wallets
INSERT INTO public.platform_wallets (wallet_type, crypto_type, description) VALUES
  ('fees', 'BTC', 'Collected trading fees in BTC'),
  ('fees', 'USDT', 'Collected trading fees in USDT'),
  ('fees', 'ETH', 'Collected trading fees in ETH'),
  ('escrow_pool', 'BTC', 'Active escrow holdings in BTC'),
  ('escrow_pool', 'USDT', 'Active escrow holdings in USDT'),
  ('escrow_pool', 'ETH', 'Active escrow holdings in ETH'),
  ('refunds', 'BTC', 'Pending refunds in BTC'),
  ('refunds', 'USDT', 'Pending refunds in USDT'),
  ('refunds', 'ETH', 'Pending refunds in ETH');

-- Create indexes for performance
CREATE INDEX idx_treasury_ledger_created ON public.treasury_ledger(created_at DESC);
CREATE INDEX idx_treasury_ledger_type ON public.treasury_ledger(ledger_type);
CREATE INDEX idx_admin_actions_actor ON public.admin_actions(actor_id);
CREATE INDEX idx_admin_actions_created ON public.admin_actions(created_at DESC);
CREATE INDEX idx_dispute_assignments_moderator ON public.dispute_assignments(assigned_to);
CREATE INDEX idx_trade_audit_trail_trade ON public.trade_audit_trail(trade_id);
