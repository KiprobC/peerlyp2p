-- Create the trade and secure the seller's escrow in one transaction.
CREATE OR REPLACE FUNCTION public.create_trade_with_escrow(
  p_offer_id uuid,
  p_buyer_id uuid,
  p_seller_id uuid,
  p_crypto_type text,
  p_crypto_amount numeric,
  p_fiat_amount numeric,
  p_fiat_currency text,
  p_payment_method text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_claim jsonb;
  v_offer RECORD;
  v_trade RECORD;
  v_lock_result jsonb;
  v_response jsonb;
BEGIN
  IF v_uid IS NULL OR (v_uid <> p_buyer_id AND v_uid <> p_seller_id) THEN
    RAISE EXCEPTION 'Not authorized to create this trade' USING ERRCODE = '42501';
  END IF;

  -- Lock the offer row while validating availability and securing escrow.
  SELECT * INTO v_offer
  FROM public.offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer is no longer available';
  END IF;

  IF (v_offer.type = 'buy' AND v_offer.user_id <> p_buyer_id)
     OR (v_offer.type = 'sell' AND v_offer.user_id <> p_seller_id) THEN
    RAISE EXCEPTION 'Trade participants do not match the offer';
  END IF;

  -- A retried request must reuse the already secured active trade.
  SELECT * INTO v_trade
  FROM public.trades
  WHERE offer_id = p_offer_id
    AND buyer_id = p_buyer_id
    AND seller_id = p_seller_id
    AND status NOT IN ('completed', 'cancelled')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_response := jsonb_build_object('success', true, 'trade', to_jsonb(v_trade));
    RETURN v_response;
  END IF;

  IF v_offer.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Offer is no longer available';
  END IF;

  v_claim := public.claim_idempotency_key(
    p_idempotency_key,
    'trade_create_with_escrow',
    p_offer_id::text,
    v_uid
  );
  IF (v_claim->>'replay')::boolean THEN
    RETURN (v_claim->'response') || jsonb_build_object('replay', true);
  END IF;
  IF (v_claim->>'in_progress')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade creation already in progress', 'in_progress', true);
  END IF;

  INSERT INTO public.trades (
    offer_id,
    buyer_id,
    seller_id,
    crypto_type,
    crypto_amount,
    fiat_amount,
    fiat_currency,
    payment_method,
    status,
    escrow_locked,
    escrow_released
  ) VALUES (
    p_offer_id,
    p_buyer_id,
    p_seller_id,
    p_crypto_type,
    p_crypto_amount,
    p_fiat_amount,
    p_fiat_currency,
    p_payment_method,
    'pending',
    false,
    false
  )
  RETURNING * INTO v_trade;

  v_lock_result := public.lock_escrow_internal(
    v_trade.seller_id,
    v_trade.crypto_type,
    v_trade.crypto_amount,
    v_trade.id
  );

  IF COALESCE((v_lock_result->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', COALESCE(v_lock_result->>'error', 'Failed to lock escrow');
  END IF;

  UPDATE public.trades
  SET status = 'confirmed',
      escrow_locked = true,
      updated_at = now()
  WHERE id = v_trade.id
  RETURNING * INTO v_trade;

  v_response := jsonb_build_object('success', true, 'trade', to_jsonb(v_trade));
  PERFORM public.complete_idempotency_key(p_idempotency_key, v_response);
  RETURN v_response;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_trade_with_escrow(uuid, uuid, uuid, text, numeric, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_trade_with_escrow(uuid, uuid, uuid, text, numeric, numeric, text, text, text) TO authenticated, service_role;
