-- Create function to insert system messages on payment_sent status
CREATE OR REPLACE FUNCTION public.handle_payment_sent_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger when status changes to payment_sent
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'payment_sent' THEN
    -- Insert system message for the trade chat
    INSERT INTO trade_messages (trade_id, sender_id, message, is_system)
    VALUES (
      NEW.id,
      NEW.buyer_id,
      '💸 Buyer has marked payment as sent. Seller, please verify your payment method and release the crypto once confirmed.',
      true
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for payment sent messages
DROP TRIGGER IF EXISTS on_payment_sent_message ON trades;
CREATE TRIGGER on_payment_sent_message
  AFTER UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION handle_payment_sent_messages();