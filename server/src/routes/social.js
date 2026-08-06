import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapPost } from '../lib/mappers.js'
import { authenticate } from '../middleware/auth.js'
import { notifyUser } from '../services/notificationService.js'
import { resolveMentions, notifyPostMentions } from '../utils/mentions.js'

const router = express.Router()

function mapComment(row, userMap = {}) {
  const u = userMap[row.user_id]
  return {
    _id: row.id,
    id: row.id,
    user: u
      ? { _id: u.id, id: u.id, name: u.name, username: u.username || null, avatar: u.avatar }
      : row.user_id,
    content: row.content,
    createdAt: row.created_at
  }
}

async function getProfilesMap(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (!unique.length) return {}
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, username, avatar, stats, email')
    .in('id', unique)
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

async function enrichPosts(posts, viewerId = null) {
  if (!posts?.length) return []

  const postIds = posts.map((p) => p.id)
  const sharedIds = [...new Set(posts.map((p) => p.shared_from).filter(Boolean))]

  const [{ data: likes }, { data: comments }, { data: sharedRows }] = await Promise.all([
    supabaseAdmin.from('post_likes').select('post_id, user_id, emoji').in('post_id', postIds).then(async (res) => {
      if (res.error && String(res.error.message || '').includes('emoji')) {
        return supabaseAdmin.from('post_likes').select('post_id, user_id').in('post_id', postIds)
      }
      return res
    }),
    supabaseAdmin
      .from('post_comments')
      .select('*')
      .in('post_id', postIds)
      .order('created_at', { ascending: true }),
    sharedIds.length
      ? supabaseAdmin.from('posts').select('*').in('id', sharedIds)
      : Promise.resolve({ data: [] })
  ])

  const likeUserIds = (likes || []).map((l) => l.user_id)
  const authorIds = [
    ...posts.map((p) => p.user_id),
    ...(sharedRows || []).map((p) => p.user_id),
    ...(comments || []).map((c) => c.user_id),
    ...likeUserIds
  ]
  const userMap = await getProfilesMap(authorIds)

  const likesByPost = {}
  const reactionByPostUser = {}
  const reactionSummaryByPost = {}
  for (const l of likes || []) {
    if (!likesByPost[l.post_id]) likesByPost[l.post_id] = []
    likesByPost[l.post_id].push(l.user_id)
    if (!reactionByPostUser[l.post_id]) reactionByPostUser[l.post_id] = {}
    const emoji = l.emoji || '❤️'
    reactionByPostUser[l.post_id][l.user_id] = emoji
    if (!reactionSummaryByPost[l.post_id]) reactionSummaryByPost[l.post_id] = {}
    reactionSummaryByPost[l.post_id][emoji] = (reactionSummaryByPost[l.post_id][emoji] || 0) + 1
  }

  const commentsByPost = {}
  for (const c of comments || []) {
    if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = []
    commentsByPost[c.post_id].push(mapComment(c, userMap))
  }

  const sharedMap = Object.fromEntries((sharedRows || []).map((p) => [p.id, p]))

  return posts.map((row) => {
    const author = userMap[row.user_id]
    const mappedAuthor = author
      ? { _id: author.id, id: author.id, name: author.name, username: author.username || null, avatar: author.avatar, stats: author.stats }
      : row.user_id

    let sharedFrom = null
    if (row.shared_from && sharedMap[row.shared_from]) {
      const s = sharedMap[row.shared_from]
      const sAuthor = userMap[s.user_id]
      let nestedWorkout = s.workout_data || null
      if (!nestedWorkout && s.content && String(s.content).includes('[workout]')) {
        try {
          const match = String(s.content).match(/\[workout\]([\s\S]*?)\[\/workout\]/)
          if (match) nestedWorkout = JSON.parse(match[1])
        } catch {
          /* ignore */
        }
      }
      sharedFrom = {
        _id: s.id,
        id: s.id,
        user: sAuthor
          ? { _id: sAuthor.id, id: sAuthor.id, name: sAuthor.name, username: sAuthor.username || null, avatar: sAuthor.avatar, stats: sAuthor.stats }
          : s.user_id,
        content: s.content,
        images: s.images || [],
        mood: s.mood || null,
        poll: s.poll || null,
        badgeData: s.badge_data || null,
        workoutData: nestedWorkout,
        postType: s.post_type || 'text',
        createdAt: s.created_at
      }
    }

    let workoutData = row.workout_data || null
    if (!workoutData && row.content && String(row.content).includes('[workout]')) {
      try {
        const match = String(row.content).match(/\[workout\]([\s\S]*?)\[\/workout\]/)
        if (match) workoutData = JSON.parse(match[1])
      } catch {
        /* ignore */
      }
    }

    const summaryMap = reactionSummaryByPost[row.id] || {}
    const reactionSummary = Object.entries(summaryMap)
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count)

    const reactors = Object.entries(reactionByPostUser[row.id] || {}).map(([uid, emoji]) => {
      const u = userMap[uid]
      return {
        userId: uid,
        emoji,
        name: u?.name || 'Usuario',
        avatar: u?.avatar || null
      }
    })

    return {
      ...mapPost(row, {
        user: mappedAuthor,
        likes: likesByPost[row.id] || [],
        comments: commentsByPost[row.id] || [],
        workoutData
      }),
      myReaction: viewerId ? reactionByPostUser[row.id]?.[viewerId] || null : null,
      reactionSummary,
      reactors,
      sharedFrom
    }
  })
}

