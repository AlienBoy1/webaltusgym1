import { supabaseAdmin } from '../lib/supabase.js'

async function findBlock(blockerId, blockedId) {
  const { data, error } = await supabaseAdmin
    .from('user_blocks')
    .select('blocker_id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle()

  if (error) {
    if (/user_blocks|schema cache|does not exist/i.test(error.message || '')) {
      console.warn('user_blocks missing:', error.message)
      return null
    }
    throw error
  }
  return data || null
}

/** Returns true if either user has blocked the other. */
export async function areUsersBlocked(userA, userB) {
  const a = String(userA || '')
  const b = String(userB || '')
  if (!a || !b || a === b) return false

  const [ab, ba] = await Promise.all([findBlock(a, b), findBlock(b, a)])
  return Boolean(ab || ba)
}

export async function getBlockRelation(viewerId, otherId) {
  const viewer = String(viewerId || '')
  const other = String(otherId || '')
  if (!viewer || !other || viewer === other) {
    return { isBlockedByMe: false, isBlockedByThem: false }
  }

  const [mine, theirs] = await Promise.all([findBlock(viewer, other), findBlock(other, viewer)])
  return {
    isBlockedByMe: Boolean(mine),
    isBlockedByThem: Boolean(theirs)
  }
}

/** Strip follows / requests between two users (both directions). */
export async function clearSocialGraphBetween(userA, userB) {
  const a = String(userA)
  const b = String(userB)
  await Promise.all([
    supabaseAdmin.from('follows').delete().eq('follower_id', a).eq('following_id', b),
    supabaseAdmin.from('follows').delete().eq('follower_id', b).eq('following_id', a),
    supabaseAdmin.from('follow_requests').delete().eq('from_user_id', a).eq('to_user_id', b),
    supabaseAdmin.from('follow_requests').delete().eq('from_user_id', b).eq('to_user_id', a)
  ])
}

export async function blockUser(blockerId, blockedId) {
  const { error } = await supabaseAdmin.from('user_blocks').upsert(
    { blocker_id: blockerId, blocked_id: blockedId },
    { onConflict: 'blocker_id,blocked_id' }
  )
  if (error) throw error
  await clearSocialGraphBetween(blockerId, blockedId)
}

export async function unblockUser(blockerId, blockedId) {
  const { error } = await supabaseAdmin
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
  if (error) throw error
}
