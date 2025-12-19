import axios from 'axios'

// Detect if we're on mobile/local network or production
const getApiURL = () => {
  // If VITE_API_URL is set, use it (for production)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // Production mode - use environment variable or default
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || 'https://altus-gym-server.onrender.com/api'
  }
  
  // Get current hostname
  const hostname = window.location.hostname
  
  // If accessing from IP (not localhost), use that IP for API
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.includes('vercel.app')) {
    return `http://${hostname}:3001/api`
  }
  
  // Default to localhost for development
  return 'http://localhost:3001/api'
}

const api = axios.create({
  baseURL: getApiURL(),
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
