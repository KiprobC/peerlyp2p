/**
 * Central WebAuthn Relying Party configuration.
 *
 * Configuration precedence:
 *   1. WEBAUTHN_RP_ID   — explicit relying party ID (a bare hostname, e.g. "peerly.app")
 *   2. WEBAUTHN_ORIGIN  — comma separated list of allowed origins (e.g. "https://peerly.app,https://www.peerly.app")
 *   3. Request `Origin` header (used when no env config is present)
 *   4. LEGACY_RP_ID fallback ("peerlyp2p.lovable.app") so existing credentials keep working.
 *
 * Existing passkeys are bound to the rpID they were created with, so the legacy
 * rpID is ALWAYS kept in the list of accepted rpIDs during verification.
 */

export const LEGACY_RP_ID = "peerlyp2p.lovable.app";
export const LEGACY_ORIGIN = `https://${LEGACY_RP_ID}`;

const env = (k: string) => (Deno.env.get(k) || "").trim();

const splitList = (v: string) =>
  v.split(",").map((s) => s.trim()).filter(Boolean);

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

/** Origins explicitly allowed via env. */
export function allowedOrigins(): string[] {
  return splitList(env("WEBAUTHN_ORIGIN"));
}

/**
 * rpID to use when CREATING a new credential.
 * Prefers env config, then the caller's origin, then the legacy host.
 */
export function registrationRpID(requestOrigin: string | null): string {
  const configured = env("WEBAUTHN_RP_ID");
  if (configured) return configured;

  const originsFromEnv = allowedOrigins();
  if (originsFromEnv.length) {
    const h = hostOf(originsFromEnv[0]);
    if (h) return h;
  }

  if (requestOrigin) {
    const h = hostOf(requestOrigin);
    // localhost / preview hosts are valid rpIDs for their own origin
    if (h) return h;
  }

  return LEGACY_RP_ID;
}

/** Origin to echo back / expect for the current request. */
export function effectiveOrigin(requestOrigin: string | null): string {
  if (requestOrigin) return requestOrigin;
  const fromEnv = allowedOrigins();
  if (fromEnv.length) return fromEnv[0];
  return LEGACY_ORIGIN;
}

/**
 * Every rpID we are willing to verify an assertion/attestation against.
 * Always includes the legacy rpID for backwards compatibility.
 */
export function expectedRPIDs(requestOrigin: string | null): string[] {
  const list = new Set<string>();
  const configured = env("WEBAUTHN_RP_ID");
  if (configured) list.add(configured);
  for (const o of allowedOrigins()) {
    const h = hostOf(o);
    if (h) list.add(h);
  }
  if (requestOrigin) {
    const h = hostOf(requestOrigin);
    if (h) list.add(h);
  }
  list.add(LEGACY_RP_ID);
  return [...list];
}

/** Every origin we are willing to verify against. */
export function expectedOrigins(requestOrigin: string | null): string[] {
  const list = new Set<string>();
  for (const o of allowedOrigins()) list.add(o);
  if (requestOrigin) list.add(requestOrigin);
  list.add(LEGACY_ORIGIN);
  return [...list];
}

export const RP_NAME = env("WEBAUTHN_RP_NAME") || "Peerly";
