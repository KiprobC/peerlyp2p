-- Fix push dispatch trigger: use net.http_post (pg_net) instead of the non-existent extensions.http_post.
-- The old body raised inside EXCEPTION WHEN OTHERS, silently swallowing every dispatch attempt,
-- which is why send-push has never received a call despite active push_subscriptions.

CREATE OR REPLACE FUNCTION public._notify_push_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'net', 'extensions'
AS $function$
DECLARE
  v_url text;
  v_key text;
  v_target_url text;
  v_payload jsonb;
BEGIN
  SELECT supabase_url, service_role_key INTO v_url, v_key FROM private.edge_config WHERE id = 1;
  IF v_url IS NULL OR v_key IS NULL OR v_key = '' THEN
    RETURN NEW;
  END IF;

  v_target_url := CASE
    WHEN NEW.type::text = 'trade' AND NEW.data ? 'trade_id'
      THEN '/trade/' || (NEW.data->>'trade_id')
    WHEN NEW.type::text = 'payment' THEN '/wallet'
    WHEN NEW.type::text = 'kyc' THEN '/profile'
    WHEN NEW.data ? 'url' THEN NEW.data->>'url'
    ELSE '/notifications'
  END;

  v_payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'notification_id', NEW.id,
    'title', NEW.title,
    'body', NEW.message,
    'type', NEW.type::text,
    'url', v_target_url,
    'data', COALESCE(NEW.data, '{}'::jsonb)
  );

  PERFORM net.http_post(
    url := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log dispatch failures instead of swallowing silently
  RAISE WARNING 'push dispatch failed for notification %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- Diagnostic RPC so admins can verify edge_config was bootstrapped without needing private schema access.
CREATE OR REPLACE FUNCTION public.admin_push_dispatch_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  SELECT supabase_url, service_role_key INTO v_url, v_key FROM private.edge_config WHERE id = 1;
  RETURN jsonb_build_object(
    'has_url', v_url IS NOT NULL AND v_url <> '',
    'has_service_role_key', v_key IS NOT NULL AND v_key <> '',
    'key_length', coalesce(length(v_key), 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_push_dispatch_status() TO authenticated;