async function bumpSocialInteractions(userId) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stats')
    .eq('id', userId)
    .single()
  if (!profile) return

  const stats = { ...(profile.stats || {}) }
  stats.socialInteractions = (stats.socialInteractions || 0) + 1
  await supabaseAdmin
    .from('profiles')
    .update({ stats, updated_at: new Date().toISOString() })
    .eq('id', userId)

  try {
    const { checkBadgeUnlocks } = await import('../services/xpService.js')
    await checkBadgeUnlocks(userId, true)
  } catch (err) {
    console.error('Badge check error:', err)
  }
}

// Get feed (own posts + posts from users you follow)
router.get('/feed', authenticate, async (req, res) => {
  try {
    const { data: following } = await supabaseAdmin
      .from('follows')
      .select('following_id')
      .eq('follower_id', req.user.id)

    const followingIds = (following || []).map((f) => f.following_id)
    const feedUserIds = [...new Set([req.user.id, ...followingIds])]

    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .in('user_id', feedUserIds)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    res.json(await enrichPosts(posts || [], req.user.id))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener feed', error: error.message })
  }
})

// Get user posts (for profile view)
router.get('/user/:userId/posts', authenticate, async (req, res) => {
  try {
    const targetId = req.params.userId
    const viewerId = req.user.id

    if (targetId !== viewerId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('settings')
        .eq('id', targetId)
        .maybeSingle()

      const isPublic = profile?.settings?.privacy?.profilePublic !== false
      if (!isPublic) {
        const { data: follow } = await supabaseAdmin
          .from('follows')
          .select('id')
          .eq('follower_id', viewerId)
          .eq('following_id', targetId)
          .maybeSingle()

        if (!follow) {
          return res.json({
            posts: [],
            locked: true,
            reason: 'private_profile',
            message:
              'Este usuario no tiene su perfil público para mostrar sus publicaciones a todo el mundo. Solicita seguirlo para ver el contenido que comparte.'
          })
        }
      }
    }

    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    res.json(await enrichPosts(posts || [], viewerId))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener publicaciones', error: error.message })
  }
})

