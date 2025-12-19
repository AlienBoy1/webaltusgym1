import { create } from 'zustand'
import api from '../utils/api'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  
  fetchNotifications: async () => {
    try {
      set({ loading: true })
      const { data } = await api.get('/notifications')
      set({ 
        notifications: data.notifications || [], 
        unreadCount: data.unreadCount || 0,
        loading: false 
      })
    } catch (error) {
      console.error('Error fetching notifications:', error)
      set({ loading: false })
    }
  },
  
  markAsRead: async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      const { notifications } = get()
      set({
        notifications: notifications.map(n => n._id === id ? { ...n, read: true } : n),
        unreadCount: Math.max(0, get().unreadCount - 1)
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  },
  
  markAllAsRead: async () => {
    try {
      await api.put('/notifications/read-all')
      const { notifications } = get()
      set({
        notifications: notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0
      })
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  },
  
  deleteNotification: async (id) => {
    try {
      await api.delete(`/notifications/${id}`)
      const { notifications } = get()
      const notif = notifications.find(n => n._id === id)
      set({
        notifications: notifications.filter(n => n._id !== id),
        unreadCount: notif && !notif.read ? get().unreadCount - 1 : get().unreadCount
      })
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  },
  
  clearRead: async () => {
    try {
      await api.delete('/notifications/clear/read')
      const { notifications } = get()
      set({
        notifications: notifications.filter(n => !n.read)
      })
    } catch (error) {
      console.error('Error clearing read notifications:', error)
    }
  }
}))
