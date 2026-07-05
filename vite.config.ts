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
        "favicon-16.png",
        "favicon-32.png",
        "apple-touch-icon.png",
        "robots.txt",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/maskable-icon.png",
        "icons/badge-72.png",
        "icons/splash-*.png",
        "offline.html",
      ],
      manifest: {
        name: "Peerly",
        short_name: "Peerly",
        description: "Peerly — secure peer-to-peer crypto trading with escrow, instant transfers and real-time pricing.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        background_color: "#0B0F19",
        theme_color: "#0B0F19",
        orientation: "portrait",
        lang: "en",
        dir: "ltr",
        categories: ["finance", "business", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
        ],
        shortcuts: [
          { name: "Marketplace", short_name: "Market", url: "/market", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Wallet", short_name: "Wallet", url: "/wallet", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Dashboard", short_name: "Dashboard", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
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
