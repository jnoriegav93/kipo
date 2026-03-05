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
      manifest: {
        name: 'Kipo',
        short_name: 'Kipo',
        description: 'Gestión de Proyectos de Fibra Óptica',
        theme_color: '#ffffff',
        background_color: '#ffffff',
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