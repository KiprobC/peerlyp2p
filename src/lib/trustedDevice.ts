const TRUSTED_DEVICE_KEY = "trusted_device_until";
const TRUST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Single source of truth for the 7-day trusted-device window. */
export const isTrustedDevice = (userId: string): boolean => {
  try {
    const stored = localStorage.getItem(TRUSTED_DEVICE_KEY);
    if (!stored) return false;
    const trusted = JSON.parse(stored) as { userId?: string; until?: number };
    return trusted.userId === userId && Number.isFinite(trusted.until) && trusted.until > Date.now();
  } catch {
    return false;
  }
};

export const trustThisDevice = (userId: string): void => {
  try {
    localStorage.setItem(
      TRUSTED_DEVICE_KEY,
      JSON.stringify({ userId, until: Date.now() + TRUST_WINDOW_MS })
    );
  } catch {
    /* storage unavailable */
  }
};

export const clearTrustedDevice = (): void => {
  try {
    localStorage.removeItem(TRUSTED_DEVICE_KEY);
  } catch {
    /* storage unavailable */
  }
};
