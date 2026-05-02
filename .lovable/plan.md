# Financial Hardening: Idempotency, Locking & State Machine

Goal: make every money-moving action **safe, atomic, and repeat-proof** — no duplicate deposits, no double releases, no race conditions, with a full audit trail and an admin viewer.

---

## 1. Database changes (migration)

### `idempotency_keys` table
- `id uuid pk`
- `key text unique not null`
- `scope text not null` — `deposit | escrow_lock | release | refund | withdraw | transfer | simulate_deposit`
- `reference_id text` — tx_hash, trade_id, withdrawal_id
- `actor_id uuid` — caller (nullable for webhooks)
- `status text not null` — `pending | completed | failed`
- `response_snapshot jsonb`
- `error text`
- `created_at timestamptz default now()`
- `expires_at timestamptz default now() + interval '30 days'`

RLS: admins read all; service role writes; users read their own (`actor_id = auth.uid()`).

Indexes: `(scope, created_at desc)`, `(reference_id)`, `(expires_at)`.

### `trade_state_transitions` (allowed moves)
Lightweight reference table seeded with valid edges; used by a `assert_trade_transition(old, new)` helper. Alternatively encoded directly in a CHECK-style PL/pgSQL function — we'll use the function approach (simpler, no extra table).

```text
pending  → confirmed | cancelled | expired
confirmed→ paid | cancelled | disputed | expired
paid     → completed | disputed
disputed → completed | cancelled | resolved
```

Rejects: `completed → *`, `cancelled → *`, double `paid`, double `completed`.

### Helper SECURITY DEFINER functions
- `claim_idempotency_key(p_key, p_scope, p_reference_id, p_actor_id) returns jsonb`
  - Inserts row with `status='pending'`. On unique conflict, returns the existing row's status + snapshot so the caller can short-circuit (`{ replay: true, status, response }`) or wait (`{ in_progress: true }`).
- `complete_idempotency_key(p_key, p_response jsonb)` → marks completed, stores snapshot.
- `fail_idempotency_key(p_key, p_error text)` → marks failed (allows safe retry by clients with a *new* key, but blocks accidental replays of same key).
- `assert_trade_transition(p_trade_id uuid, p_new_status trade_status) returns void` — `SELECT ... FOR UPDATE` on the trade row, raises exception on illegal jump.

### Update existing money RPCs to use locking + idempotency + state checks
All of these get a new `p_idempotency_key text` arg and internally:
1. `claim_idempotency_key(...)` — replay short-circuit.
2. `SELECT ... FOR UPDATE` on wallet rows (and trade row where relevant) ordered by id to avoid deadlocks.
3. `assert_trade_transition(...)` where status changes.
4. Do the work inside the implicit function transaction.
5. `complete_idempotency_key(...)` with a JSON snapshot of the result.
6. On exception → `fail_idempotency_key(...)` then re-raise.

Functions touched:
- `lock_escrow` → key `escrow_lock_{trade_id}`
- `release_escrow_with_fee` → key `release_{trade_id}`, enforces transition to `completed`
- `return_escrow_with_reservation` → key `refund_{trade_id}`
- (new) `credit_deposit(p_user_id, p_crypto, p_amount, p_tx_hash, p_network, p_idempotency_key)` — single source of truth used by both `tatum-webhook` and `simulate-deposit`. Key = `deposit_{tx_hash}`. Uses `FOR UPDATE` on the wallet row.
- `process_withdrawal` (if/when it exists in withdraw flow) — key = `withdraw_{withdrawal_id}`.

### Cleanup job
`pg_cron` daily: `DELETE FROM idempotency_keys WHERE expires_at < now() AND status <> 'pending'` plus archive of last 90 days `completed` to `idempotency_keys_archive` (optional — start with delete-only).

---

## 2. Edge function changes

### `tatum-webhook` & `simulate-deposit`
- Replace inline deposit logic with a single call to the new `credit_deposit` RPC, passing `idempotency_key = 'deposit_' + tx_hash`.
- Drop the manual fetch-then-update wallet pattern (race-prone).
- Keep notification creation (idempotent because keyed off the deposit insert succeeding).

### `tatum-send-usdt`
- Already checks `escrow_released`. Add `idempotency_key = 'onchain_release_' + trade_id` to guard the on-chain send with a DB-level claim before broadcasting.

---

## 3. Frontend changes

### `useEscrow.ts`
- Generate idempotency keys deterministically (`escrow_lock_{tradeId}`, `release_{tradeId}`, `refund_{tradeId}`) and pass to the RPCs.
- Map new error code `IDEMPOTENCY_REPLAY` → silently treat as success using returned snapshot.
- Map `IN_PROGRESS` → toast "Action already in progress".
- Map `INVALID_TRANSITION` → toast specific message.

### Critical-action buttons (Release / Mark Paid / Cancel / Withdraw / Transfer)
- Audit and ensure each one:
  - disables on click,
  - shows the existing `InlineLoader`,
  - is gated by a single `isSubmitting` state with `try/finally`.
- Most already do this; we'll fix any gaps found in `ReleaseCryptoDialog`, `CancelTradeDialog`, `TradeActions`, `SendCryptoDialog`, `useInternalTransfer`, `WalletWithdraw`.

### Deposit simulation UI
- Generate a fresh UUID per click as the simulated `tx_hash` so retries don't replay (the backend will still reject true duplicates).

---

## 4. Admin panel

### New page: `/admin/idempotency` (added to AdminSidebar under System)
- DataTable of `idempotency_keys` with columns: scope, key, reference_id, status, actor, created_at, expires_at, snapshot (expandable).
- Filters: scope (select), status, search by key/reference_id (matches tx_hash & trade_id).
- Read-only; admin RLS.

---

## 5. Audit logging
Every successful RPC that uses idempotency already writes to `wallet_transactions` / `trade_audit_trail` / `admin_actions`. We'll additionally store the `idempotency_key` in those records' metadata where a JSON column exists (`admin_actions.details`, `trade_audit_trail.metadata`, `notifications.data`, `wallet_transactions.description` suffix) — non-breaking enrichment.

---

## 6. Out of scope (for this pass)
- Replacing existing webhook signature validation (separate concern).
- Building the master-wallet on-chain release config (user said "we'll get back to it").
- Withdrawal RPC overhaul if no `process_withdrawal` function exists yet — we'll only wire the idempotency key into the existing `WalletWithdraw` flow and document the gap.

---

## Rollout order
1. Migration (table + helper fns + updated RPCs + cron). **Awaits user approval.**
2. Edge function updates (`tatum-webhook`, `simulate-deposit`, `tatum-send-usdt`) → deploy.
3. Frontend hook + dialog updates.
4. Admin idempotency viewer + sidebar entry.
5. Smoke test: simulate deposit twice with same key → second is a replay; release a trade twice → second returns snapshot; attempt `paid → paid` → rejected.

---

## Risks / notes
- Changing RPC signatures is a breaking change for any in-flight callers; we'll keep the old positional args and **append** `p_idempotency_key text default null`. When null, we generate one server-side from `(scope, reference_id)` to preserve backward compatibility.
- `FOR UPDATE` inside SECURITY DEFINER functions is safe and contained to the function's transaction.
- Cleanup cron uses `pg_cron` + `pg_net`; we'll insert it via the `insert` tool (not migration) per the scheduled-jobs rule.

Confirm and I'll start with the migration.
