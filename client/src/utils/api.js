import axios from 'axios'
import {
  getStoredToken,
  getStoredRefreshToken,
  setAuthTokens,
  clearAuthTokens,
  isRememberMeEnabled
} from './tokenStorage'

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

  return '/api'
}

const api = axios.create({
  baseURL: getApiURL(),
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 25000
})

let isRefreshing = false
let refreshQueue = []

const processQueue = (error, token = null) => {
  refreshQueue.forEach((promise) => {
    if (error) {
      promise.reject(error)
    } else {
      promise.resolve(token)
    }
  })
  refreshQueue = []
}

api.interceptors.request.use(
  (config) => {
    const token = getStoredToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const refreshToken = getStoredRefreshToken()
    const isRefreshEndpoint = originalRequest?.url?.endsWith('/auth/refresh')

    if (
      error.response?.status === 401 &&
      refreshToken &&
      !originalRequest?._retry &&
      !isRefreshEndpoint
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post(
          `${getApiURL()}/auth/refresh`,
          { refreshToken },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 25000
          }
        )

        const token = response.data.token
        const nextRefreshToken = response.data.refreshToken
        const remember = isRememberMeEnabled()
        setAuthTokens(token, nextRefreshToken, remember)
        processQueue(null, token)
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAuthTokens()
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          const redirect = encodeURIComponent(window.location.pathname + window.location.search)
          window.location.href = `/login?redirect=${redirect}`
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    if (error.response?.status === 401) {
      clearAuthTokens()
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.href = `/login?redirect=${redirect}`
      }
    }

    return Promise.reject(error)
  }
)

export default api
