import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fintech-grade connectivity hook.
 *
 * States:
 *  - "online"   : last probe succeeded under DEGRADED_LATENCY_MS
 *  - "degraded" : last probe was slow OR 1 consecutive failure OR navigator.onLine=false
 *                 (we DO NOT call this offline yet — captive portals/flaky cell often recover)
 *  - "offline"  : >= OFFLINE_FAILURE_THRESHOLD consecutive failed probes
 *
 * We never trust `navigator.onLine` alone. The truth source is a real HEAD probe
 * to a same-origin asset. navigator.onLine only downgrades us to "degraded" so
 * the UI hints the user, but we still allow read actions.
 */

export type ConnectivityStatus = "online" | "degraded" | "offline";

export type ConnectivityState = {
  status: ConnectivityStatus;
  /** True unless status === "offline" — kept for backwards compatibility. */
  online: boolean;
  navigatorOnline: boolean;
  lastCheckAt: number | null;
  lastSuccessAt: number | null;
  lastOfflineAt: number | null;
  lastOnlineAt: number | null;
  lastLatencyMs: number | null;
  failureCount: number;
  checking: boolean;
};

const PING_URL = "/favicon.ico";
const PING_TIMEOUT_MS = 6000;
const DEGRADED_LATENCY_MS = 2500;
const OFFLINE_FAILURE_THRESHOLD = 3;
const POLL_INTERVAL_MS = 45_000;

let cached: ConnectivityState = {
  status: "online",
  online: true,
  navigatorOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  lastCheckAt: null,
  lastSuccessAt: null,
  lastOfflineAt: null,
  lastOnlineAt: null,
  lastLatencyMs: null,
  failureCount: 0,
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
  const started = performance.now();
  try {
    const res = await fetch(`${PING_URL}?_=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    const latency = Math.round(performance.now() - started);
    const ok = res.ok || res.type === "opaque";
    const now = Date.now();
    if (ok) {
      const navOn = typeof navigator !== "undefined" ? navigator.onLine : true;
      const status: ConnectivityStatus =
        latency > DEGRADED_LATENCY_MS || !navOn ? "degraded" : "online";
      if (cached.status === "offline") console.info("[connectivity] restored", { latency });
      emit({
        status,
        online: true,
        navigatorOnline: navOn,
        lastCheckAt: now,
        lastSuccessAt: now,
        lastOfflineAt: cached.lastOfflineAt,
        lastOnlineAt: now,
        lastLatencyMs: latency,
        failureCount: 0,
        checking: false,
      });
      return true;
    }
    return handleFailure(now, latency);
  } catch {
    return handleFailure(Date.now(), null);
  } finally {
    clearTimeout(t);
  }
};

const handleFailure = (now: number, latency: number | null) => {
  const failureCount = cached.failureCount + 1;
  const status: ConnectivityStatus =
    failureCount >= OFFLINE_FAILURE_THRESHOLD ? "offline" : "degraded";
  if (cached.status !== status) {
    if (status === "offline") console.warn("[connectivity] offline after", failureCount, "failed probes");
    else console.warn("[connectivity] degraded — probe failed", failureCount);
  }
  emit({
    status,
    online: status !== "offline",
    navigatorOnline: typeof navigator !== "undefined" ? navigator.onLine : false,
    lastCheckAt: now,
    lastSuccessAt: cached.lastSuccessAt,
    lastOfflineAt: status === "offline" ? now : cached.lastOfflineAt,
    lastOnlineAt: cached.lastOnlineAt,
    lastLatencyMs: latency,
    failureCount,
    checking: false,
  });
  return false;
};

export const useConnectivity = () => {
  const [state, setState] = useState<ConnectivityState>(cached);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);

  useEffect(() => {
    void probeConnectivity();
    // Re-probe rather than blindly trusting browser events.
    const onChange = () => void probeConnectivity();
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    window.addEventListener("focus", onChange);
    intervalRef.current = window.setInterval(() => void probeConnectivity(), POLL_INTERVAL_MS);
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
