-- Focused server-side security contracts.
-- Run with `supabase db test` against a database with the migrations applied.

BEGIN;
SELECT plan(13);

SELECT ok(
  NOT has_function_privilege('anon', 'public.credit_deposit(uuid,text,numeric,text,text,text,boolean)', 'EXECUTE'),
  'anonymous callers cannot execute credit_deposit'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.credit_deposit(uuid,text,numeric,text,text,text,boolean)', 'EXECUTE'),
  'authenticated callers cannot execute credit_deposit directly'
);
SELECT ok(
  has_function_privilege('service_role', 'public.credit_deposit(uuid,text,numeric,text,text,text,boolean)', 'EXECUTE'),
  'service role can execute credit_deposit for verified automation'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.credit_buyer_wallet(uuid,numeric)', 'EXECUTE'),
  'anonymous callers cannot execute legacy wallet crediting'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.credit_buyer_wallet(uuid,numeric)', 'EXECUTE'),
  'authenticated callers cannot execute legacy wallet crediting directly'
);
SELECT ok(
  has_function_privilege('service_role', 'public.credit_buyer_wallet(uuid,numeric)', 'EXECUTE'),
  'service role can execute legacy wallet crediting for trusted workflows'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.submit_withdrawal_request(text,text,numeric,numeric,text,text)', 'EXECUTE'),
  'anonymous callers cannot submit withdrawals'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.submit_withdrawal_request(text,text,numeric,numeric,text,text)', 'EXECUTE'),
  'authenticated callers can reach the guarded withdrawal entry point'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.assert_step_up(text,integer)', 'EXECUTE'),
  'anonymous callers cannot invoke step-up assertions'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.assert_step_up(text,integer)', 'EXECUTE'),
  'authenticated callers can invoke server-side step-up assertions'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.execute_internal_transfer_internal(text,text,numeric,text)', 'EXECUTE'),
  'authenticated callers cannot invoke the trusted transfer implementation'
);
SELECT ok(
  position('passkey_step_up' in pg_get_functiondef('public.assert_step_up(text,integer)'::regprocedure)) > 0
    AND position('passkey_login' in pg_get_functiondef('public.assert_step_up(text,integer)'::regprocedure)) = 0,
  'ordinary passkey login events do not satisfy step-up'
);
SELECT ok(
  position('p_amount' in pg_get_functiondef('public.submit_withdrawal_request(text,text,numeric,numeric,text,text)'::regprocedure)) > 0
    AND position('p_fee' in pg_get_functiondef('public.submit_withdrawal_request(text,text,numeric,numeric,text,text)'::regprocedure)) > 0,
  'withdrawal entry point remains compatible while fee authority is server-side'
);

SELECT * FROM finish();
ROLLBACK;
