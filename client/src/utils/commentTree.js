/**
 * Shared helpers to nest / count Facebook-style post comments.
 */

export function flattenComments(comments = []) {
  const out = []
  const walk = (list) => {
    for (const c of list || []) {
      out.push(c)
      if (c.replies?.length) walk(c.replies)
    }
  }
  walk(comments)
  return out
}

export function countComments(comments = []) {
  return flattenComments(comments).length
}

/** Ensure API payload (nested or flat with parentId) becomes nested roots. */
export function normalizeCommentTree(comments = []) {
  if (!Array.isArray(comments) || !comments.length) return []
  // Already nested
  if (comments.some((c) => Array.isArray(c.replies) && c.replies.length)) {
    return comments.map((c) => ({ ...c, replies: c.replies || [] }))
  }
  const hasParent = comments.some((c) => c.parentId)
  if (!hasParent) {
    return comments.map((c) => ({ ...c, replies: c.replies || [] }))
  }
  const byId = Object.create(null)
  const roots = []
  for (const c of comments) {
    byId[c._id || c.id] = { ...c, replies: [] }
  }
  for (const c of comments) {
    const id = c._id || c.id
    const node = byId[id]
    if (c.parentId && byId[c.parentId]) {
      byId[c.parentId].replies.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}
