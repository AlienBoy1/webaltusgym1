import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './utils/theme'
import './index.css'

async function boot() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

boot()
