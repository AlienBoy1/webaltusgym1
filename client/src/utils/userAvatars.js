import api from './api'

/**
 * One request for many profile photos/names (no social graph).
 * Returns a map keyed by user id.
 */
export async function fetchAvatarsByIds(ids) {
  const unique = [...new Set((ids || []).filter(Boolean).map(String))].slice(0, 40)
  if (!unique.length) return {}
  try {
    const { data } = await api.get('/users/avatars', {
      params: { ids: unique.join(',') },
      timeout: 20000
    })
    const map = {}
    for (const u of data?.users || []) {
      const id = String(u.id || u._id)
      if (id) map[id] = u
    }
    return map
  } catch {
    return {}
  }
}