// Create post
router.post('/', authenticate, async (req, res) => {
  try {
    const { content, images, mood, poll, postType, badgeData, workoutData } = req.body

    let finalPostType = postType || 'text'
    const isRoutineShare =
      postType === 'routine' || Boolean(workoutData?.isRoutine) || Boolean(workoutData?.shareKind === 'routine')
    if (workoutData && isRoutineShare) {
      finalPostType = 'routine'
    } else if (workoutData) {
      finalPostType = 'workout'
    } else if (badgeData) {
      finalPostType = 'badge'
    } else if (images && images.length > 0 && content) {
      finalPostType = 'mixed'
    } else if (images && images.length > 0) {
      finalPostType = 'image'
    } else if (poll) {
      finalPostType = 'poll'
    } else if (mood) {
      finalPostType = 'mood'
    }

    const insertPayload = {
      user_id: req.user.id,
      content: content || '',
      images: images || [],
      mood: mood || null,
      poll: poll
        ? {
            question: poll.question,
            options: poll.options.map((opt) => ({ text: opt, votes: [] })),
            endsAt: poll.endsAt || null
          }
        : null,
      badge_data: badgeData || null,
      post_type: finalPostType
    }

    if (workoutData) {
      insertPayload.workout_data = workoutData
    }

    let { data: post, error } = await supabaseAdmin
      .from('posts')
      .insert(insertPayload)
      .select('*')
      .single()

    if (error && String(error.message || '').toLowerCase().includes('workout_data')) {
      delete insertPayload.workout_data
      insertPayload.content =
        (content || '') +
        `\n\n[workout]${JSON.stringify(workoutData)}[/workout]`
      const retry = await supabaseAdmin.from('posts').insert(insertPayload).select('*').single()
      post = retry.data
      error = retry.error
      if (post && workoutData) post.workout_data = workoutData
    }

    if (error) throw error

    await bumpSocialInteractions(req.user.id)
    const [enriched] = await enrichPosts([post], req.user.id)

    // Notify mentions + followers of new post (background)
    process.nextTick(async () => {
      try {
        const mentions = await resolveMentions(content, req.user.id)
        if (mentions.length) {
          await notifyPostMentions({
            mentions,
            actor: req.user,
            postId: post.id,
            kind: 'post',
            snippet: content
          })
        }

        const { data: followers } = await supabaseAdmin
          .from('follows')
          .select('follower_id')
          .eq('following_id', req.user.id)

        const mentionIds = new Set(mentions.map((m) => m.id))
        const ids = (followers || []).map((f) => f.follower_id).filter((id) => !mentionIds.has(id))
        const preview =
          (content && String(content).replace(/\[workout\][\s\S]*?\[\/workout\]/g, '').trim()) ||
          (isRoutineShare && workoutData?.name && `Compartió rutina: ${workoutData.name}`) ||
          (workoutData?.name && `Completó: ${workoutData.name}`) ||
          (badgeData?.badgeName && `Compartió la insignia ${badgeData.badgeName}`) ||
          (mood && 'Compartió un estado') ||
          (poll?.question && `Encuesta: ${poll.question}`) ||
          'Nueva publicación'

        await Promise.all(
          ids.map((userId) =>
            notifyUser({
              userId,
              type: 'social',
              title: `${req.user.name} publicó`,
              body: preview.length > 100 ? `${preview.slice(0, 97)}…` : preview,
              icon: '📝',
              relatedUserId: req.user.id,
              relatedData: { postId: post.id },
              priority: 'normal'
            })
          )
        )
      } catch (err) {
        console.error('Follower post notify error:', err?.message || err)
      }
    })

    res.status(201).json(enriched)
  } catch (error) {
    res.status(500).json({ message: 'Error al crear publicación', error: error.message })
  }
})

// Vote on poll
router.post('/:id/poll/vote', authenticate, async (req, res) => {
  try {
    const { optionIndex } = req.body
    const { data: post, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) throw error
    if (!post || !post.poll) {
      return res.status(404).json({ message: 'Encuesta no encontrada' })
    }

    const poll = { ...post.poll, options: (post.poll.options || []).map((o) => ({ ...o, votes: [...(o.votes || [])] })) }
    poll.options.forEach((option) => {
      option.votes = (option.votes || []).filter((v) => String(v) !== String(req.user.id))
    })

    if (poll.options[optionIndex]) {
      poll.options[optionIndex].votes.push(req.user.id)
    }

    const { error: updateError } = await supabaseAdmin
      .from('posts')
      .update({ poll, updated_at: new Date().toISOString() })
      .eq('id', post.id)

    if (updateError) throw updateError
    res.json(poll)
  } catch (error) {
    res.status(500).json({ message: 'Error al votar', error: error.message })
  }
})

