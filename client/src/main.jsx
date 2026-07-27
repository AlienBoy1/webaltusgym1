import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const BRAND_CACHE_KEY = 'qyntra-brand-v3'

async function ensureFreshBrandAssets() {
  const seen = localStorage.getItem(BRAND_CACHE_KEY)
  if (seen === '1') return false

  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((reg) => reg.unregister()))
    }
  } catch {
    // ignore
  }

  localStorage.setItem(BRAND_CACHE_KEY, '1')

  if (!sessionStorage.getItem('qyntra-reloaded')) {
    sessionStorage.setItem('qyntra-reloaded', '1')
    window.location.reload()
    return true
  }
  return false
}

async function boot() {
  const reloading = await ensureFreshBrandAssets()
  if (reloading) return

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

boot()
