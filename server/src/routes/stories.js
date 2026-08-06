import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapStory } from '../lib/mappers.js'
import { authenticate } from '../middleware/auth.js'
import { notifyUser } from '../services/notificationService.js'
import { resolveMentions, notifyStoryMentions } from '../utils/mentions.js'

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
const MAX_VIDEO_CHARS = 18_000_000

async function purgeExpiredStories() {
  try {
    const now = new Date().toISOString()
    await supabaseAdmin.from('stories').delete().lte('expires_at', now)
  } catch (err) {
    console.error('purgeExpiredStories:', err?.message || err)
  }
}

async function getProfilesMap(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (!unique.length) return {}
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, username, avatar')
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
        ? {
            _id: author.id,
            id: author.id,
            name: author.name,
            username: author.username || null,
            avatar: author.avatar
          }
        : row.user_id,
      reactions: storyReactions,
      reactionCounts: counts,
      myReaction,
      viewCount: (viewsByStory[row.id] || []).filter((id) => id !== row.user_id).length,
      viewed: (viewsByStory[row.id] || []).includes(viewerId)
    })
  })
}

function mapAlbum(row, extras = {}) {
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    userId: row.user_id,
    createdAt: row.created_at,
    coverUrl: extras.coverUrl || null,
    coverType: extras.coverType || null,
    count: extras.count || 0,
    items: extras.items || undefined
  }
}

function mapFavorite(row) {
  return {
    _id: row.id,
    id: row.id,
    albumId: row.album_id,
    mediaType: row.media_type,
    mediaUrl: row.media_url,
    caption: row.caption || '',
    authorId: row.author_id,
    authorName: row.author_name,
    originalStoryId: row.original_story_id,
    createdAt: row.created_at
  }
}

// —— Favorites albums (before /:id) ——
router.get('/favorites/albums', authenticate, async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id
    const { data: albums, error } = await supabaseAdmin
      .from('story_favorite_albums')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!albums?.length) return res.json([])

    const albumIds = albums.map((a) => a.id)
    const { data: favs } = await supabaseAdmin
      .from('story_favorites')
      .select('*')
      .in('album_id', albumIds)
      .order('created_at', { ascending: true })

    const byAlbum = {}
    for (const f of favs || []) {
      if (!byAlbum[f.album_id]) byAlbum[f.album_id] = []
      byAlbum[f.album_id].push(f)
    }

    res.json(
      albums.map((a) => {
        const items = byAlbum[a.id] || []
        const cover = items[0]
        return mapAlbum(a, {
          coverUrl: cover?.media_url || null,
          coverType: cover?.media_type || null,
          count: items.length
        })
      })
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar álbumes', error: error.message })
  }
})

router.post('/favorites/albums', authenticate, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 40)
    if (!name) return res.status(400).json({ message: 'Nombre requerido' })

    const { data, error } = await supabaseAdmin
      .from('story_favorite_albums')
      .insert({ user_id: req.user.id, name })
      .select('*')
      .single()

    if (error) throw error
    res.status(201).json(mapAlbum(data, { count: 0 }))
  } catch (error) {
    res.status(500).json({ message: 'Error al crear álbum', error: error.message })
  }
})

