import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * When DISABLE_HMR=true, Vite's client script (client.mjs) still contains default code
 * attempting an HMR WebSocket connection to the dev server, which triggers connection
 * errors and unhandled rejections because WebSocket/HMR is disabled in this environment.
 * This dev-only plugin neutralizes the client-side HMR WebSocket connection when
 * DISABLE_HMR=true while keeping all other Vite client features (CSS injection, error overlay)
 * fully functional, without modifying browser globals or monkey-patching window.WebSocket.
 */
function disableHmrClientPlugin(): Plugin {
  return {
    name: 'vite-disable-hmr-client',
    apply: 'serve',
    transform(code, id) {
      if (process.env.DISABLE_HMR === 'true' && id.endsWith('/vite/dist/client/client.mjs')) {
        return code
          .replace(
            `console.debug("[vite] connecting...");`,
            `/* [vite] HMR disabled by DISABLE_HMR=true */`
          )
          .replace(
            /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/,
            `const transport = normalizeModuleRunnerTransport({
  async connect() {},
  async disconnect() {},
  send() {}
});`
          );
      }
    },
  };
}

export default defineConfig(() => {
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [
      react(),
      tailwindcss(),
      disableHmrClientPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'Tradebook',
          short_name: 'Tradebook',
          description: 'Private Trading Journal & Performance Tracker. Local-first, privacy-focused trading journal with encrypted portable backup.',
          theme_color: '#18181b',
          background_color: '#18181b',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      hmr: !isHmrDisabled,
      ws: isHmrDisabled ? (false as const) : undefined,
      watch: isHmrDisabled ? null : {},
    },
  };
});
