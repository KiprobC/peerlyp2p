# Peerly Production Hardening Sprint — Plan

This is a large multi-phase initiative. I'll execute it in sequenced batches with your approval at each phase boundary so we can verify behaviour before moving on. Below is the scoped plan, the order of work, and what each phase ships.

## Execution order & rationale

Phases are ordered so each layer rests on the one below. Skipping ahead risks silent corruption (e.g. push notifications before idempotency would amplify duplicate events).

```text
P1 Financial Safety  →  P2 Accounting  →  P3 Fraud  →  P4 Security
                                              ↓
P8 Validation Tests ← P7 Moderation ← P6 Audit Immutability ← P5 Push
```

---

## PHASE 1 — Financial Safety (blocking)

**1.1 Idempotency enforcement** — DB + edge functions
- Add `UNIQUE(key, scope)` index to `idempotency_keys` (already exists as table).
- Helper `claim_idempotency(key, scope, actor)` RPC: inserts pending row or returns prior `response_snapshot`.
- Update edge functions: `tatum-send-usdt` (withdraw), internal-transfer RPC, `release_escrow_with_fee`, refund flow, fee collection. All require `Idempotency-Key` header; reject with 400 if missing for mutating financial ops.

**1.2 Escrow row locking**
- Rewrite `release_escrow_with_fee`, `cancel_trade`, `refund_escrow`, `resolve_dispute` to wrap in explicit transaction with `SELECT ... FOR UPDATE` on trade row, seller wallet row, buyer wallet row, and offer row.
- Re-verify `trades.status` inside the locked transaction; raise on mismatch.

**1.3 Webhook replay protection**
- Add `UNIQUE(tx_hash, network)` partial index on `deposit_addresses`/credit ledger (verify which table holds tx_hash — likely a `deposits` ledger).
- New table `webhook_events(provider, signature, received_at, payload_hash UNIQUE, status)`.
- Tatum webhook: reject if body timestamp older than 10 min, or if `payload_hash` already seen.
- Admin page row in `/admin/security` showing rejected webhook attempts.

---

## PHASE 2 — Accounting Integrity

- New tables `reconciliation_runs` and `reconciliation_results` (with GRANTs + admin-only RLS).
- Postgres function `run_reconciliation()` computing:
  `Σwallets.balance + Σoffers.reserved_amount + Σplatform_wallets.balance == Σdeposits − Σwithdrawals − Σplatform_fees`
- pg_cron nightly schedule (02:00 UTC). Alert row inserted into `notifications` for admins when delta ≠ 0.
- Admin page `/admin/reconciliation` with status, deltas, CSV export.

---

## PHASE 3 — Fraud & Risk Enforcement

- Extend `validate_trade_action` to read `useTraderRisk` score:
  - `medium` → return `warning=true`
  - `high` → cap amount to KYC tier's reduced ceiling
  - `critical` → block withdrawals + new trades; surface `error_code=RISK_FROZEN`
- Centralised `enforce_rate_limit(action, identifier)` RPC. Wire into withdraw, deposit-address-gen, OTP, trade create, dispute create, login attempt logging.

---

## PHASE 4 — Security Hardening

- Enable `pgcrypto`; add encrypted columns `bank_account_number_enc`, `mpesa_phone_enc` (bytea) using `pgp_sym_encrypt` keyed by a Supabase Vault secret. Backfill + drop plaintext.
- `decrypt_payment_identifier(user_id)` SECURITY DEFINER RPC with `has_role('admin')` OR `auth.uid()=user_id` check, writes to `admin_actions` on access.
- Passkey signCount: already enforced in `passkey-auth-finish` (verified — counter regression returns 400). Add `>=` check (currently `<`) so equal counters also fail unless counter was 0. Add `security_events` row on regression.

---

## PHASE 5 — Push Notifications

- `push_subscriptions(user_id, endpoint UNIQUE, p256dh, auth, ua, created_at)`.
- `push_deliveries(notification_id, subscription_id, sent_at, delivered_at, failed_at, retry_count, error)`.
- VAPID keys via secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- Edge function `send-push` using `npm:web-push`. Trigger from notification insert (DB trigger → `pg_net` → edge fn) for the listed events.
- Service worker `push` + `notificationclick` handlers with deep links (`/trade/:id`, `/wallet`, `/disputes`).
- Retry queue: pg_cron every 5 min re-sends `failed_at IS NOT NULL AND retry_count < 5`.

---

## PHASE 6 — Append-Only Audit

- Revoke UPDATE, DELETE on `trade_audit_trail`, `admin_actions`, treasury ledger from all roles including `service_role`.
- Add `BEFORE UPDATE OR DELETE` triggers raising exception (defense-in-depth against superuser sessions).

---

## PHASE 7 — Moderation Assignment

- Rewrite `assign_dispute()` to:
  - Filter `moderator_availability.status='available'`
  - `active_cases_count < max_cases`
  - Order by `active_cases_count ASC, last_assigned_at ASC NULLS FIRST`
- Increment `active_cases_count` atomically inside same transaction.

---

## PHASE 8 — Validation Tests

Deno tests under `supabase/functions/*/`:
1. Spam withdrawal 100× same Idempotency-Key → 1 settlement.
2. Replay Tatum webhook → 1 deposit row.
3. 100 concurrent `start_trade` against single offer → no oversell (sum of trades ≤ offer amount).
4. Two parallel `release_escrow_with_fee` calls → one succeeds, one raises.
5. User with `risk_score='critical'` → `validate-action` returns `RISK_FROZEN`.

Run via `supabase--test_edge_functions`.

---

## Deliverables at end

- Updated readiness score, remaining issue lists, launch recommendation, change log document at `/mnt/documents/peerly-hardening-changelog.md`.

---

## How I'll work it

Given size, I propose shipping **one phase per turn**, with migration → code → verification, then pausing for your review. Phase 1 alone is ~3 migrations + ~5 edge function rewrites.

**Confirm to proceed with Phase 1**, or tell me to reorder / drop any item.
