import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function versionJsonPlugin() {
  const writeVersion = (outDir) => {
    const payload = {
      version: `${Date.now()}`,
      builtAt: new Date().toISOString()
    }
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(outDir, 'version.json'), JSON.stringify(payload, null, 2))
    // Keep public in sync for local preview
    writeFileSync(resolve(__dirname, 'public/version.json'), JSON.stringify(payload, null, 2))
  }

  return {
    name: 'qyntra-version-json',
    buildStart() {
      writeVersion(resolve(__dirname, 'public'))
    },
    closeBundle() {
      writeVersion(resolve(__dirname, 'dist'))
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    versionJsonPlugin(),
    VitePWA({
      // Custom SW lives in public/sw.js (UpdateCenter registers it)
      injectRegister: false,
      strategies: 'generateSW',
      filename: 'sw-workbox.js',
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'QYNTRA GYM',
        short_name: 'QYNTRA',
        description: 'Sistema de Administración de Gimnasios',
        theme_color: '#FF6B35',
        background_color: '#0A0A0F',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0', // Escuchar en todas las interfaces
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})

