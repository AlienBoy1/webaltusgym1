import { create } from 'zustand'
import api from '../utils/api'

/**
 * Cache of active profile notes by userId.
 * Expired / missing notes are stored as null to avoid re-fetch storms.
 */
export const useNotesStore = create((set, get) => ({
  byUser: {},
  inflight: {},

  getNote: (userId) => {
    if (!userId) return undefined
    return get().byUser[userId]
  },

  prime: (userId, note) => {
    if (!userId) return
    set((s) => ({ byUser: { ...s.byUser, [userId]: note || null } }))
  },

  fetchOne: async (userId) => {
    if (!userId) return null
    const state = get()
    if (state.byUser[userId] !== undefined) return state.byUser[userId]
    if (state.inflight[userId]) return state.inflight[userId]

    const p = api
      .get(`/notes/user/${userId}`)
      .then(({ data }) => {
        const note = data?.note || null
        set((s) => {
          const inflight = { ...s.inflight }
          delete inflight[userId]
          return { byUser: { ...s.byUser, [userId]: note }, inflight }
        })
        return note
      })
      .catch(() => {
        set((s) => {
          const inflight = { ...s.inflight }
          delete inflight[userId]
          return { byUser: { ...s.byUser, [userId]: null }, inflight }
        })
        return null
      })

    set((s) => ({ inflight: { ...s.inflight, [userId]: p } }))
    return p
  },

  fetchMany: async (ids = []) => {
    const unique = [...new Set(ids.filter(Boolean))]
    await Promise.all(unique.map((id) => get().fetchOne(id)))
  }
}))
