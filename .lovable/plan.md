## KYC Auto-Verification Bot + Manual Admin Approval + Document Reuse Prevention

### Goals
1. Automatic bot that scores KYC submissions and auto-approves/rejects/escalates.
2. Admins can manually review every submission with full document/image visibility.
3. Same physical document (ID number, image hash) cannot be reused across multiple accounts.

---

### 1. Database (migration)

**`kyc_submissions`** — one row per submission attempt (immutable history)
- `id`, `user_id`, `country_code`, `id_type`, `id_number`
- `id_front_url`, `id_back_url`, `selfie_url`
- `id_front_hash`, `id_back_hash`, `selfie_hash` (sha256 of file bytes)
- `status` — `pending | auto_approved | auto_rejected | needs_review | manually_approved | manually_rejected`
- `bot_score` numeric, `bot_checks` jsonb, `bot_reason` text
- `reviewer_id`, `reviewed_at`, `review_notes`
- `created_at`

**`kyc_document_fingerprints`** — global dedup index
- `id`, `fingerprint` (text, unique), `kind` (`id_number | image_hash`)
- `user_id` (first claimer), `submission_id`, `created_at`
- Unique index on `(fingerprint, kind)` blocks re-use across users.

**RLS**
- `kyc_submissions`: user reads own; admins read/update all.
- `kyc_document_fingerprints`: admin only (service role writes).

**RPC `claim_kyc_fingerprints(p_submission_id, p_user_id, p_fingerprints jsonb[])`**
- Inserts each fingerprint atomically; on conflict where `user_id != p_user_id` raises `DOCUMENT_REUSED`.

**RPC `finalize_kyc_decision(p_submission_id, p_decision, p_reviewer, p_notes)`**
- Updates submission + writes to `profiles.kyc_status` + audit log.

---

### 2. Edge function `kyc-auto-verify` (called on submission)

Inputs: `submission_id`.

Steps:
1. Load submission + uploaded files from storage.
2. Compute SHA-256 of each image → call `claim_kyc_fingerprints` with `[id_number, id_front_hash, id_back_hash, selfie_hash]`. If conflict → mark `auto_rejected` with `reason: document_reused`.
3. Run **bot checks** (each contributes to score 0–100):
   - **Field validity**: id_number length/format per country, name not empty, DOB ≥ 18.
   - **Image quality** via Lovable AI (`google/gemini-2.5-flash`, multimodal): for each image ask "Is this a clear, unedited photo of a government ID / a live selfie? Return JSON {valid, confidence, issues}".
   - **ID/Selfie match**: send id_front + selfie to Gemini, "Do these depict the same person? JSON {match, confidence}".
   - **Name match**: extract OCR name from ID image via Gemini, compare to profile full_name (Levenshtein-like in JS).
   - **Country match**: ID country == selected country.
4. Aggregate score:
   - `≥ 85` AND no critical fail → `auto_approved` → set `profiles.kyc_status = verified`, `kyc_verified_at = now()`.
   - `≤ 40` OR critical fail (image_invalid, country_mismatch) → `auto_rejected`.
   - Otherwise → `needs_review` (sent to admin queue).
5. Emit notification to user + (if `needs_review`) to admins.

Function deployed with `verify_jwt = true` (called from frontend after upload).

---

### 3. Frontend changes

**`KYCUpload.tsx`**
- After uploading the 3 images + form submission, insert a `kyc_submissions` row, then `supabase.functions.invoke('kyc-auto-verify', { body: { submission_id } })`.
- Show live state: "Bot is reviewing your documents…" → result screen (approved / rejected with reason / pending manual review).
- On `document_reused` show specific message.

**`AdminKYC.tsx` (rebuild as review queue)**
- Tabs: `Needs Review` (default), `Auto-Approved`, `Auto-Rejected`, `All`.
- Row click → drawer with:
  - Profile data (name, DOB, country, id_number).
  - Three document images (signed URLs from storage, viewable inline + downloadable).
  - Bot score, per-check breakdown (`bot_checks` jsonb pretty-printed).
  - Approve / Reject buttons → calls `finalize_kyc_decision` RPC; reject requires note.
- Search by id_number / user email; filter by country.

---

### 4. Document storage & access
- Reuse existing `kyc-documents` storage bucket (private). Add admin RLS read policy via signed URLs generated server-side (admins only).
- Files are kept indefinitely so admins can always re-review.

---

### 5. Secrets
Bot uses Lovable AI Gateway only — `LOVABLE_API_KEY` already present. **No new secrets required.**

---

### 6. Files touched

Created
- `supabase/functions/kyc-auto-verify/index.ts`
- `src/components/admin/KYCReviewDrawer.tsx`
- `src/hooks/useKYCReview.ts`

Modified
- `src/pages/KYCUpload.tsx` — submit → invoke bot, show status.
- `src/pages/admin/AdminKYC.tsx` — review queue UI.
- `supabase/config.toml` — register new function.
- New migration for tables, RPCs, RLS, indexes.

---

### Out of scope (this pass)
- Liveness video / 3D selfie capture (browser-only photo upload retained).
- Sanctions/PEP screening (can be a follow-up bot check).
- Per-country ID-number regex library beyond a basic length+digit check (can extend later).

Confirm and I'll start with the migration.