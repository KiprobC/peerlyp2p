
-- Update handle_trade_notification to include rating prompt in completed trade notifications
CREATE OR REPLACE FUNCTION public.handle_trade_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_name TEXT;
  seller_name TEXT;
  counterparty_username_buyer TEXT;
  counterparty_username_seller TEXT;
BEGIN
  -- Get trader names
  SELECT full_name, username INTO buyer_name, counterparty_username_seller FROM profiles WHERE user_id = NEW.buyer_id;
  SELECT full_name, username INTO seller_name, counterparty_username_buyer FROM profiles WHERE user_id = NEW.seller_id;
  
  -- Send notifications based on status change
  IF TG_OP = 'INSERT' THEN
    -- New trade - notify both parties
    PERFORM create_notification(
      NEW.buyer_id, 'trade'::notification_type,
      'Trade Opened',
      format('Trade for %s %s has been opened', NEW.crypto_amount, NEW.crypto_type),
      jsonb_build_object('trade_id', NEW.id)
    );
    PERFORM create_notification(
      NEW.seller_id, 'trade'::notification_type,
      'New Trade Request',
      format('%s wants to buy %s %s', COALESCE(buyer_name, 'A buyer'), NEW.crypto_amount, NEW.crypto_type),
      jsonb_build_object('trade_id', NEW.id)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'confirmed' THEN
        PERFORM create_notification(
          NEW.buyer_id, 'trade'::notification_type,
          'Escrow Locked',
          format('Crypto for trade has been locked in escrow. Please make payment.'),
          jsonb_build_object('trade_id', NEW.id)
        );
      WHEN 'payment_sent' THEN
        PERFORM create_notification(
          NEW.seller_id, 'payment'::notification_type,
          'Payment Sent',
          format('%s has marked payment as sent. Please verify and release escrow.', COALESCE(buyer_name, 'Buyer')),
          jsonb_build_object('trade_id', NEW.id)
        );
      WHEN 'completed' THEN
        -- Notify buyer with rating prompt
        PERFORM create_notification(
          NEW.buyer_id, 'trade'::notification_type,
          'Trade Completed - Rate Your Experience',
          format('Your trade for %s %s is complete! Rate @%s to help the community.', NEW.crypto_amount, NEW.crypto_type, COALESCE(counterparty_username_buyer, 'seller')),
          jsonb_build_object('trade_id', NEW.id, 'needs_rating', true, 'counterparty_username', COALESCE(counterparty_username_buyer, 'seller'))
        );
        -- Notify seller with rating prompt
        PERFORM create_notification(
          NEW.seller_id, 'trade'::notification_type,
          'Trade Completed - Rate Your Experience',
          format('Trade for %s %s is complete! Rate @%s to help the community.', NEW.crypto_amount, NEW.crypto_type, COALESCE(counterparty_username_seller, 'buyer')),
          jsonb_build_object('trade_id', NEW.id, 'needs_rating', true, 'counterparty_username', COALESCE(counterparty_username_seller, 'buyer'))
        );
      WHEN 'disputed' THEN
        PERFORM create_notification(
          NEW.buyer_id, 'trade'::notification_type,
          'Trade Disputed',
          'A dispute has been raised for this trade. Admin will review.',
          jsonb_build_object('trade_id', NEW.id)
        );
        PERFORM create_notification(
          NEW.seller_id, 'trade'::notification_type,
          'Trade Disputed',
          'A dispute has been raised for this trade. Admin will review.',
          jsonb_build_object('trade_id', NEW.id)
        );
      WHEN 'cancelled' THEN
        PERFORM create_notification(
          NEW.buyer_id, 'trade'::notification_type,
          'Trade Cancelled',
          format('Trade for %s %s has been cancelled', NEW.crypto_amount, NEW.crypto_type),
          jsonb_build_object('trade_id', NEW.id)
        );
        PERFORM create_notification(
          NEW.seller_id, 'trade'::notification_type,
          'Trade Cancelled',
          format('Trade for %s %s has been cancelled', NEW.crypto_amount, NEW.crypto_type),
          jsonb_build_object('trade_id', NEW.id)
        );
      ELSE
        NULL;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$;
