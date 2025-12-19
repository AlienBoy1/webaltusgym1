import { create } from 'zustand'
import api from '../utils/api'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,
  
  login: async (email, password) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      set({ 
        user: data.user, 
        token: data.token, 
        isAuthenticated: true,
        loading: false 
      })
      return { success: true }
    } catch (error) {
      set({ loading: false })
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al iniciar sesión' 
      }
    }
  },
  
  register: async (name, email, password) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/register', { name, email, password })
      localStorage.setItem('token', data.token)
      set({ 
        user: data.user, 
        token: data.token, 
        isAuthenticated: true,
        loading: false 
      })
      return { success: true, isFirstUser: data.isFirstUser }
    } catch (error) {
      set({ loading: false })
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al registrarse' 
      }
    }
  },
  
  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null, isAuthenticated: false })
    window.location.href = '/login'
  },
  
  refreshUser: async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data.user, isAuthenticated: true })
    } catch (error) {
      if (error.response?.status === 401) {
        get().logout()
      }
    }
  },
  
  updateUser: (userData) => {
    set({ user: { ...get().user, ...userData } })
  },
  
  checkAuth: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ isAuthenticated: false, user: null })
      return false
    }
    
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data.user, isAuthenticated: true })
      return true
    } catch (error) {
      localStorage.removeItem('token')
      set({ user: null, token: null, isAuthenticated: false })
      return false
    }
  }
}))
