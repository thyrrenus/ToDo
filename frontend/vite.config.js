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
      includeAssets: ['favicon.svg', 'icons.svg', 'favicon-192.png', 'favicon-512.png'],
      manifest: {
        name: 'ToDo',
        short_name: 'ToDo',
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
          },
          {
            src: 'favicon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'favicon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        shortcuts: [
          {
            name: 'Widget: Añadir Tarea',
            short_name: 'Widget: Add',
            description: 'Crear una tarea rápidamente en una ventana compacta',
            url: '/?widget=true&view=tasks',
            icons: [{ src: 'favicon-192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Widget: Calendario',
            short_name: 'Widget: Calendar',
            description: 'Ver agenda en ventana compacta',
            url: '/?widget=true&view=calendar',
            icons: [{ src: 'favicon-192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Widget: Eisenhower',
            short_name: 'Widget: Eisenhower',
            description: 'Clasificar prioridades en ventana compacta',
            url: '/?widget=true&view=eisenhower',
            icons: [{ src: 'favicon-192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Widget: Pomodoro',
            short_name: 'Widget: Pomo',
            description: 'Temporizador Pomodoro compacto',
            url: '/?widget=true&view=pomodoro',
            icons: [{ src: 'favicon-192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Widget: Kanban',
            short_name: 'Widget: Kanban',
            description: 'Flujo Kanban compacto',
            url: '/?widget=true&view=kanban',
            icons: [{ src: 'favicon-192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Hoy (Completo)',
            short_name: 'Hoy',
            description: 'Ver mis tareas para hoy',
            url: '/?view=tasks&list=today',
            icons: [{ src: 'favicon-192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Inbox (Completo)',
            short_name: 'Inbox',
            description: 'Ver bandeja de entrada',
            url: '/?view=tasks&list=inbox',
            icons: [{ src: 'favicon-192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Calendario (Completo)',
            short_name: 'Calendario',
            description: 'Ver calendario principal',
            url: '/?view=calendar',
            icons: [{ src: 'favicon-192.png', sizes: '192x192', type: 'image/png' }]
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
