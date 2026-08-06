import { supabaseAdmin } from '../lib/supabase.js'
import { extractMentionUsernames } from './username.js'
import { notifyUser } from '../services/notificationService.js'
import { encodeChatContent } from './chatMessage.js'

/**
 * Resolve @handles in text → profile rows (excluding actor).
 */
export async function resolveMentions(text, actorId) {
  const handles = extractMentionUsernames(text)
  if (!handles.length) return []

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, username, avatar')
    .in('username', handles)

  if (error) {
    console.error('resolveMentions:', error.message)
    return []
  }

  return (data || []).filter((u) => u.id !== actorId)
}

/**
 * Notify users mentioned in a post or comment.
 */
export async function notifyPostMentions({
  mentions,
  actor,
  postId,
  kind = 'post',
  snippet = ''
}) {
  const list = mentions || []
  if (!list.length || !actor?.id) return

  const who = actor.username ? `@${actor.username}` : actor.name || 'Alguien'
  const title =
    kind === 'comment'
      ? `${who} te mencionó en un comentario`
      : `${who} te mencionó en una publicación`

  await Promise.all(
    list.map((u) =>
      notifyUser({
        userId: u.id,
        type: 'mention',
        title,
        body: String(snippet || '').slice(0, 120) || 'Toca para ver la publicación',
        icon: '📣',
        relatedUserId: actor.id,
        relatedData: { postId, kind },
        priority: 'high',
        pushUrl: '/social'
      })
    )
  )
}

/**
 * Story mention: notification + DM with story attachment.
 */
export async function notifyStoryMentions({ mentions, actor, story, caption }) {
  const list = mentions || []
  if (!list.length || !actor?.id || !story?.id) return

  const who = actor.username ? `@${actor.username}` : actor.name || 'Alguien'
  const attachment = {
    type: 'story',
    storyId: story.id,
    mediaType: story.media_type || story.mediaType,
    mediaUrl: story.media_url || story.mediaUrl,
    caption: caption || story.caption || '',
    authorName: actor.name,
    authorUsername: actor.username || null,
    authorAvatar: actor.avatar || null,
    mention: true
  }

  await Promise.all(
    list.map(async (u) => {
      await notifyUser({
        userId: u.id,
        type: 'mention',
        title: `${who} te mencionó en una historia`,
        body: String(caption || '').slice(0, 120) || 'Se te mencionó en una historia',
        icon: '📣',
        relatedUserId: actor.id,
        relatedData: { storyId: story.id, kind: 'story' },
        priority: 'high',
        pushUrl: '/chat'
      })

      const content = encodeChatContent({
        text: 'Se te mencionó en la siguiente historia',
        attachment
      })

      await supabaseAdmin.from('messages').insert({
        from_user_id: actor.id,
        to_user_id: u.id,
        content,
        read: false
      })
    })
  )
}
