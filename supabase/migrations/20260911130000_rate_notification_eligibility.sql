-- Only prompt for a rating when the current trader has not rated this counterparty.
CREATE OR REPLACE FUNCTION public.handle_trade_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  buyer_username TEXT;
  seller_username TEXT;
  amt TEXT;
BEGIN
  SELECT COALESCE(username, 'trader') INTO buyer_username FROM profiles WHERE user_id = NEW.buyer_id;
  SELECT COALESCE(username, 'trader') INTO seller_username FROM profiles WHERE user_id = NEW.seller_id;
  buyer_username := COALESCE(buyer_username, 'trader');
  seller_username := COALESCE(seller_username, 'trader');
  amt := trim(trailing '.' from trim(trailing '0' from to_char(NEW.crypto_amount, 'FM999999999990.00000000')));

  IF TG_OP = 'INSERT' THEN
    PERFORM create_notification(
      NEW.buyer_id, 'trade'::notification_type,
      'New Trade Request',
      format('@%s is selling you %s %s. Open the trade to complete payment.', seller_username, amt, NEW.crypto_type),
      jsonb_build_object('trade_id', NEW.id)
    );
    PERFORM create_notification(
      NEW.seller_id, 'trade'::notification_type,
      'New Trade',
      format('You are selling %s %s to @%s. Open the trade to continue.', amt, NEW.crypto_type, buyer_username),
      jsonb_build_object('trade_id', NEW.id)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'confirmed' THEN
        PERFORM create_notification(
          NEW.buyer_id, 'trade'::notification_type,
          'Escrow Locked',
          format('@%s locked %s %s in escrow. Make your payment to continue.', seller_username, amt, NEW.crypto_type),
          jsonb_build_object('trade_id', NEW.id)
        );
        PERFORM create_notification(
          NEW.seller_id, 'trade'::notification_type,
          'Escrow Locked',
          format('Your %s %s is locked in escrow for @%s. Wait for their payment.', amt, NEW.crypto_type, buyer_username),
          jsonb_build_object('trade_id', NEW.id)
        );
      WHEN 'payment_sent' THEN
        PERFORM create_notification(
          NEW.seller_id, 'payment'::notification_type,
          'Payment Sent',
          format('@%s marked payment as sent for %s %s. Verify it and release the crypto.', buyer_username, amt, NEW.crypto_type),
          jsonb_build_object('trade_id', NEW.id)
        );
      WHEN 'completed' THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.trade_ratings
          WHERE rater_id = NEW.buyer_id
            AND rated_id = NEW.seller_id
        ) THEN
          PERFORM create_notification(
            NEW.buyer_id, 'trade'::notification_type,
            'Trade Completed',
            format('You bought %s %s from @%s. Rate @%s to help the community.', amt, NEW.crypto_type, seller_username, seller_username),
            jsonb_build_object('trade_id', NEW.id, 'needs_rating', true, 'counterparty_username', seller_username)
          );
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM public.trade_ratings
          WHERE rater_id = NEW.seller_id
            AND rated_id = NEW.buyer_id
        ) THEN
          PERFORM create_notification(
            NEW.seller_id, 'trade'::notification_type,
            'Trade Completed',
            format('You sold %s %s to @%s. Rate @%s to help the community.', amt, NEW.crypto_type, buyer_username, buyer_username),
            jsonb_build_object('trade_id', NEW.id, 'needs_rating', true, 'counterparty_username', buyer_username)
          );
        END IF;
      WHEN 'disputed' THEN
        PERFORM create_notification(
          NEW.buyer_id, 'trade'::notification_type,
          'Trade Disputed',
          format('Your trade with @%s for %s %s is under dispute review.', seller_username, amt, NEW.crypto_type),
          jsonb_build_object('trade_id', NEW.id)
        );
        PERFORM create_notification(
          NEW.seller_id, 'trade'::notification_type,
          'Trade Disputed',
          format('Your trade with @%s for %s %s is under dispute review.', buyer_username, amt, NEW.crypto_type),
          jsonb_build_object('trade_id', NEW.id)
        );
      WHEN 'cancelled' THEN
        PERFORM create_notification(
          NEW.buyer_id, 'trade'::notification_type,
          'Trade Cancelled',
          format('Your trade with @%s for %s %s was cancelled.', seller_username, amt, NEW.crypto_type),
          jsonb_build_object('trade_id', NEW.id)
        );
        PERFORM create_notification(
          NEW.seller_id, 'trade'::notification_type,
          'Trade Cancelled',
          format('Your trade with @%s for %s %s was cancelled.', buyer_username, amt, NEW.crypto_type),
          jsonb_build_object('trade_id', NEW.id)
        );
      ELSE
        NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$function$;
