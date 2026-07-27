import axios from 'axios'

/**
 * - Local: Vite proxy /api → localhost:3001 (or VITE_API_URL)
 * - Producción (Vercel): same-origin /api (sin Render)
 */
const getApiURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  if (import.meta.env.PROD) {
    return '/api'
  }

  const hostname = window.location.hostname
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.includes('vercel.app')) {
    return `http://${hostname}:3001/api`
  }

  // Dev: relative /api so Vite proxy handles it (faster, no CORS)
  return '/api'
}

const api = axios.create({
  baseURL: getApiURL(),
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 25000
})

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
