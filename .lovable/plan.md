## Passkey-based 2FA (WebAuthn) Implementation Plan

Add WebAuthn passkeys as a second factor for sensitive actions (login, withdraw, release crypto), alongside the existing TOTP/Email OTP system.

### 1. Database (migration)

New table `public.passkeys`:
- `id` uuid PK, `user_id` uuid (FK profiles/auth.users)
- `credential_id` text UNIQUE (base64url)
- `public_key` text (base64url COSE key)
- `counter` bigint default 0
- `transports` text[] (usb, nfc, ble, internal, hybrid)
- `device_name` text
- `aaguid` text nullable
- `last_used_at` timestamptz
- `created_at` timestamptz default now()

New table `public.webauthn_challenges` (short-lived):
- `id` uuid PK, `user_id` uuid nullable (null for login challenges keyed by email)
- `email` text nullable
- `challenge` text (base64url)
- `purpose` text check in ('registration','authentication','step_up')
- `expires_at` timestamptz (5 min)
- `created_at` timestamptz

RLS:
- `passkeys`: users can SELECT/UPDATE/DELETE their own; INSERT only via SECURITY DEFINER RPC. Admins can SELECT all.
- `webauthn_challenges`: no client access; only edge functions via service role.

RPC `passkey_count(_user_id uuid)` returns int (security definer, used by UI/auth flow).

Index on `passkeys(user_id)`, `webauthn_challenges(expires_at)` for cleanup.

### 2. Edge Functions

Use `@simplewebauthn/server` (Deno-compatible via esm.sh).

- `passkey-register-begin` (verify_jwt=true): generate registration options, store challenge, return PublicKeyCredentialCreationOptionsJSON.
- `passkey-register-finish` (verify_jwt=true): verify attestation, insert into `passkeys` with provided device_name. Enforce unique credential_id.
- `passkey-auth-begin` (verify_jwt=false): accept email (for login step) or current user (for step-up). Return allowCredentials + challenge.
- `passkey-auth-finish` (verify_jwt=false): verify assertion, update counter + last_used_at. For login: returns success token used by client to set MFA-passed flag. For step-up: returns short-lived signed token (JWT HS256 with project secret) the client presents to RPCs.

Origin/RP ID derived from request `Origin` header validated against allowlist (preview URL, published URL, custom domains).

Config in `supabase/config.toml`:
```
[functions.passkey-auth-begin]
verify_jwt = false
[functions.passkey-auth-finish]
verify_jwt = false
```

### 3. Frontend

New hook `src/hooks/usePasskeys.ts`:
- `listPasskeys()`, `registerPasskey(deviceName)`, `renamePasskey(id,name)`, `deletePasskey(id)`, `authenticateStepUp(purpose)`, `hasPasskey(email)`.
- Uses `@simplewebauthn/browser` (`startRegistration`, `startAuthentication`).

New components:
- `src/components/security/PasskeySetupDialog.tsx` — registration flow with device-name input and biometric prompt UI ("Use fingerprint / face to continue").
- `src/components/security/PasskeyVerifyDialog.tsx` — step-up modal with fallback "Use authenticator code instead" / "Use email OTP".
- `src/components/security/PasskeyDeviceList.tsx` — "Your Devices" list with rename/remove, last_used relative time.

Settings page: add a "Passkeys" section under Security with the device list and "Enable Passkey 2FA" button.

### 4. Auth flow integration

`AuthContext.signIn`:
- After password success, check `passkey_count` for user (via `passkey-auth-begin` returning hasPasskey). If passkeys exist, set new state `passkeyChallenge` (mirrors `mfaChallenge`). Existing TOTP path remains.
- New `completePasskeyChallenge()` calls `passkey-auth-finish`. Provides `cancelPasskeyChallenge()` and "use authenticator instead" path that falls through to existing TOTP if user has both.

`Login.tsx`: render new passkey screen ("Use fingerprint / face to continue") when `passkeyChallenge` set, with fallback buttons.

### 5. Step-up for sensitive actions

Reuse existing `OTPVerificationDialog` pattern. Add `usePasskeyStepUp` that:
- Prefers passkey when available, falls back to email OTP.
- Returns a step-up token consumed by withdraw / release-crypto RPCs (passed as parameter; backend validates token signature + purpose + freshness < 5 min).

Wire into:
- `WalletWithdraw.tsx` (withdraw)
- `ReleaseCryptoDialog.tsx` (release crypto)

### 6. Admin panel

`AdminSecurity.tsx`: add "Passkey Users" tab listing user_id, email, passkey count, last_used (via SECURITY DEFINER RPC `admin_list_passkey_users`). Flag: users with >5 failed passkey attempts in 24h (count from existing `security_events`).

### 7. Security rules

- Origin allowlist enforced server-side in both finish functions.
- Reject if challenge expired/missing/already used (delete on consume).
- Counter monotonicity check; reject if counter regresses (cloned authenticator).
- Unique constraint on `credential_id` prevents reuse across accounts.
- HTTPS-only enforced by deployment; RP ID validated.

### Files to create
- `supabase/migrations/<ts>_passkeys.sql`
- `supabase/functions/passkey-register-begin/index.ts`
- `supabase/functions/passkey-register-finish/index.ts`
- `supabase/functions/passkey-auth-begin/index.ts`
- `supabase/functions/passkey-auth-finish/index.ts`
- `src/hooks/usePasskeys.ts`
- `src/components/security/PasskeySetupDialog.tsx`
- `src/components/security/PasskeyVerifyDialog.tsx`
- `src/components/security/PasskeyDeviceList.tsx`

### Files to modify
- `supabase/config.toml` — add new function configs
- `src/contexts/AuthContext.tsx` — add passkey challenge state + completion
- `src/pages/Login.tsx` — passkey verification screen
- `src/pages/Settings.tsx` — passkeys section
- `src/pages/WalletWithdraw.tsx` — step-up integration
- `src/components/trade/ReleaseCryptoDialog.tsx` — step-up integration
- `src/pages/admin/AdminSecurity.tsx` — passkey users tab

### Open question
A step-up token signed by the edge function needs a shared HMAC secret that the RPCs can verify in Postgres. Options:
1. Use a Supabase secret + a Postgres function `verify_stepup_token(token)` reading the secret from Vault.
2. Have the edge function call the destructive RPC itself after verifying the passkey (no token passed through client).

Option 2 is simpler and more secure — the withdraw / release-crypto flows would be wrapped in edge functions that perform passkey verification then invoke the existing RPC with service role. I will use Option 2.