// Like / reaction (FB style): emoji optional; null/omit toggles ❤️; same emoji removes
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const emojiRaw = req.body?.emoji
    const emoji = emojiRaw === null || emojiRaw === '' ? null : (emojiRaw || '❤️')

    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada' })
    }

    const { data: existing } = await supabaseAdmin
      .from('post_likes')
      .select('*')
      .eq('post_id', post.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    let liked = false
    let myReaction = null

    if (emoji === null) {
      // Explicit unlike
      if (existing) {
        await supabaseAdmin
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', req.user.id)
      }
      liked = false
      myReaction = null
    } else if (existing && (existing.emoji || '❤️') === emoji) {
      // Toggle off same reaction
      await supabaseAdmin
        .from('post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', req.user.id)
      liked = false
      myReaction = null
    } else if (existing) {
      const { error } = await supabaseAdmin
        .from('post_likes')
        .update({ emoji })
        .eq('post_id', post.id)
        .eq('user_id', req.user.id)
      if (error && String(error.message || '').includes('emoji')) {
        // Column not migrated yet — keep like without emoji
        liked = true
        myReaction = '❤️'
      } else if (error) throw error
      else {
        liked = true
        myReaction = emoji
      }
    } else {
      const payload = { post_id: post.id, user_id: req.user.id, emoji }
      let { error } = await supabaseAdmin.from('post_likes').insert(payload)
      if (error && String(error.message || '').includes('emoji')) {
        const retry = await supabaseAdmin
          .from('post_likes')
          .insert({ post_id: post.id, user_id: req.user.id })
        error = retry.error
        myReaction = '❤️'
      } else {
        myReaction = emoji
      }
      if (error) throw error
      liked = true
    }

    const { count } = await supabaseAdmin
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id)

    // Re-read stored emoji so client gets the real value (not a silent heart fallback)
    if (liked) {
      const { data: stored } = await supabaseAdmin
        .from('post_likes')
        .select('emoji')
        .eq('post_id', post.id)
        .eq('user_id', req.user.id)
        .maybeSingle()
      if (stored?.emoji) myReaction = stored.emoji
      else if (emoji) myReaction = emoji
    }

    // Build summary for nested reaction chips
    const { data: likeRows } = await supabaseAdmin
      .from('post_likes')
      .select('emoji')
      .eq('post_id', post.id)
    const summaryMap = {}
    for (const row of likeRows || []) {
      const e = row.emoji || '❤️'
      summaryMap[e] = (summaryMap[e] || 0) + 1
    }
    const reactionSummary = Object.entries(summaryMap)
      .map(([emojiKey, c]) => ({ emoji: emojiKey, count: c }))
      .sort((a, b) => b.count - a.count)

    res.json({ liked, likesCount: count || 0, myReaction, reactionSummary })
  } catch (error) {
    res.status(500).json({ message: 'Error al dar like', error: error.message })
  }
})

// Comment on post
router.post('/:id/comment', authenticate, async (req, res) => {
  try {
    const { content } = req.body

    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada' })
    }

    const { error: insertError } = await supabaseAdmin.from('post_comments').insert({
      post_id: post.id,
      user_id: req.user.id,
      content
    })
    if (insertError) throw insertError

    await bumpSocialInteractions(req.user.id)

    process.nextTick(async () => {
      try {
        const mentions = await resolveMentions(content, req.user.id)
        if (mentions.length) {
          await notifyPostMentions({
            mentions,
            actor: req.user,
            postId: post.id,
            kind: 'comment',
            snippet: content
          })
        }
      } catch (err) {
        console.error('Comment mention notify error:', err?.message || err)
      }
    })

    const { data: comments } = await supabaseAdmin
      .from('post_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })

    const userMap = await getProfilesMap((comments || []).map((c) => c.user_id))
    res.json((comments || []).map((c) => mapComment(c, userMap)))
  } catch (error) {
    res.status(500).json({ message: 'Error al comentar', error: error.message })
  }
})

