import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapStory } from '../lib/mappers.js'
import { authenticate } from '../middleware/auth.js'
import { notifyUser } from '../services/notificationService.js'

const router = express.Router()

export const STORY_REACTIONS = [
  { emoji: '💪', id: 'muscle', label: 'Fuerza' },
  { emoji: '🧴', id: 'protein', label: 'Merece un scoop' },
  { emoji: '🔥', id: 'fire', label: 'Intensidad' },
  { emoji: '⚡', id: 'zap', label: 'Energía' },
  { emoji: '🏆', id: 'trophy', label: 'Leyenda' }
]

const ALLOWED_EMOJIS = new Set(STORY_REACTIONS.map((r) => r.emoji))
const STORY_TTL_MS = 24 * 60 * 60 * 1000
const MAX_VIDEO_CHARS = 18_000_000 // ~13MB base64

async function getProfilesMap(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (!unique.length) return {}
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, avatar')
    .in('id', unique)
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

async function enrichStories(rows, viewerId) {
  if (!rows?.length) return []
  const ids = rows.map((r) => r.id)
  const [{ data: reactions }, { data: views }] = await Promise.all([
    supabaseAdmin.from('story_reactions').select('*').in('story_id', ids),
    supabaseAdmin.from('story_views').select('story_id, user_id').in('story_id', ids)
  ])

  const userIds = [
    ...rows.map((r) => r.user_id),
    ...(reactions || []).map((r) => r.user_id)
  ]
  const userMap = await getProfilesMap(userIds)

  const reactionsByStory = {}
  for (const r of reactions || []) {
    if (!reactionsByStory[r.story_id]) reactionsByStory[r.story_id] = []
    reactionsByStory[r.story_id].push({
      emoji: r.emoji,
      userId: r.user_id,
      user: userMap[r.user_id]
        ? { _id: r.user_id, id: r.user_id, name: userMap[r.user_id].name, avatar: userMap[r.user_id].avatar }
        : { _id: r.user_id, id: r.user_id }
    })
  }

  const viewsByStory = {}
  for (const v of views || []) {
    if (!viewsByStory[v.story_id]) viewsByStory[v.story_id] = []
    viewsByStory[v.story_id].push(v.user_id)
  }

  return rows.map((row) => {
    const author = userMap[row.user_id]
    const storyReactions = reactionsByStory[row.id] || []
    const myReaction = storyReactions.find((r) => r.userId === viewerId)?.emoji || null
    const counts = {}
    for (const r of storyReactions) {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1
    }
    return mapStory(row, {
      user: author
        ? { _id: author.id, id: author.id, name: author.name, avatar: author.avatar }
        : row.user_id,
      reactions: storyReactions,
      reactionCounts: counts,
      myReaction,
      viewCount: (viewsByStory[row.id] || []).length,
      viewed: (viewsByStory[row.id] || []).includes(viewerId)
    })
  })
}

// List active stories from self + following, grouped by user
router.get('/feed', authenticate, async (req, res) => {
  try {
    const { data: following } = await supabaseAdmin
      .from('follows')
      .select('following_id')
      .eq('follower_id', req.user.id)

    const userIds = [...new Set([req.user.id, ...((following || []).map((f) => f.following_id))])]
    const now = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('stories')
      .select('*')
      .in('user_id', userIds)
      .gt('expires_at', now)
      .order('created_at', { ascending: true })

    if (error) throw error

    const enriched = await enrichStories(data || [], req.user.id)

    // Group by user, own ring first
    const byUser = new Map()
    for (const story of enriched) {
      const uid = story.user?._id || story.user
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          user: story.user,
          stories: [],
          hasUnseen: false
        })
      }
      const group = byUser.get(uid)
      group.stories.push(story)
      if (!story.viewed && uid !== req.user.id) group.hasUnseen = true
    }

    const groups = [...byUser.values()].sort((a, b) => {
      const aMine = (a.user?._id || a.user) === req.user.id
      const bMine = (b.user?._id || b.user) === req.user.id
      if (aMine && !bMine) return -1
      if (!aMine && bMine) return 1
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1
      return 0
    })

    res.json({ groups, reactions: STORY_REACTIONS })
  } catch (error) {
    console.error('Stories feed error:', error)
    res.status(500).json({ message: 'Error al cargar historias', error: error.message })
  }
})

