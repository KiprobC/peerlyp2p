-- Add last_seen column to profiles for online status tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();

-- Add price_margin column to offers for percentage-based pricing
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS price_margin numeric DEFAULT 0;

-- Create index for last_seen for efficient online status queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen);

-- Create function to update last_seen timestamp
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_seen = now() 
  WHERE user_id = auth.uid();
END;
$$;

-- Create function to generate trade opening system messages
CREATE OR REPLACE FUNCTION public.create_trade_system_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_username TEXT;
  v_seller_username TEXT;
  v_buyer_message TEXT;
  v_seller_message TEXT;
BEGIN
  -- Get usernames
  SELECT COALESCE(username, full_name, 'Trader') INTO v_buyer_username 
  FROM public.profiles WHERE user_id = NEW.buyer_id;
  
  SELECT COALESCE(username, full_name, 'Trader') INTO v_seller_username 
  FROM public.profiles WHERE user_id = NEW.seller_id;
  
  -- Create buyer message (what seller sees)
  v_seller_message := format('📤 You are selling %s %s worth %s %s to @%s', 
    NEW.crypto_amount, NEW.crypto_type, NEW.fiat_currency, NEW.fiat_amount, v_buyer_username);
  
  -- Create seller message (what buyer sees)  
  v_buyer_message := format('📥 You are buying %s %s worth %s %s from @%s', 
    NEW.crypto_amount, NEW.crypto_type, NEW.fiat_currency, NEW.fiat_amount, v_seller_username);
  
  -- Insert system messages for both parties
  INSERT INTO public.trade_messages (trade_id, sender_id, message, is_system)
  VALUES 
    (NEW.id, NEW.seller_id, v_seller_message, true),
    (NEW.id, NEW.buyer_id, v_buyer_message, true);
  
  RETURN NEW;
END;
$$;

-- Create trigger for trade system messages
DROP TRIGGER IF EXISTS trigger_create_trade_system_messages ON public.trades;
CREATE TRIGGER trigger_create_trade_system_messages
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.create_trade_system_messages();

-- Enable realtime for profiles (for online status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;