import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // Disable in dev to avoid iframe/preview cache pollution
      devOptions: { enabled: false },
      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/maskable-icon.png",
        "offline.html",
      ],
      manifest: {
        name: "Peerly",
        short_name: "Peerly",
        description: "Secure P2P Crypto Trading",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0B0F19",
        theme_color: "#0B0F19",
        orientation: "portrait",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/maskable-icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // SPA fallback: serve the app shell, NOT offline.html, so React Router
        // can render any route from cache. offline.html is now reserved as a
        // last-resort document only (manually navigated to by the connectivity hook).
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/api/,
          /^\/auth/,
          /^\/offline\.html$/,
          /^\/push-sw\.js$/,
          /^\/sw\.js$/,
        ],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff2}"],
        // Force a new SW to take over immediately on update so a fresh deploy
        // never leaves users on a stale shell pointing at /offline.html.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // HTML navigations: network-first with a generous timeout. Flaky
            // mobile networks frequently exceed 3s — falling back too eagerly
            // is what produced the spurious "offline" screen.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Static assets
            urlPattern: ({ request }) =>
              ["style", "script", "worker", "font", "image"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "asset-cache" },
          },
          {
            // Never cache Supabase API/auth/storage (sensitive)
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
