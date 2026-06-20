import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Connectivity hook that does NOT trust `navigator.onLine` alone.
 *
 * Why: `navigator.onLine === false` is often a lie — captive portals, VPN
 * transitions, and some Android browsers report offline while requests succeed.
 * Conversely, `navigator.onLine === true` can be wrong on flaky cellular.
 *
 * We treat the app as offline ONLY when a lightweight HEAD request to a
 * same-origin asset fails. Diagnostics are exposed for the admin panel.
 */

export type ConnectivityState = {
  online: boolean;
  navigatorOnline: boolean;
  lastCheckAt: number | null;
  lastOfflineAt: number | null;
  lastOnlineAt: number | null;
  checking: boolean;
};

const PING_URL = "/favicon.ico";
const PING_TIMEOUT_MS = 6000;

let cached: ConnectivityState = {
  online: true,
  navigatorOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  lastCheckAt: null,
  lastOfflineAt: null,
  lastOnlineAt: null,
  checking: false,
};
const listeners = new Set<(s: ConnectivityState) => void>();
const emit = (next: ConnectivityState) => {
  cached = next;
  listeners.forEach((l) => l(next));
};

export const probeConnectivity = async (): Promise<boolean> => {
  emit({ ...cached, checking: true });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
  try {
    const res = await fetch(`${PING_URL}?_=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    const ok = res.ok || res.type === "opaque";
    const now = Date.now();
    if (ok) {
      if (!cached.online) console.info("[connectivity] restored");
      emit({
        ...cached,
        online: true,
        navigatorOnline: navigator.onLine,
        lastCheckAt: now,
        lastOnlineAt: now,
        checking: false,
      });
    } else {
      if (cached.online) console.warn("[connectivity] offline (probe non-ok)", res.status);
      emit({
        ...cached,
        online: false,
        navigatorOnline: navigator.onLine,
        lastCheckAt: now,
        lastOfflineAt: now,
        checking: false,
      });
    }
    return ok;
  } catch (err) {
    const now = Date.now();
    if (cached.online) console.warn("[connectivity] offline (probe failed)", err);
    emit({
      ...cached,
      online: false,
      navigatorOnline: navigator.onLine,
      lastCheckAt: now,
      lastOfflineAt: now,
      checking: false,
    });
    return false;
  } finally {
    clearTimeout(t);
  }
};

export const useConnectivity = () => {
  const [state, setState] = useState<ConnectivityState>(cached);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  useEffect(() => {
    // Initial probe + listeners. Re-probe on browser events instead of trusting them.
    void probeConnectivity();
    const onChange = () => void probeConnectivity();
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    window.addEventListener("focus", onChange);
    intervalRef.current = window.setInterval(() => void probeConnectivity(), 60_000);
    return () => {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
      window.removeEventListener("focus", onChange);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  const refresh = useCallback(() => probeConnectivity(), []);
  return { ...state, refresh };
};