// Share / reshare — Facebook-style: your caption + original post attached (not duplicated as yours)
router.post('/:id/share', authenticate, async (req, res) => {
  try {
    const { content, mood, poll } = req.body
    const { data: originalPost } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!originalPost) {
      return res.status(404).json({ message: 'Publicación no encontrada' })
    }

    const { data: author } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', originalPost.user_id)
      .maybeSingle()

    let postType = 'mixed'
    if (poll) postType = 'poll'
    else if (mood) postType = 'mood'
    else if (content?.trim()) postType = 'text'

    const insertPayload = {
      user_id: req.user.id,
      content: (content && String(content).trim()) || `Compartido de ${author?.name || 'usuario'}`,
      images: [],
      mood: mood || null,
      poll: poll
        ? {
            question: poll.question,
            options: (poll.options || []).map((opt) => ({
              text: typeof opt === 'string' ? opt : opt.text,
              votes: []
            })),
            endsAt: poll.endsAt || null
          }
        : null,
      badge_data: null,
      workout_data: null,
      shared_from: originalPost.id,
      post_type: postType
    }

    const { data: sharedPost, error } = await supabaseAdmin
      .from('posts')
      .insert(insertPayload)
      .select('*')
      .single()

    if (error) throw error

    await bumpSocialInteractions(req.user.id)
    const [enriched] = await enrichPosts([sharedPost], req.user.id)

    process.nextTick(async () => {
      try {
        const mentions = await resolveMentions(insertPayload.content, req.user.id)
        if (mentions.length) {
          await notifyPostMentions({
            mentions,
            actor: req.user,
            postId: sharedPost.id,
            kind: 'post',
            snippet: insertPayload.content
          })
        }
      } catch (err) {
        console.error('Share mention notify error:', err?.message || err)
      }
    })

    res.status(201).json(enriched)
  } catch (error) {
    res.status(500).json({ message: 'Error al compartir publicación', error: error.message })
  }
})

// Request to follow user
router.post('/:id/follow', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.id
    const currentUserId = req.user.id

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: 'No puedes seguirte a ti mismo' })
    }

    const { data: targetUser } = await supabaseAdmin
      .from('profiles')
      .select('id, name')
      .eq('id', targetUserId)
      .maybeSingle()

    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }

    const { data: existingFollow } = await supabaseAdmin
      .from('follows')
      .select('*')
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .maybeSingle()

    if (existingFollow) {
      return res.status(400).json({ message: 'Ya sigues a este usuario' })
    }

    const { data: pending } = await supabaseAdmin
      .from('follow_requests')
      .select('id')
      .eq('from_user_id', currentUserId)
      .eq('to_user_id', targetUserId)
      .maybeSingle()

    if (pending) {
      return res.status(400).json({ message: 'Ya hay una solicitud pendiente' })
    }

    const { error } = await supabaseAdmin.from('follow_requests').insert({
      from_user_id: currentUserId,
      to_user_id: targetUserId
    })
    if (error) throw error

    await notifyUser({
      userId: targetUserId,
      type: 'follow_request',
      title: 'Nueva solicitud de seguimiento',
      body: `${req.user.name} quiere seguirte`,
      icon: '👤',
      relatedUserId: currentUserId,
      priority: 'normal'
    })

    res.json({
      message: 'Solicitud enviada',
      status: 'pending'
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al enviar solicitud', error: error.message })
  }
})

// Accept follow request
router.post('/:id/accept-follow', authenticate, async (req, res) => {
  try {
    const requesterId = req.params.id
    const currentUserId = req.user.id

    const { data: requester } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', requesterId)
      .maybeSingle()

    if (!requester) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }

    const { data: deletedRequests, error: deleteError } = await supabaseAdmin
      .from('follow_requests')
      .delete()
      .eq('from_user_id', requesterId)
      .eq('to_user_id', currentUserId)
      .select('id')

    if (deleteError) throw deleteError
    if (!deletedRequests?.length) {
      return res.status(404).json({ message: 'No hay solicitud pendiente de este usuario' })
    }

    const { error: followError } = await supabaseAdmin.from('follows').upsert({
      follower_id: requesterId,
      following_id: currentUserId
    })
    if (followError) throw followError

    await notifyUser({
      userId: requesterId,
      type: 'follow_accepted',
      title: 'Solicitud aceptada',
      body: `${req.user.name} aceptó tu solicitud de seguimiento`,
      icon: '✅',
      relatedUserId: currentUserId,
      priority: 'normal'
    })

    res.json({ message: 'Solicitud aceptada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al aceptar solicitud', error: error.message })
  }
})

// Reject follow request
router.post('/:id/reject-follow', authenticate, async (req, res) => {
  try {
    const requesterId = req.params.id
    const currentUserId = req.user.id

    const { data: requester } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', requesterId)
      .maybeSingle()

    if (!requester) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }

    await supabaseAdmin
      .from('follow_requests')
      .delete()
      .eq('from_user_id', requesterId)
      .eq('to_user_id', currentUserId)

    res.json({ message: 'Solicitud rechazada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al rechazar solicitud', error: error.message })
  }
})

