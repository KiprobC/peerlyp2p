-- Create deposit_addresses table for unique per-user crypto deposit addresses
CREATE TABLE public.deposit_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  crypto_type TEXT NOT NULL,
  address TEXT NOT NULL,
  network TEXT DEFAULT 'mainnet',
  is_active BOOLEAN NOT NULL DEFAULT true,
  address_generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_monitored_at TIMESTAMP WITH TIME ZONE,
  total_deposited NUMERIC NOT NULL DEFAULT 0,
  pending_amount NUMERIC NOT NULL DEFAULT 0,
  last_deposit_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one active address per user per crypto
  CONSTRAINT deposit_addresses_user_crypto_unique UNIQUE (user_id, crypto_type)
);

-- Create indexes for efficient lookups
CREATE INDEX idx_deposit_addresses_user_id ON public.deposit_addresses(user_id);
CREATE INDEX idx_deposit_addresses_address ON public.deposit_addresses(address);
CREATE INDEX idx_deposit_addresses_crypto_type ON public.deposit_addresses(crypto_type);

-- Enable RLS
ALTER TABLE public.deposit_addresses ENABLE ROW LEVEL SECURITY;

-- Users can view their own deposit addresses
CREATE POLICY "Users can view their own deposit addresses"
  ON public.deposit_addresses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own deposit addresses (for lazy generation)
CREATE POLICY "Users can insert their own deposit addresses"
  ON public.deposit_addresses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all deposit addresses
CREATE POLICY "Admins can view all deposit addresses"
  ON public.deposit_addresses
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update deposit addresses (for monitoring updates)
CREATE POLICY "Admins can update deposit addresses"
  ON public.deposit_addresses
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_deposit_addresses_updated_at
  BEFORE UPDATE ON public.deposit_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Normalize crypto_type to uppercase
CREATE TRIGGER normalize_deposit_addresses_crypto_type
  BEFORE INSERT OR UPDATE ON public.deposit_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_crypto_type_column();

-- Function to get or generate deposit address for a user
CREATE OR REPLACE FUNCTION public.get_or_create_deposit_address(p_user_id uuid, p_crypto_type text)
RETURNS TABLE(address text, is_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_crypto TEXT;
  v_existing_address TEXT;
  v_new_address TEXT;
  v_is_new BOOLEAN := false;
BEGIN
  v_crypto := UPPER(BTRIM(p_crypto_type));
  
  -- Try to find existing address
  SELECT da.address INTO v_existing_address
  FROM deposit_addresses da
  WHERE da.user_id = p_user_id AND da.crypto_type = v_crypto AND da.is_active = true;
  
  IF v_existing_address IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_address, false;
    RETURN;
  END IF;
  
  -- Generate a placeholder address (in production, this would call an external service)
  -- Format: mock address that looks realistic for each crypto type
  CASE v_crypto
    WHEN 'BTC' THEN
      v_new_address := 'bc1q' || substr(md5(p_user_id::text || v_crypto || now()::text), 1, 38);
    WHEN 'ETH' THEN
      v_new_address := '0x' || substr(md5(p_user_id::text || v_crypto || now()::text), 1, 40);
    WHEN 'USDT' THEN
      -- TRC20 format
      v_new_address := 'T' || substr(md5(p_user_id::text || v_crypto || now()::text), 1, 33);
    ELSE
      v_new_address := substr(md5(p_user_id::text || v_crypto || now()::text), 1, 42);
  END CASE;
  
  -- Insert the new address
  INSERT INTO deposit_addresses (user_id, crypto_type, address)
  VALUES (p_user_id, v_crypto, v_new_address)
  ON CONFLICT (user_id, crypto_type) DO UPDATE SET updated_at = now()
  RETURNING deposit_addresses.address INTO v_new_address;
  
  v_is_new := true;
  
  RETURN QUERY SELECT v_new_address, v_is_new;
END;
$$;