-- Update the trigger function to use new payment sent message text
CREATE OR REPLACE FUNCTION notify_payment_sent()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to payment_sent
  IF NEW.status = 'payment_sent' AND (OLD.status IS NULL OR OLD.status != 'payment_sent') THEN
    -- Insert system message
    INSERT INTO trade_messages (trade_id, sender_id, message, is_system)
    VALUES (
      NEW.id,
      NEW.buyer_id,
      '💸 Buyer has marked payment as sent. Seller, please verify your payment and release the crypto once confirmed.',
      true
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;