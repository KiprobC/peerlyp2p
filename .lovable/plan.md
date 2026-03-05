

## Auto-Flag Suspicious Trader Detection & Scammer Fingerprint System

### Overview
Two interconnected systems: (1) automated behavioral risk scoring per trader, and (2) device fingerprinting for multi-account detection. Both feed into a unified risk status visible on trader profiles and moderator dashboards.

### Database Changes (Migration)

**Table 1: `trader_behavior_metrics`** — Materialized per-user stats, updated via trigger on trade status changes.
- `user_id` (UUID, PK, references auth.users)
- `total_trades`, `completed_trades`, `cancelled_trades`, `disputes_raised_against`, `disputes_started_by`, `failed_payment_reports` (integers, default 0)
- `average_release_time_minutes` (numeric, nullable)
- `risk_score` (numeric, default 0)
- `risk_level` (text: trusted/normal/watchlist/high_risk, default 'normal')
- `last_trade_at`, `updated_at` (timestamps)
- RLS: Users can read own; admins/moderators can read all; no direct user writes.

**Table 2: `user_risk_alerts`** — Per-user triggered risk flags (distinct from the existing `risk_flags` which stores rule templates).
- `id`, `user_id`, `risk_type` (text: high_dispute_rate, mass_cancellation, slow_release, payment_reports, multiple_disputes_daily, shared_device, shared_ip, linked_to_banned)
- `description`, `severity` (low/medium/high/critical)
- `is_resolved` (boolean, default false), `resolved_by`, `resolution` (text), `resolved_at`
- `created_at`
- RLS: Admins/moderators full access; users cannot see.

**Table 3: `user_fingerprints`** — Device/browser fingerprints captured automatically.
- `id`, `user_id`, `ip_address`, `device_type`, `browser`, `operating_system`, `screen_resolution`, `timezone`, `device_hash` (text), `action_type` (login/trade_open/chat_message/dispute), `created_at`
- RLS: Only admins can read; no user access.

**Database function: `recalculate_trader_risk(p_user_id UUID)`** — SECURITY DEFINER function that:
1. Aggregates stats from `trades` table into `trader_behavior_metrics` (upsert)
2. Calculates risk_score using the formula: `(dispute_rate * 40) + (cancel_rate * 20) + (slow_release_score * 20) + (reports * 20)`
3. Maps score to risk_level (0-20 trusted, 21-40 normal, 41-60 watchlist, 61+ high_risk)
4. Checks rule triggers (dispute rate >25%, >5 cancellations in 24h, avg release >90min, etc.) and inserts into `user_risk_alerts`

**Trigger: `on_trade_status_change`** — After UPDATE on `trades`, calls `recalculate_trader_risk` for both buyer and seller when status changes to completed/cancelled/disputed.

### Edge Function: `collect-fingerprint`
- Receives fingerprint data from frontend (IP from request headers, device info from body)
- Generates `device_hash` server-side from IP+browser+OS+device+resolution
- Stores in `user_fingerprints`
- Checks for matching `device_hash` or IP across different users → creates `user_risk_alerts` if found
- Cross-references against banned users

### Frontend Changes

**1. Fingerprint collection utility (`src/lib/fingerprint.ts`)**
- Collects browser, OS, device type, screen resolution, timezone from `navigator`
- Sends to edge function on login, trade open, dispute raise

**2. Hook: `useTraderRisk.ts`**
- Fetches `trader_behavior_metrics` for a given user_id
- Returns risk_level, risk_score for display

**3. TraderProfilePanel update**
- Add risk badge below username: colored dot + label (Trusted/Normal/Watchlist/High Risk)
- Only show badge, no technical details to regular users

**4. Trade chat risk warning banner**
- If counterparty risk_level is "watchlist" or "high_risk", show warning banner: "This trader is flagged for suspicious activity. Trade with caution."

**5. Moderator Dashboard: "Suspicious Traders" section**
- New card listing users with active `user_risk_alerts`
- Shows risk_level badge, alert count, latest alert description
- Action buttons: Warn, Restrict Trading, Suspend, Ban (these update profile/flags)

**6. Admin Panel: Fingerprint viewer**
- On AdminUsers page, add ability to view fingerprint data for a selected user
- Shows IP history, devices, matching accounts

### Files to Create/Modify
- **New migration SQL** (tables + function + trigger)
- **New**: `supabase/functions/collect-fingerprint/index.ts`
- **New**: `src/lib/fingerprint.ts`
- **New**: `src/hooks/useTraderRisk.ts`
- **Modified**: `src/components/trade/TraderProfilePanel.tsx` — add risk badge
- **Modified**: `src/pages/Trade.tsx` — add risk warning banner, call fingerprint on trade open
- **Modified**: `src/pages/moderator/ModeratorDashboard.tsx` — add Suspicious Traders card
- **Modified**: `src/contexts/AuthContext.tsx` — call fingerprint on login
- **Modified**: `src/hooks/useTraderProfile.ts` — include risk data in fetch

