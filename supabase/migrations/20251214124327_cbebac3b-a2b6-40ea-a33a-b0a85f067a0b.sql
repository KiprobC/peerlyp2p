-- Add trade_ratings table for storing ratings
CREATE TABLE IF NOT EXISTS public.trade_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL,
  rated_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(trade_id, rater_id)
);

-- Enable RLS on trade_ratings
ALTER TABLE public.trade_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies for trade_ratings
CREATE POLICY "Users can view ratings for their trades" ON public.trade_ratings
  FOR SELECT USING (
    rater_id = auth.uid() OR rated_id = auth.uid() OR
    EXISTS (SELECT 1 FROM trades WHERE trades.id = trade_id AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid()))
  );

CREATE POLICY "Users can create ratings for their completed trades" ON public.trade_ratings
  FOR INSERT WITH CHECK (
    rater_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM trades 
      WHERE trades.id = trade_id 
      AND trades.status = 'completed'
      AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
    )
  );

-- Add active_trade_count column to offers for tracking
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS active_trade_count INTEGER DEFAULT 0;

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_data)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Function to update user rating after trade completion
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the rated user's average rating
  UPDATE profiles
  SET rating = (
    SELECT COALESCE(AVG(rating)::numeric, 0)
    FROM trade_ratings
    WHERE rated_id = NEW.rated_id
  )
  WHERE user_id = NEW.rated_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update rating after new rating is inserted
DROP TRIGGER IF EXISTS on_trade_rating_created ON public.trade_ratings;
CREATE TRIGGER on_trade_rating_created
  AFTER INSERT ON public.trade_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_rating();

-- Function to handle trade status changes and send notifications
CREATE OR REPLACE FUNCTION public.handle_trade_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_name TEXT;
  seller_name TEXT;
BEGIN
  -- Get trader names
  SELECT full_name INTO buyer_name FROM profiles WHERE user_id = NEW.buyer_id;
  SELECT full_name INTO seller_name FROM profiles WHERE user_id = NEW.seller_id;
  
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
        PERFORM create_notification(
          NEW.buyer_id, 'trade'::notification_type,
          'Trade Completed',
          format('Your trade for %s %s has been completed!', NEW.crypto_amount, NEW.crypto_type),
          jsonb_build_object('trade_id', NEW.id)
        );
        PERFORM create_notification(
          NEW.seller_id, 'trade'::notification_type,
          'Trade Completed',
          format('Trade for %s %s has been completed!', NEW.crypto_amount, NEW.crypto_type),
          jsonb_build_object('trade_id', NEW.id)
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

-- Trigger for trade notifications
DROP TRIGGER IF EXISTS on_trade_change_notify ON public.trades;
CREATE TRIGGER on_trade_change_notify
  AFTER INSERT OR UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_trade_notification();

-- Function to handle KYC status change notifications
CREATE OR REPLACE FUNCTION public.handle_kyc_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.kyc_status IS DISTINCT FROM NEW.kyc_status THEN
    CASE NEW.kyc_status
      WHEN 'verified' THEN
        PERFORM create_notification(
          NEW.user_id, 'kyc'::notification_type,
          'KYC Approved',
          'Your identity verification has been approved. You now have full access to all features!',
          NULL
        );
      WHEN 'rejected' THEN
        PERFORM create_notification(
          NEW.user_id, 'kyc'::notification_type,
          'KYC Rejected',
          'Your identity verification was rejected. Please upload new documents and try again.',
          NULL
        );
      ELSE
        NULL;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for KYC notifications
DROP TRIGGER IF EXISTS on_kyc_status_change ON public.profiles;
CREATE TRIGGER on_kyc_status_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_kyc_notification();

-- Function to handle trade message notifications
CREATE OR REPLACE FUNCTION public.handle_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
  sender_name TEXT;
  trade_record RECORD;
BEGIN
  IF NEW.is_system = true THEN
    RETURN NEW;
  END IF;
  
  SELECT * INTO trade_record FROM trades WHERE id = NEW.trade_id;
  
  IF NEW.sender_id = trade_record.buyer_id THEN
    recipient_id := trade_record.seller_id;
  ELSE
    recipient_id := trade_record.buyer_id;
  END IF;
  
  SELECT full_name INTO sender_name FROM profiles WHERE user_id = NEW.sender_id;
  
  PERFORM create_notification(
    recipient_id, 'message'::notification_type,
    'New Message',
    format('%s sent you a message', COALESCE(sender_name, 'Trader')),
    jsonb_build_object('trade_id', NEW.trade_id)
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for message notifications
DROP TRIGGER IF EXISTS on_trade_message_created ON public.trade_messages;
CREATE TRIGGER on_trade_message_created
  AFTER INSERT ON public.trade_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_message_notification();