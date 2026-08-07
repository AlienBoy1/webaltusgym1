import { create } from 'zustand'
import api from '../utils/api'
import { supabase } from '../lib/supabase'

let notifChannel = null

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchUnreadCount: async () => {
    try {
      const { data } = await api.get('/notifications/unread-count', { timeout: 8000 })
      set({ unreadCount: data.unreadCount || 0 })
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  },

  fetchNotifications: async (opts = {}) => {
    try {
      if (!opts.silent) set({ loading: true })
      const { data } = await api.get('/notifications', { timeout: 12000 })
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

  subscribeRealtime: (userId) => {
    get().unsubscribeRealtime()
    if (!userId) return

    notifChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Bump badge without reloading the full list
          set({ unreadCount: (get().unreadCount || 0) + 1 })
          const row = payload?.new
          if (row && get().notifications?.length) {
            // Only merge if list already loaded (notifications page)
            get().fetchNotifications({ silent: true })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        () => {
          get().fetchUnreadCount()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        () => {
          get().fetchUnreadCount()
        }
      )
      .subscribe()

    const onFocus = () => get().fetchUnreadCount()
    window.addEventListener('focus', onFocus)
    notifChannel._onFocus = onFocus
  },

  unsubscribeRealtime: () => {
    if (notifChannel) {
      if (notifChannel._onFocus) {
        window.removeEventListener('focus', notifChannel._onFocus)
      }
      supabase.removeChannel(notifChannel)
      notifChannel = null
    }
  },

  markAsRead: async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      const { notifications } = get()
      const wasUnread = notifications.find((n) => n._id === id && !n.read)
      set({
        notifications: notifications.map((n) => (n._id === id ? { ...n, read: true } : n)),
        unreadCount: wasUnread ? Math.max(0, get().unreadCount - 1) : get().unreadCount
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
        notifications: notifications.map((n) => ({ ...n, read: true })),
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
      const notif = notifications.find((n) => n._id === id)
      set({
        notifications: notifications.filter((n) => n._id !== id),
        unreadCount: notif && !notif.read ? get().unreadCount - 1 : get().unreadCount
      })
    } catch (error) {
      console.error('Error deleting notification:', error)
      throw error
    }
  },

  clearRead: async () => {
    try {
      await api.delete('/notifications/clear/read')
      const { notifications } = get()
      set({
        notifications: notifications.filter((n) => !n.read)
      })
    } catch (error) {
      console.error('Error clearing read notifications:', error)
    }
  }
}))
