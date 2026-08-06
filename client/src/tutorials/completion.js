/**
 * Per-user tutorial completion helpers.
 * Never share "visto" across accounts on the same browser.
 */

export function userIdOf(user) {
  return user?.id || user?._id || null
}

export function localCompletionKey(completionKey, userId) {
  if (!completionKey || !userId) return null
  return `${completionKey}:${userId}`
}

export function readLocalCompletion(completionKey, userId) {
  const key = localCompletionKey(completionKey, userId)
  if (!key) return false
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function writeLocalCompletion(completionKey, userId) {
  const key = localCompletionKey(completionKey, userId)
  if (!key) return
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

/** Remove legacy global keys written before per-user scoping. */
export function clearLegacyGlobalCompletion(completionKey) {
  if (!completionKey) return
  try {
    localStorage.removeItem(completionKey)
  } catch {
    /* ignore */
  }
}
