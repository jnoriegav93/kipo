import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // Importamos el plugin mágico

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nominatim/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'FibraApp/1.0 (kipo-app)');
          });
        }
      }
    }
  },
  plugins: [
    react(),
    // Configuración de la PWA (App Móvil)
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6 MB — el bundle principal ya pesa ~2.4 MB; con 3 MB dejaría de precachearse al crecer y la app moriría offline
        runtimeCaching: [
          // Tiles satelitales ESRI — caché 30 días
          {
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiles-esri',
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // Tiles Google Maps — caché 30 días
          {
            urlPattern: /^https:\/\/mt[0-9]\.google\.com\/vt\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiles-google',
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // Tiles vectoriales CARTO — caché 7 días
          {
            urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiles-carto',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      manifest: {
        name: 'Kipo',
        short_name: 'Kipo',
        description: 'Gestión de Proyectos de Fibra Óptica',
        theme_color: '#10101D',
        background_color: '#10101D',
        display: 'standalone', // Esto quita la barra del navegador
        orientation: 'portrait', // Bloquea la app en vertical (opcional)
        icons: [
          {
            src: 'pwa-192x192.png', // <--- Recuerda crear esta imagen en la carpeta public
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png', // <--- Y esta también
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})