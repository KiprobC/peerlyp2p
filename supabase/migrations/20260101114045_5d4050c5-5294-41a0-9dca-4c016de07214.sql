-- Add expires_at column to trades table to track when trade should auto-cancel
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Create function to set expires_at when trade is created based on offer's time_limit
CREATE OR REPLACE FUNCTION public.set_trade_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_time_limit INTEGER;
BEGIN
  -- Get time_limit from the offer (in minutes)
  SELECT time_limit INTO v_time_limit 
  FROM public.offers 
  WHERE id = NEW.offer_id;
  
  -- Set expires_at based on offer's time_limit (default 30 minutes if not set)
  NEW.expires_at := NEW.created_at + (COALESCE(v_time_limit, 30) * INTERVAL '1 minute');
  
  RETURN NEW;
END;
$function$;

-- Create trigger to set expiration on trade creation
DROP TRIGGER IF EXISTS set_trade_expiration_trigger ON public.trades;
CREATE TRIGGER set_trade_expiration_trigger
  BEFORE INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trade_expiration();

-- Create function to auto-cancel expired trades
-- This should be called periodically by a cron job or realtime check
CREATE OR REPLACE FUNCTION public.cancel_expired_trades()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cancelled_count INTEGER := 0;
  v_trade RECORD;
  v_seller_wallet_id UUID;
BEGIN
  -- Find all trades that are expired and haven't had payment sent
  FOR v_trade IN 
    SELECT * FROM public.trades 
    WHERE status IN ('pending', 'confirmed') 
    AND expires_at < now()
    AND expires_at IS NOT NULL
  LOOP
    -- If escrow was locked, unlock it
    IF v_trade.escrow_locked AND NOT v_trade.escrow_released THEN
      v_seller_wallet_id := public.get_or_create_wallet(v_trade.seller_id, v_trade.crypto_type);
      
      -- Return locked funds to seller
      UPDATE public.wallets 
      SET locked_balance = locked_balance - v_trade.crypto_amount,
          updated_at = now()
      WHERE id = v_seller_wallet_id;
      
      -- Log the transaction
      INSERT INTO public.wallet_transactions (
        wallet_id, user_id, type, amount, crypto_type, status, trade_id, description
      ) VALUES (
        v_seller_wallet_id, v_trade.seller_id, 'escrow_release'::transaction_type, 
        v_trade.crypto_amount, v_trade.crypto_type, 'completed', v_trade.id,
        format('Escrow returned - trade expired (Trade %s)', left(v_trade.id::text, 8))
      );
    END IF;
    
    -- Cancel the trade
    UPDATE public.trades 
    SET status = 'cancelled',
        cancelled_at = now(),
        escrow_released = true,
        updated_at = now()
    WHERE id = v_trade.id;
    
    -- Insert system message
    INSERT INTO public.trade_messages (trade_id, sender_id, message, is_system)
    VALUES (v_trade.id, v_trade.seller_id, '⏱️ Trade automatically cancelled - payment window expired.', true);
    
    -- Notify both parties
    PERFORM public.create_notification(
      v_trade.buyer_id, 'trade'::notification_type,
      'Trade Expired',
      format('Trade for %s %s was cancelled - payment window expired', v_trade.crypto_amount, v_trade.crypto_type),
      jsonb_build_object('trade_id', v_trade.id)
    );
    
    PERFORM public.create_notification(
      v_trade.seller_id, 'trade'::notification_type,
      'Trade Expired',
      format('Trade for %s %s was cancelled - buyer did not pay in time', v_trade.crypto_amount, v_trade.crypto_type),
      jsonb_build_object('trade_id', v_trade.id)
    );
    
    v_cancelled_count := v_cancelled_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object('cancelled_count', v_cancelled_count);
END;
$function$;

-- Grant execute permission to authenticated users (for frontend polling)
GRANT EXECUTE ON FUNCTION public.cancel_expired_trades() TO authenticated;