router.post('/', authenticate, async (req, res) => {
  try {
    const { mediaType, mediaUrl, caption } = req.body
    if (!mediaUrl || !['image', 'video'].includes(mediaType)) {
      return res.status(400).json({ message: 'Media inválida' })
    }
    if (mediaType === 'video' && String(mediaUrl).length > MAX_VIDEO_CHARS) {
      return res.status(400).json({ message: 'El video es demasiado pesado. Máx. ~12MB / 30s.' })
    }

    const expiresAt = new Date(Date.now() + STORY_TTL_MS).toISOString()
    const { data, error } = await supabaseAdmin
      .from('stories')
      .insert({
        user_id: req.user.id,
        media_type: mediaType,
        media_url: mediaUrl,
        caption: (caption || '').slice(0, 280),
        expires_at: expiresAt
      })
      .select('*')
      .single()

    if (error) throw error

    const [story] = await enrichStories([data], req.user.id)

    process.nextTick(async () => {
      try {
        const { data: followers } = await supabaseAdmin
          .from('follows')
          .select('follower_id')
          .eq('following_id', req.user.id)
        await Promise.all(
          (followers || []).map((f) =>
            notifyUser({
              userId: f.follower_id,
              type: 'social',
              title: `${req.user.name} subió una historia`,
              body: caption?.trim() || (mediaType === 'video' ? 'Nuevo video' : 'Nueva foto'),
              icon: '📖',
              relatedUserId: req.user.id,
              relatedData: { storyId: data.id },
              priority: 'normal'
            })
          )
        )
      } catch (err) {
        console.error('Story notify error:', err?.message || err)
      }
    })

    res.status(201).json(story)
  } catch (error) {
    console.error('Create story error:', error)
    res.status(500).json({ message: 'Error al publicar historia', error: error.message })
  }
})

router.post('/:id/view', authenticate, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('story_views').upsert(
      {
        story_id: req.params.id,
        user_id: req.user.id,
        viewed_at: new Date().toISOString()
      },
      { onConflict: 'story_id,user_id' }
    )
    if (error) throw error
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ message: 'Error al marcar vista', error: error.message })
  }
})

router.post('/:id/react', authenticate, async (req, res) => {
  try {
    const { emoji } = req.body
    if (!ALLOWED_EMOJIS.has(emoji)) {
      return res.status(400).json({ message: 'Reacción no permitida' })
    }

    const { data: story } = await supabaseAdmin
      .from('stories')
      .select('id, user_id, expires_at')
      .eq('id', req.params.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!story) return res.status(404).json({ message: 'Historia no encontrada o expirada' })

    const { error } = await supabaseAdmin.from('story_reactions').upsert(
      {
        story_id: story.id,
        user_id: req.user.id,
        emoji,
        created_at: new Date().toISOString()
      },
      { onConflict: 'story_id,user_id' }
    )
    if (error) throw error

    if (story.user_id !== req.user.id) {
      const meta = STORY_REACTIONS.find((r) => r.emoji === emoji)
      notifyUser({
        userId: story.user_id,
        type: 'social',
        title: `${req.user.name} reaccionó ${emoji}`,
        body: meta?.label || 'Nueva reacción a tu historia',
        icon: emoji,
        relatedUserId: req.user.id,
        relatedData: { storyId: story.id },
        priority: 'low'
      }).catch(() => {})
    }

    const { data: full } = await supabaseAdmin.from('stories').select('*').eq('id', story.id).single()
    const [enriched] = await enrichStories([full], req.user.id)
    res.json(enriched)
  } catch (error) {
    res.status(500).json({ message: 'Error al reaccionar', error: error.message })
  }
})

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('stories')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle()
    if (error || !data) return res.status(404).json({ message: 'Historia no encontrada' })
    res.json({ message: 'Historia eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.get('/reactions', authenticate, (_req, res) => {
  res.json(STORY_REACTIONS)
})

export default router
