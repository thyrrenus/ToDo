import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Cockpit de Productividad ToDo',
        short_name: 'ToDo Cockpit',
        description: 'Gestor de tareas inteligente con Pomodoro y asistente de IA offline',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait-primary',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ],
        shortcuts: [
          {
            name: 'Iniciar Enfoque Pomodoro',
            short_name: 'Pomodoro',
            description: 'Abre el temporizador Pomodoro flotante',
            url: '/?view=pomodoro',
            icons: [{ src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
          },
          {
            name: 'Ver Calendario de Actividades',
            short_name: 'Calendario',
            description: 'Visualiza la agenda y eventos externos',
            url: '/?view=calendar',
            icons: [{ src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
          },
          {
            name: 'Ver Matriz de Eisenhower',
            short_name: 'Eisenhower',
            description: 'Clasificación de prioridades urgente/importante',
            url: '/?view=eisenhower',
            icons: [{ src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
          },
          {
            name: 'Ver Tablero Kanban',
            short_name: 'Kanban',
            description: 'Visualización ágil de flujo de trabajo',
            url: '/?view=kanban',
            icons: [{ src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
