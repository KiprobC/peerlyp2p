// Peerly push notifications service worker
// Handles push events and notification click deep linking.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Peerly", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Peerly";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: payload.type || "peerly",
    data: {
      url: payload.url || "/",
      type: payload.type,
      ...(payload.data || {}),
    },
    vibrate: [120, 60, 120],
    requireInteraction: payload.type === "dispute" || payload.type === "trade",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            client.postMessage({ type: "navigate", url: targetUrl });
            return;
          }
        } catch {
          // ignore
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
