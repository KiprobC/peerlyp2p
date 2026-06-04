
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS private.edge_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  supabase_url text NOT NULL,
  service_role_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.edge_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.edge_config TO service_role;

INSERT INTO private.edge_config (id, supabase_url)
VALUES (1, 'https://nrvdpphlnxnpbdvqmqvm.supabase.co')
ON CONFLICT (id) DO NOTHING;

-- Admin RPC to set the service role key for push dispatch
CREATE OR REPLACE FUNCTION public.admin_set_push_dispatch_config(p_service_role_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  UPDATE private.edge_config
     SET service_role_key = p_service_role_key,
         updated_at = now()
   WHERE id = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_push_dispatch_config(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_push_dispatch_config(text) TO authenticated;

-- Trigger function: fan out push notification when a notification row is inserted
CREATE OR REPLACE FUNCTION public._notify_push_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
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

  PERFORM extensions.http_post(
    url := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_dispatch ON public.notifications;
CREATE TRIGGER trg_notify_push_dispatch
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public._notify_push_dispatch();

-- Security fix: only admins may insert wallet_transactions directly (others use SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins can insert transactions" ON public.wallet_transactions;
CREATE POLICY "Admins can insert transactions"
ON public.wallet_transactions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
