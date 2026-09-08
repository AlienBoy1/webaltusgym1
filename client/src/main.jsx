import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppDialogProvider } from './components/AppDialog'
import { captureInstallPrompt } from './utils/pwaInstall'
import { initNativeShellSafe } from './utils/nativeShell'
import './utils/theme'
import './index.css'

captureInstallPrompt()

async function boot() {
  // Never block forever — blank screen was caused by hung native init / SW
  try {
    await initNativeShellSafe()
  } catch (err) {
    console.warn('native boot:', err)
  }

  const root = document.getElementById('root')
  if (!root) return

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppDialogProvider>
        <App />
      </AppDialogProvider>
    </React.StrictMode>
  )
}

boot()
