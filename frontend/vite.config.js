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
          }
        ],
        shortcuts: [
          {
            name: 'Añadir Tarea',
            short_name: 'Add Task',
            description: 'Crear una nueva tarea rápidamente',
            url: '/?view=tasks&action=new',
            icons: [{ src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
          },
          {
            name: 'Hoy',
            short_name: 'Today',
            description: 'Ver mis tareas para hoy',
            url: '/?view=tasks&list=today',
            icons: [{ src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
          },
          {
            name: 'Inbox',
            short_name: 'Inbox',
            description: 'Ver bandeja de entrada',
            url: '/?view=tasks&list=inbox',
            icons: [{ src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
          },
          {
            name: 'Calendario',
            short_name: 'Calendar',
            description: 'Ver calendario y agenda',
            url: '/?view=calendar',
            icons: [{ src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
          },
          {
            name: 'Enfoque Pomodoro',
            short_name: 'Start Pomo',
            description: 'Iniciar temporizador de enfoque',
            url: '/?view=pomodoro',
            icons: [{ src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
          },
          {
            name: 'Matriz de Eisenhower',
            short_name: 'Eisenhower',
            description: 'Clasificar prioridades',
            url: '/?view=eisenhower',
            icons: [{ src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
          },
          {
            name: 'Tablero Kanban',
            short_name: 'Kanban',
            description: 'Ver flujo de trabajo',
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
