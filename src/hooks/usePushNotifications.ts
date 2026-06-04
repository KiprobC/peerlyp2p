// Push notifications: subscription management for the dedicated push SW.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = "BPeerlyVapidPublicKeyPlaceholderReplaceViaEdgeFunctionConfig";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isUnsupportedHost() {
  const h = window.location.hostname;
  return (
    h.includes("id-preview--") ||
    h.includes("lovableproject.com") ||
    h.includes("lovableproject-dev.com")
  );
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !isUnsupportedHost();

  // Register dedicated push SW once
  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker
      .register("/push-sw.js", { scope: "/push-sw/" })
      .catch((e) => console.warn("push-sw register failed", e));

    const handler = (e: MessageEvent) => {
      if (e.data?.type === "navigate" && typeof e.data.url === "string") {
        window.location.assign(e.data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [supported]);

  // Check existing subscription
  useEffect(() => {
    if (!supported || !user) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/push-sw/");
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        /* noop */
      }
    })();
  }, [supported, user]);

  const subscribe = useCallback(async (vapidPublicKey?: string) => {
    if (!supported || !user) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const reg =
        (await navigator.serviceWorker.getRegistration("/push-sw/")) ??
        (await navigator.serviceWorker.register("/push-sw.js", { scope: "/push-sw/" }));

      const key = vapidPublicKey ?? VAPID_PUBLIC_KEY;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth_key: json.keys.auth,
          user_agent: navigator.userAgent,
          enabled: true,
        },
        { onConflict: "endpoint" },
      );
      setSubscribed(true);
      return true;
    } catch (e) {
      console.error("push subscribe error", e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported, user]);

  const unsubscribe = useCallback(async () => {
    if (!supported || !user) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase
          .from("push_subscriptions")
          .update({ enabled: false })
          .eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [supported, user]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
