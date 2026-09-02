import { supabaseAdmin } from '../lib/supabase.js'
import { invalidateAuthProfileCache } from '../middleware/auth.js'

/** Elimina perfil, auth y datos asociados del usuario. */
export async function deleteUserAccount(userId) {
  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (!user) {
    const err = new Error('Usuario no encontrado')
    err.status = 404
    throw err
  }

  const { data: userPosts } = await supabaseAdmin.from('posts').select('id').eq('user_id', userId)
  const postIds = (userPosts || []).map((p) => p.id)
  if (postIds.length) {
    await supabaseAdmin.from('post_likes').delete().in('post_id', postIds)
    await supabaseAdmin.from('post_comments').delete().in('post_id', postIds)
    await supabaseAdmin.from('posts').delete().in('id', postIds)
  }

  await supabaseAdmin.from('post_comments').delete().eq('user_id', userId)
  await supabaseAdmin.from('post_likes').delete().eq('user_id', userId)

  const { data: userStories } = await supabaseAdmin.from('stories').select('id').eq('user_id', userId)
  const storyIds = (userStories || []).map((s) => s.id)
  if (storyIds.length) {
    await supabaseAdmin.from('story_reactions').delete().in('story_id', storyIds)
    await supabaseAdmin.from('story_views').delete().in('story_id', storyIds)
    await supabaseAdmin.from('stories').delete().in('id', storyIds)
  }
  await supabaseAdmin.from('story_reactions').delete().eq('user_id', userId)
  await supabaseAdmin.from('story_views').delete().eq('user_id', userId)
  await supabaseAdmin.from('story_favorites').delete().eq('user_id', userId)
  await supabaseAdmin.from('story_favorite_albums').delete().eq('user_id', userId)

  await supabaseAdmin.from('follows').delete().eq('follower_id', userId)
  await supabaseAdmin.from('follows').delete().eq('following_id', userId)
  await supabaseAdmin.from('messages').delete().eq('from_user_id', userId)
  await supabaseAdmin.from('messages').delete().eq('to_user_id', userId)
  await supabaseAdmin.from('notifications').delete().eq('user_id', userId)
  await supabaseAdmin.from('notifications').delete().eq('related_user_id', userId)
  await supabaseAdmin.from('follow_requests').delete().eq('from_user_id', userId)
  await supabaseAdmin.from('follow_requests').delete().eq('to_user_id', userId)

  await supabaseAdmin.from('class_enrollments').delete().eq('user_id', userId)
  await supabaseAdmin.from('class_waitlist').delete().eq('user_id', userId)
  await supabaseAdmin.from('challenge_participants').delete().eq('user_id', userId)

  const { data: ownedChallenges } = await supabaseAdmin
    .from('challenges')
    .select('id')
    .eq('created_by', userId)
  const challengeIds = (ownedChallenges || []).map((c) => c.id)
  if (challengeIds.length) {
    await supabaseAdmin.from('challenge_participants').delete().in('challenge_id', challengeIds)
    await supabaseAdmin.from('challenges').delete().in('id', challengeIds)
  }

  await supabaseAdmin.from('workouts').delete().eq('user_id', userId)
  await supabaseAdmin.from('attendance').delete().eq('user_id', userId)
  await supabaseAdmin.from('profile_notes').delete().eq('user_id', userId)

  await supabaseAdmin.from('profiles').delete().eq('id', userId)
  await supabaseAdmin.auth.admin.deleteUser(userId)
  invalidateAuthProfileCache(userId)
}