router.get('/favorites/albums/:albumId', authenticate, async (req, res) => {
  try {
    const { data: album, error } = await supabaseAdmin
      .from('story_favorite_albums')
      .select('*')
      .eq('id', req.params.albumId)
      .maybeSingle()

    if (error) throw error
    if (!album) return res.status(404).json({ message: 'Álbum no encontrado' })

    const { data: items } = await supabaseAdmin
      .from('story_favorites')
      .select('*')
      .eq('album_id', album.id)
      .order('created_at', { ascending: true })

    const mappedItems = (items || []).map(mapFavorite)
    res.json(
      mapAlbum(album, {
        coverUrl: mappedItems[0]?.mediaUrl || null,
        coverType: mappedItems[0]?.mediaType || null,
        count: mappedItems.length,
        items: mappedItems
      })
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar álbum', error: error.message })
  }
})

router.delete('/favorites/albums/:albumId', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('story_favorite_albums')
      .delete()
      .eq('id', req.params.albumId)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle()
    if (error || !data) return res.status(404).json({ message: 'Álbum no encontrado' })
    res.json({ message: 'Álbum eliminado' })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.post('/favorites', authenticate, async (req, res) => {
  try {
    await purgeExpiredStories()
    const { albumId, storyId } = req.body
    if (!albumId || !storyId) {
      return res.status(400).json({ message: 'Álbum e historia requeridos' })
    }

    const { data: album } = await supabaseAdmin
      .from('story_favorite_albums')
      .select('id')
      .eq('id', albumId)
      .eq('user_id', req.user.id)
      .maybeSingle()
    if (!album) return res.status(404).json({ message: 'Álbum no encontrado' })

    const now = new Date().toISOString()
    const { data: story } = await supabaseAdmin
      .from('stories')
      .select('*')
      .eq('id', storyId)
      .gt('expires_at', now)
      .maybeSingle()

    if (!story) {
      return res.status(410).json({ message: 'Este estado ya expiró o no está disponible' })
    }

    const { data: author } = await supabaseAdmin
      .from('profiles')
      .select('id, name')
      .eq('id', story.user_id)
      .maybeSingle()

    const { data, error } = await supabaseAdmin
      .from('story_favorites')
      .insert({
        album_id: albumId,
        user_id: req.user.id,
        original_story_id: story.id,
        media_type: story.media_type,
        media_url: story.media_url,
        caption: story.caption || '',
        author_id: story.user_id,
        author_name: author?.name || null
      })
      .select('*')
      .single()

    if (error) throw error
    res.status(201).json(mapFavorite(data))
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar favorito', error: error.message })
  }
})

router.delete('/favorites/:favId', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('story_favorites')
      .delete()
      .eq('id', req.params.favId)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle()
    if (error || !data) return res.status(404).json({ message: 'Favorito no encontrado' })
    res.json({ message: 'Eliminado de favoritos' })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.get('/reactions', authenticate, (_req, res) => {
  res.json(STORY_REACTIONS)
})

router.get('/feed', authenticate, async (req, res) => {
  try {
    await purgeExpiredStories()
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
    await purgeExpiredStories()
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
        const mentions = await resolveMentions(caption, req.user.id)
        if (mentions.length) {
          await notifyStoryMentions({
            mentions,
            actor: req.user,
            story: data,
            caption
          })
        }

        const mentionIds = new Set(mentions.map((m) => m.id))
        const { data: followers } = await supabaseAdmin
          .from('follows')
          .select('follower_id')
          .eq('following_id', req.user.id)
        await Promise.all(
          (followers || [])
            .filter((f) => !mentionIds.has(f.follower_id))
            .map((f) =>
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

router.get('/:id', authenticate, async (req, res) => {
  try {
    await purgeExpiredStories()
    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('stories')
      .select('*')
      .eq('id', req.params.id)
      .gt('expires_at', now)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return res.status(410).json({ message: 'Este estado ya expiró o no está disponible' })
    }

    const [story] = await enrichStories([data], req.user.id)
    res.json(story)
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.post('/:id/view', authenticate, async (req, res) => {
  try {
    const { data: story } = await supabaseAdmin
      .from('stories')
      .select('id, user_id')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!story) return res.status(404).json({ message: 'Historia no encontrada' })

    // Never count the author as a viewer of their own story
    if (story.user_id === req.user.id) {
      return res.json({ ok: true, skipped: true })
    }

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

// WhatsApp-style viewers inbox (own stories only) — includes reaction if any
router.get('/:id/viewers', authenticate, async (req, res) => {
  try {
    const { data: story } = await supabaseAdmin
      .from('stories')
      .select('id, user_id')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!story) return res.status(404).json({ message: 'Historia no encontrada' })
    if (story.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Solo el autor puede ver quién vio la historia' })
    }

    const [{ data: views }, { data: reactions }] = await Promise.all([
      supabaseAdmin
        .from('story_views')
        .select('user_id, viewed_at')
        .eq('story_id', story.id)
        .order('viewed_at', { ascending: false }),
      supabaseAdmin.from('story_reactions').select('user_id, emoji').eq('story_id', story.id)
    ])

    const reactionByUser = Object.fromEntries((reactions || []).map((r) => [r.user_id, r.emoji]))
    const viewerIds = (views || []).map((v) => v.user_id).filter((id) => id !== req.user.id)
    const userMap = await getProfilesMap(viewerIds)

    res.json(
      viewerIds.map((uid) => {
        const view = (views || []).find((v) => v.user_id === uid)
        const profile = userMap[uid]
        return {
          userId: uid,
          user: profile
            ? { _id: uid, id: uid, name: profile.name, avatar: profile.avatar }
            : { _id: uid, id: uid, name: 'Usuario' },
          viewedAt: view?.viewed_at || null,
          reaction: reactionByUser[uid] || null
        }
      })
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener vistas', error: error.message })
  }
})

router.post('/:id/react', authenticate, async (req, res) => {
  try {
    await purgeExpiredStories()
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
      const reactorName = req.user.name || 'Alguien'
      try {
        const { data: existing } = await supabaseAdmin
          .from('notifications')
          .select('id, related_data')
          .eq('user_id', story.user_id)
          .eq('type', 'story_reaction')
          .eq('related_user_id', req.user.id)
          .eq('read', false)

        const staleIds = (existing || [])
          .filter((n) => n.related_data?.storyId === story.id)
          .map((n) => n.id)
        if (staleIds.length) {
          await supabaseAdmin.from('notifications').delete().in('id', staleIds)
        }

        await notifyUser({
          userId: story.user_id,
          type: 'story_reaction',
          title: `${reactorName} reaccionó a tu estado`,
          body: `${emoji} ${meta?.label || 'Nueva reacción'}`,
          icon: emoji,
          relatedUserId: req.user.id,
          relatedData: {
            storyId: story.id,
            emoji,
            reactionLabel: meta?.label || null
          },
          priority: 'normal',
          pushTag: `story-react-${story.id}-${req.user.id}`,
          pushUrl: '/notifications'
        })
      } catch (err) {
        console.error('Story reaction notify error:', err?.message || err)
      }
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

export default router
