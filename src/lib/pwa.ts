// Service worker registration with safe guards for Lovable preview/iframe.

const isInIframe = () => {
  try { return window.self !== window.top; } catch { return true; }
};

const isPreviewHost = () => {
  const h = window.location.hostname;
  return (
    h.includes("id-preview--") ||
    h.includes("lovableproject.com") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
};

export const registerPWA = async () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // In iframes / Lovable previews, never register; clean up any leftover SWs.
  if (isInIframe() || isPreviewHost()) {
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
    registerSW({ immediate: true });
  } catch (e) {
    console.warn("PWA register skipped:", e);
  }
};
