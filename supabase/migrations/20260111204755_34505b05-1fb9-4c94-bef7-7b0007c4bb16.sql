-- Create function to create sell offers with balance reservation
CREATE OR REPLACE FUNCTION public.create_sell_offer_with_reservation(
  p_user_id uuid,
  p_crypto_type text,
  p_crypto_amount numeric,
  p_price_per_unit numeric,
  p_price_margin numeric,
  p_min_amount numeric,
  p_max_amount numeric,
  p_payment_methods text[],
  p_time_limit integer,
  p_terms text,
  p_fiat_currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_available_balance numeric;
  v_normalized_crypto text;
  v_offer_id uuid;
BEGIN
  -- Normalize crypto type
  v_normalized_crypto := UPPER(BTRIM(p_crypto_type));
  
  -- Get available balance using existing function
  v_available_balance := public.get_available_balance(p_user_id, v_normalized_crypto);
  
  -- Check if user has enough balance
  IF v_available_balance < p_crypto_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient balance. Available: %s %s, Required: %s %s', 
        v_available_balance, v_normalized_crypto, p_crypto_amount, v_normalized_crypto),
      'available_balance', v_available_balance
    );
  END IF;
  
  -- Create the offer
  INSERT INTO public.offers (
    user_id,
    type,
    crypto_type,
    crypto_amount,
    price_per_unit,
    price_margin,
    min_amount,
    max_amount,
    payment_methods,
    time_limit,
    terms,
    fiat_currency,
    is_active
  ) VALUES (
    p_user_id,
    'sell',
    v_normalized_crypto,
    p_crypto_amount,
    p_price_per_unit,
    p_price_margin,
    p_min_amount,
    p_max_amount,
    p_payment_methods,
    p_time_limit,
    p_terms,
    p_fiat_currency,
    true
  )
  RETURNING id INTO v_offer_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'offer_id', v_offer_id
  );
END;
$$;