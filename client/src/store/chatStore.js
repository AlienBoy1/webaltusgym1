import { create } from 'zustand'
import api from '../utils/api'

function mapConversations(data = []) {
  return (data || []).map((c) => ({
    ...c,
    otherId: c.otherId || c.oderId,
    unread: Number(c.unread) || 0,
    lastFromMe: Boolean(c.lastFromMe),
    time: c.time
      ? new Date(c.time).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
      : c.time || ''
  }))
}

export const useChatStore = create((set, get) => ({
  conversations: [],
  loading: false,
  loaded: false,
  error: null,

  prefetch: async () => {
    if (get().loading) return
    const soft = get().loaded
    set({ loading: soft ? false : true, error: null })
    try {
      const { data } = await api.get('/chat/conversations')
      const mapped = mapConversations(data)
      set((state) => {
        const localOnly = (state.conversations || []).filter(
          (p) => !mapped.some((m) => m.otherId === p.otherId) && !p.lastMessage
        )
        return {
          conversations: [...localOnly, ...mapped],
          loading: false,
          loaded: true
        }
      })
    } catch (error) {
      console.error('Error prefetching conversations:', error)
      set({ loading: false, loaded: true, error: error.message || 'Error' })
    }
  },

  setConversations: (updater) => {
    set((state) => ({
      conversations:
        typeof updater === 'function' ? updater(state.conversations) : updater
    }))
  },

  reset: () => set({ conversations: [], loading: false, loaded: false, error: null })
}))
