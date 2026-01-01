-- Create function to handle trade status change messages
CREATE OR REPLACE FUNCTION public.handle_trade_status_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_message TEXT;
  v_buyer_username TEXT;
  v_seller_username TEXT;
BEGIN
  -- Only proceed if status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get usernames for context
  SELECT COALESCE(username, full_name, 'Buyer') INTO v_buyer_username 
  FROM public.profiles WHERE user_id = NEW.buyer_id;
  
  SELECT COALESCE(username, full_name, 'Seller') INTO v_seller_username 
  FROM public.profiles WHERE user_id = NEW.seller_id;
  
  -- Determine message based on new status
  CASE NEW.status
    WHEN 'confirmed' THEN
      v_message := format('🔒 Escrow locked! @%s has secured %s %s in escrow. @%s, please make your payment now.', 
        v_seller_username, NEW.crypto_amount, NEW.crypto_type, v_buyer_username);
    
    WHEN 'completed' THEN
      v_message := format('✅ Trade completed successfully! %s %s has been released to @%s.', 
        NEW.crypto_amount, NEW.crypto_type, v_buyer_username);
    
    WHEN 'cancelled' THEN
      IF NEW.cancelled_by = NEW.buyer_id THEN
        v_message := format('❌ Trade cancelled by @%s.', v_buyer_username);
      ELSIF NEW.cancelled_by = NEW.seller_id THEN
        v_message := format('❌ Trade cancelled by @%s.', v_seller_username);
      ELSE
        v_message := '❌ Trade has been cancelled by admin.';
      END IF;
    
    WHEN 'disputed' THEN
      v_message := format('⚠️ A dispute has been raised by @%s. An admin will review this trade.', 
        CASE WHEN NEW.disputed_by = NEW.buyer_id THEN v_buyer_username ELSE v_seller_username END);
      IF NEW.dispute_reason IS NOT NULL AND NEW.dispute_reason <> '' THEN
        v_message := v_message || format(' Reason: %s', NEW.dispute_reason);
      END IF;
    
    ELSE
      -- No message for other status changes
      RETURN NEW;
  END CASE;
  
  -- Insert the system message
  INSERT INTO public.trade_messages (trade_id, sender_id, message, is_system)
  VALUES (NEW.id, COALESCE(NEW.cancelled_by, NEW.disputed_by, NEW.seller_id), v_message, true);
  
  RETURN NEW;
END;
$function$;

-- Create trigger for trade status changes
DROP TRIGGER IF EXISTS on_trade_status_change ON public.trades;
CREATE TRIGGER on_trade_status_change
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_trade_status_messages();

-- Update resolve_dispute function to add system messages for resolution outcomes
CREATE OR REPLACE FUNCTION public.resolve_dispute(p_trade_id uuid, p_resolution_type text, p_resolution_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_resolution_message TEXT;
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
      v_resolution_message := format('⚖️ Dispute resolved by admin: %s %s released to buyer.', v_trade.crypto_amount, v_trade.crypto_type);
      
    WHEN 'release_to_seller' THEN
      UPDATE public.wallets SET locked_balance = locked_balance - v_trade.crypto_amount, balance = balance + v_trade.crypto_amount WHERE id = v_seller_wallet_id;
      UPDATE public.trades SET status = 'cancelled', escrow_released = true, cancelled_at = now() WHERE id = p_trade_id;
      v_resolution_message := format('⚖️ Dispute resolved by admin: %s %s returned to seller.', v_trade.crypto_amount, v_trade.crypto_type);
      
    WHEN 'split' THEN
      UPDATE public.wallets SET locked_balance = locked_balance - v_trade.crypto_amount, balance = balance + (v_trade.crypto_amount / 2) WHERE id = v_seller_wallet_id;
      UPDATE public.wallets SET balance = balance + (v_trade.crypto_amount / 2) WHERE id = v_buyer_wallet_id;
      UPDATE public.trades SET status = 'completed', escrow_released = true, completed_at = now() WHERE id = p_trade_id;
      v_resolution_message := format('⚖️ Dispute resolved by admin: %s %s split equally between both parties.', v_trade.crypto_amount, v_trade.crypto_type);
      
    ELSE
      RAISE EXCEPTION 'Invalid resolution type';
  END CASE;
  
  -- Insert resolution system message
  INSERT INTO public.trade_messages (trade_id, sender_id, message, is_system)
  VALUES (p_trade_id, auth.uid(), v_resolution_message, true);
  
  -- Add resolution notes as separate message if provided
  IF p_resolution_notes IS NOT NULL AND p_resolution_notes <> '' THEN
    INSERT INTO public.trade_messages (trade_id, sender_id, message, is_system)
    VALUES (p_trade_id, auth.uid(), format('📝 Admin notes: %s', p_resolution_notes), true);
  END IF;
  
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
$function$;