// Unfollow user
router.post('/:id/unfollow', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.id
    const currentUserId = req.user.id

    const { data: targetUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', targetUserId)
      .maybeSingle()

    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }

    await supabaseAdmin
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)

    // Also cancel any pending follow request
    await supabaseAdmin
      .from('follow_requests')
      .delete()
      .eq('from_user_id', currentUserId)
      .eq('to_user_id', targetUserId)

    res.json({ message: 'Dejaste de seguir a este usuario' })
  } catch (error) {
    res.status(500).json({ message: 'Error al dejar de seguir', error: error.message })
  }
})

// Cancel pending follow request
router.post('/:id/cancel-follow', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.id
    const currentUserId = req.user.id

    const { data: deleted, error } = await supabaseAdmin
      .from('follow_requests')
      .delete()
      .eq('from_user_id', currentUserId)
      .eq('to_user_id', targetUserId)
      .select('id')

    if (error) throw error
    if (!deleted?.length) {
      return res.status(404).json({ message: 'No hay solicitud pendiente' })
    }

    res.json({ message: 'Solicitud cancelada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al cancelar solicitud', error: error.message })
  }
})

// Get follow requests
router.get('/follow-requests', authenticate, async (req, res) => {
  try {
    const { data: requests, error } = await supabaseAdmin
      .from('follow_requests')
      .select('*')
      .eq('to_user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const userMap = await getProfilesMap((requests || []).map((r) => r.from_user_id))
    res.json(
      (requests || []).map((r) => {
        const u = userMap[r.from_user_id]
        return {
          _id: r.id,
          id: r.id,
          user: u
            ? { _id: u.id, id: u.id, name: u.name, avatar: u.avatar, email: u.email }
            : r.from_user_id,
          requestedAt: r.created_at
        }
      })
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener solicitudes', error: error.message })
  }
})

// Get following list (?userId= optional, defaults to current user)
router.get('/following', authenticate, async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id
    const { data: following, error } = await supabaseAdmin
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)

    if (error) throw error
    const ids = (following || []).map((f) => f.following_id)
    if (!ids.length) return res.json([])

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name, avatar, username, email, stats')
      .in('id', ids)

    res.json(
      (profiles || []).map((p) => ({
        _id: p.id,
        id: p.id,
        name: p.name,
        username: p.username || null,
        avatar: p.avatar,
        stats: p.stats
      }))
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener seguidos', error: error.message })
  }
})

// Get followers list (?userId= optional, defaults to current user)
router.get('/followers', authenticate, async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id
    const { data: followers, error } = await supabaseAdmin
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId)

    if (error) throw error
    const ids = (followers || []).map((f) => f.follower_id)
    if (!ids.length) return res.json([])

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name, avatar, username, email, stats')
      .in('id', ids)

    res.json(
      (profiles || []).map((p) => ({
        _id: p.id,
        id: p.id,
        name: p.name,
        username: p.username || null,
        avatar: p.avatar,
        stats: p.stats
      }))
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener seguidores', error: error.message })
  }
})

// Get follow status
router.get('/:id/follow-status', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.id

    const { data: targetUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', targetUserId)
      .maybeSingle()

    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }

    const [{ data: follow }, { data: pending }, { count: followersCount }, { count: followingCount }] =
      await Promise.all([
        supabaseAdmin
          .from('follows')
          .select('*')
          .eq('follower_id', req.user.id)
          .eq('following_id', targetUserId)
          .maybeSingle(),
        supabaseAdmin
          .from('follow_requests')
          .select('id')
          .eq('from_user_id', req.user.id)
          .eq('to_user_id', targetUserId)
          .maybeSingle(),
        supabaseAdmin
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', targetUserId),
        supabaseAdmin
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', targetUserId)
      ])

    res.json({
      isFollowing: !!follow,
      hasPendingRequest: !!pending,
      followersCount: followersCount || 0,
      followingCount: followingCount || 0
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estado', error: error.message })
  }
})

// Delete post
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada o no tienes permiso' })
    }

    await supabaseAdmin.from('post_likes').delete().eq('post_id', post.id)
    await supabaseAdmin.from('post_comments').delete().eq('post_id', post.id)
    await supabaseAdmin.from('posts').delete().eq('id', post.id)

    res.json({ message: 'Publicación eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar', error: error.message })
  }
})

export default router
