
-- Create internal transfers table for logging
CREATE TABLE public.internal_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  sender_username TEXT NOT NULL,
  recipient_username TEXT NOT NULL,
  crypto_type TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'completed',
  reversed_at TIMESTAMP WITH TIME ZONE,
  reversed_by UUID,
  reversal_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent self-transfers at database level
  CONSTRAINT no_self_transfer CHECK (sender_id != recipient_id)
);

-- Enable RLS
ALTER TABLE public.internal_transfers ENABLE ROW LEVEL SECURITY;

-- Users can view their own transfers (sent or received)
CREATE POLICY "Users can view their own transfers"
ON public.internal_transfers
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can insert transfers where they are the sender
CREATE POLICY "Users can create transfers as sender"
ON public.internal_transfers
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Admins can view all transfers
CREATE POLICY "Admins can view all transfers"
ON public.internal_transfers
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update transfers (for reversals)
CREATE POLICY "Admins can update transfers"
ON public.internal_transfers
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Create user transfer freeze table
CREATE TABLE public.user_transfer_freeze (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  frozen_by UUID NOT NULL,
  reason TEXT,
  frozen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_transfer_freeze ENABLE ROW LEVEL SECURITY;

-- Admins can manage freeze
CREATE POLICY "Admins can manage transfer freezes"
ON public.user_transfer_freeze
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Users can check if they are frozen
CREATE POLICY "Users can view their freeze status"
ON public.user_transfer_freeze
FOR SELECT
USING (auth.uid() = user_id);

-- Function to execute internal transfer
CREATE OR REPLACE FUNCTION public.execute_internal_transfer(
  p_recipient_username TEXT,
  p_crypto_type TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_sender_username TEXT;
  v_recipient_id UUID;
  v_sender_wallet_id UUID;
  v_recipient_wallet_id UUID;
  v_sender_balance NUMERIC;
  v_crypto TEXT;
  v_transfer_id UUID;
BEGIN
  v_sender_id := auth.uid();
  v_crypto := UPPER(BTRIM(p_crypto_type));
  
  -- Check if sender is frozen
  IF EXISTS (SELECT 1 FROM public.user_transfer_freeze WHERE user_id = v_sender_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your transfers are currently frozen. Contact support.');
  END IF;
  
  -- Get sender username
  SELECT username INTO v_sender_username FROM public.profiles WHERE user_id = v_sender_id;
  
  -- Get recipient user_id from username
  SELECT user_id INTO v_recipient_id FROM public.profiles WHERE LOWER(username) = LOWER(BTRIM(p_recipient_username));
  
  IF v_recipient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username not found');
  END IF;
  
  -- Prevent self-transfer
  IF v_sender_id = v_recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;
  
  -- Check if recipient is frozen
  IF EXISTS (SELECT 1 FROM public.user_transfer_freeze WHERE user_id = v_recipient_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient cannot receive transfers at this time');
  END IF;
  
  -- Get or create sender wallet
  v_sender_wallet_id := public.get_or_create_wallet(v_sender_id, v_crypto);
  
  -- Check sender balance
  SELECT balance - locked_balance INTO v_sender_balance FROM public.wallets WHERE id = v_sender_wallet_id;
  
  IF v_sender_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', format('Insufficient balance. Available: %s %s', v_sender_balance, v_crypto));
  END IF;
  
  -- Get or create recipient wallet
  v_recipient_wallet_id := public.get_or_create_wallet(v_recipient_id, v_crypto);
  
  -- Deduct from sender
  UPDATE public.wallets SET balance = balance - p_amount, updated_at = now() WHERE id = v_sender_wallet_id;
  
  -- Credit to recipient
  UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE id = v_recipient_wallet_id;
  
  -- Log the transfer
  INSERT INTO public.internal_transfers (sender_id, recipient_id, sender_username, recipient_username, crypto_type, amount)
  VALUES (v_sender_id, v_recipient_id, v_sender_username, p_recipient_username, v_crypto, p_amount)
  RETURNING id INTO v_transfer_id;
  
  -- Log wallet transactions for both parties
  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, crypto_type, status, description)
  VALUES 
    (v_sender_wallet_id, v_sender_id, 'withdrawal'::transaction_type, p_amount, v_crypto, 'completed', format('Sent to @%s', p_recipient_username)),
    (v_recipient_wallet_id, v_recipient_id, 'deposit'::transaction_type, p_amount, v_crypto, 'completed', format('Received from @%s', v_sender_username));
  
  -- Create notifications
  PERFORM public.create_notification(
    v_sender_id,
    'payment'::notification_type,
    'Transfer Sent',
    format('You sent %s %s to @%s', p_amount, v_crypto, p_recipient_username),
    jsonb_build_object('transfer_id', v_transfer_id, 'amount', p_amount, 'crypto', v_crypto)
  );
  
  PERFORM public.create_notification(
    v_recipient_id,
    'payment'::notification_type,
    'Transfer Received',
    format('You received %s %s from @%s', p_amount, v_crypto, v_sender_username),
    jsonb_build_object('transfer_id', v_transfer_id, 'amount', p_amount, 'crypto', v_crypto)
  );
  
  RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer_id);
END;
$$;

-- Function to reverse transfer (admin only)
CREATE OR REPLACE FUNCTION public.reverse_internal_transfer(
  p_transfer_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer RECORD;
  v_sender_wallet_id UUID;
  v_recipient_wallet_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  SELECT * INTO v_transfer FROM public.internal_transfers WHERE id = p_transfer_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer not found');
  END IF;
  
  IF v_transfer.status = 'reversed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer already reversed');
  END IF;
  
  -- Get wallets
  v_sender_wallet_id := public.get_or_create_wallet(v_transfer.sender_id, v_transfer.crypto_type);
  v_recipient_wallet_id := public.get_or_create_wallet(v_transfer.recipient_id, v_transfer.crypto_type);
  
  -- Reverse the balances
  UPDATE public.wallets SET balance = balance + v_transfer.amount WHERE id = v_sender_wallet_id;
  UPDATE public.wallets SET balance = balance - v_transfer.amount WHERE id = v_recipient_wallet_id;
  
  -- Mark transfer as reversed
  UPDATE public.internal_transfers 
  SET status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason
  WHERE id = p_transfer_id;
  
  -- Notify both parties
  PERFORM public.create_notification(
    v_transfer.sender_id,
    'system'::notification_type,
    'Transfer Reversed',
    format('Your transfer of %s %s to @%s has been reversed by admin', v_transfer.amount, v_transfer.crypto_type, v_transfer.recipient_username),
    jsonb_build_object('transfer_id', p_transfer_id)
  );
  
  PERFORM public.create_notification(
    v_transfer.recipient_id,
    'system'::notification_type,
    'Transfer Reversed',
    format('The transfer of %s %s from @%s has been reversed by admin', v_transfer.amount, v_transfer.crypto_type, v_transfer.sender_username),
    jsonb_build_object('transfer_id', p_transfer_id)
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to get user profile preview by username
CREATE OR REPLACE FUNCTION public.get_user_by_username(p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT 
    p.user_id,
    p.username,
    p.avatar_url,
    p.rating,
    p.total_trades,
    p.is_verified,
    p.created_at
  INTO v_profile
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(BTRIM(p_username)) AND p.setup_completed = true;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  RETURN jsonb_build_object(
    'user_id', v_profile.user_id,
    'username', v_profile.username,
    'avatar_url', v_profile.avatar_url,
    'rating', v_profile.rating,
    'total_trades', v_profile.total_trades,
    'is_verified', v_profile.is_verified,
    'member_since', v_profile.created_at
  );
END;
$$;
