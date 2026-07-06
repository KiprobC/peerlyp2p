import { useCallback, useEffect, useState } from "react";

/**
 * Fintech-style Quick Unlock settings + idle tracking.
 * All state is client-side; the actual biometric proof is provided by the
 * existing WebAuthn passkey step-up flow (usePasskeys.stepUpVerify).
 */

const KEYS = {
  enabled: "quick_unlock_enabled",
  requireOnOpen: "quick_unlock_require_on_open",
  idleMinutes: "quick_unlock_idle_minutes",
  unlockedAt: "quick_unlock_unlocked_at", // sessionStorage
  lastActivity: "quick_unlock_last_activity", // sessionStorage
} as const;

export interface QuickUnlockSettings {
  enabled: boolean;
  requireOnOpen: boolean;
  idleMinutes: number; // 0 = disabled
}

const DEFAULTS: QuickUnlockSettings = {
  enabled: false,
  requireOnOpen: true,
  idleMinutes: 5,
};

const readSettings = (): QuickUnlockSettings => {
  try {
    return {
      enabled: localStorage.getItem(KEYS.enabled) === "true",
      requireOnOpen: localStorage.getItem(KEYS.requireOnOpen) !== "false",
      idleMinutes: Number(localStorage.getItem(KEYS.idleMinutes) ?? DEFAULTS.idleMinutes),
    };
  } catch {
    return DEFAULTS;
  }
};

const writeSettings = (s: QuickUnlockSettings) => {
  try {
    localStorage.setItem(KEYS.enabled, String(s.enabled));
    localStorage.setItem(KEYS.requireOnOpen, String(s.requireOnOpen));
    localStorage.setItem(KEYS.idleMinutes, String(s.idleMinutes));
  } catch {
    /* noop */
  }
};

export const isPWAInstalled = (): boolean => {
  if (typeof window === "undefined") return false;
  // iOS Safari
  // @ts-expect-error - non-standard
  if (window.navigator.standalone) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
};

export const markUnlocked = () => {
  try {
    const now = String(Date.now());
    sessionStorage.setItem(KEYS.unlockedAt, now);
    sessionStorage.setItem(KEYS.lastActivity, now);
  } catch {
    /* noop */
  }
};

export const clearUnlock = () => {
  try {
    sessionStorage.removeItem(KEYS.unlockedAt);
    sessionStorage.removeItem(KEYS.lastActivity);
  } catch {
    /* noop */
  }
};

/**
 * Startup recovery: if Quick Unlock is enabled but the account has no passkey,
 * silently disable it so the user isn't locked out. Returns true if it had to
 * reset settings (caller may show a toast).
 */
export const reconcileQuickUnlockWithPasskeys = (passkeyCount: number): boolean => {
  const s = readSettings();
  if (s.enabled && passkeyCount === 0) {
    writeSettings({ ...s, enabled: false, requireOnOpen: false });
    clearUnlock();
    return true;
  }
  return false;
};

export const useQuickUnlock = () => {
  const [settings, setSettings] = useState<QuickUnlockSettings>(readSettings);
  const [needsUnlock, setNeedsUnlock] = useState<boolean>(false);

  const evaluate = useCallback(() => {
    const s = readSettings();
    setSettings(s);
    if (!s.enabled) {
      setNeedsUnlock(false);
      return;
    }
    let unlockedAt = 0;
    let lastActivity = 0;
    try {
      unlockedAt = Number(sessionStorage.getItem(KEYS.unlockedAt) ?? 0);
      lastActivity = Number(sessionStorage.getItem(KEYS.lastActivity) ?? 0);
    } catch {
      /* noop */
    }

    // Require on open: no unlock recorded for this session/tab.
    if (s.requireOnOpen && !unlockedAt) {
      setNeedsUnlock(true);
      return;
    }
    // Idle timeout since last activity.
    if (s.idleMinutes > 0 && lastActivity) {
      const idleMs = Date.now() - lastActivity;
      if (idleMs > s.idleMinutes * 60 * 1000) {
        setNeedsUnlock(true);
        return;
      }
    }
    setNeedsUnlock(false);
  }, []);

  const updateSettings = useCallback((patch: Partial<QuickUnlockSettings>) => {
    const merged = { ...readSettings(), ...patch };
    writeSettings(merged);
    setSettings(merged);
    if (!merged.enabled) {
      clearUnlock();
      setNeedsUnlock(false);
    } else {
      // Enabling: consider the current session already trusted.
      markUnlocked();
    }
  }, []);

  // Activity tracking + evaluate periodically & on visibility change.
  useEffect(() => {
    const bump = () => {
      try {
        sessionStorage.setItem(KEYS.lastActivity, String(Date.now()));
      } catch {
        /* noop */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") evaluate();
    };

    evaluate();
    const interval = window.setInterval(evaluate, 15 * 1000);
    ["click", "keydown", "touchstart", "mousemove"].forEach((e) =>
      window.addEventListener(e, bump, { passive: true })
    );
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      ["click", "keydown", "touchstart", "mousemove"].forEach((e) =>
        window.removeEventListener(e, bump)
      );
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [evaluate]);

  return {
    settings,
    updateSettings,
    needsUnlock,
    evaluate,
    markUnlocked,
    clearUnlock,
    isPWAInstalled: isPWAInstalled(),
  };
};
