// Service worker registration with safe guards for Lovable preview/iframe,
// plus automatic update handling so deployments never strand users on a
// stale app shell (which used to surface as a phantom "You're offline" page).

const isInIframe = () => {
  try { return window.self !== window.top; } catch { return true; }
};

const isPreviewHost = () => {
  const h = window.location.hostname;
  return (
    h.includes("id-preview--") ||
    h.includes("preview--") ||
    h.endsWith("lovableproject.com") ||
    h.endsWith("lovableproject-dev.com") ||
    h.endsWith("beta.lovable.dev") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
};

export const registerPWA = async () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // In iframes / Lovable previews, never register; clean up any leftover SWs.
  if (isInIframe() || isPreviewHost() || new URL(window.location.href).searchParams.get("sw") === "off") {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* noop */
    }
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // A new SW is waiting. Activate immediately so users always see the
        // latest shell. Prevents stale /offline.html from a previous deploy.
        console.info("[pwa] new service worker available — updating");
        updateSW(true);
      },
      onOfflineReady() {
        console.info("[pwa] app shell cached — ready for offline navigation");
      },
      onRegisteredSW(swUrl) {
        console.info("[pwa] sw registered:", swUrl);
      },
      onRegisterError(err) {
        console.warn("[pwa] sw registration error:", err);
      },
    });

    // Re-check for SW updates every 30 minutes while the tab is open.
    setInterval(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      } catch {
        /* noop */
      }
    }, 30 * 60 * 1000);
  } catch (e) {
    console.warn("PWA register skipped:", e);
  }
};
