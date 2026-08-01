const TRUSTED_DEVICE_KEY = "trusted_device_until";
const TRUST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Single source of truth for the 7-day trusted-device window. */
export const isTrustedDevice = (): boolean => {
  try {
    const until = Number(localStorage.getItem(TRUSTED_DEVICE_KEY) || 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
};

export const trustThisDevice = (): void => {
  try {
    localStorage.setItem(TRUSTED_DEVICE_KEY, String(Date.now() + TRUST_WINDOW_MS));
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
