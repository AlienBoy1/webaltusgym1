import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapPost } from '../lib/mappers.js'
import { authenticate } from '../middleware/auth.js'
import { notifyUser } from '../services/notificationService.js'
import { resolveMentions, notifyPostMentions } from '../utils/mentions.js'

const router = express.Router()

const POST_REACTION_EMOJIS = new Set(['❤️', '💪', '🧴', '🔥', '⚡', '🏆'])

function isMissingEmojiColumn(error) {
  const msg = String(error?.message || error?.details || '')
  const code = String(error?.code || '')
  return code === '42703' || (msg.includes('emoji') && msg.includes('does not exist'))
}

function normalizeReactionEmoji(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const s = String(raw)
  // Accept heart with/without variation selector
  if (s === '❤' || s === '❤️') return '❤️'
  if (POST_REACTION_EMOJIS.has(s)) return s
  return null
}

function mapComment(row, userMap = {}, reactionMeta = null) {
  const u = userMap[row.user_id]
  const base = {
    _id: row.id,
    id: row.id,
    parentId: row.parent_id || null,
    user: u
      ? { _id: u.id, id: u.id, name: u.name, username: u.username || null, avatar: u.avatar }
      : row.user_id,
    content: row.content,
    createdAt: row.created_at,
    replies: [],
    myReaction: null,
    reactionSummary: [],
    likesCount: 0
  }
  if (reactionMeta) {
    base.myReaction = reactionMeta.myReaction || null
    base.reactionSummary = reactionMeta.reactionSummary || []
    base.likesCount = Number(reactionMeta.likesCount) || 0
  }
  return base
}

/** Load reaction aggregates for a list of comment ids. */
async function getCommentReactionMeta(commentIds = [], viewerId = null) {
  const ids = [...new Set((commentIds || []).filter(Boolean).map(String))]
  const empty = {}
  if (!ids.length) return empty

  const { data: likes, error } = await supabaseAdmin
    .from('comment_likes')
    .select('comment_id, user_id, emoji')
    .in('comment_id', ids)

  if (error) {
    // Table may not exist yet
    console.warn('comment_likes:', error.message)
    return empty
  }

  const byComment = {}
  for (const id of ids) {
    byComment[id] = { myReaction: null, reactionSummary: [], likesCount: 0, counts: {} }
  }
  for (const row of likes || []) {
    const cid = String(row.comment_id)
    if (!byComment[cid]) continue
    const emoji = normalizeReactionEmoji(row.emoji) || '❤️'
    byComment[cid].counts[emoji] = (byComment[cid].counts[emoji] || 0) + 1
    byComment[cid].likesCount += 1
    if (viewerId && String(row.user_id) === String(viewerId)) {
      byComment[cid].myReaction = emoji
    }
  }
  for (const cid of Object.keys(byComment)) {
    const counts = byComment[cid].counts
    byComment[cid].reactionSummary = Object.entries(counts)
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count)
    delete byComment[cid].counts
  }
  return byComment
}

async function mapCommentsWithReactions(rows = [], userMap = {}, viewerId = null) {
  const flat = (rows || []).map((c) => mapComment(c, userMap))
  const meta = await getCommentReactionMeta(
    flat.map((c) => c._id || c.id),
    viewerId
  )
  return flat.map((c) => {
    const id = String(c._id || c.id)
    const m = meta[id]
    if (!m) return c
    return {
      ...c,
      myReaction: m.myReaction,
      reactionSummary: m.reactionSummary,
      likesCount: m.likesCount
    }
  })
}

/** Nest flat comments into Facebook-style threads (root + replies). */
function nestComments(flat = []) {
  const byId = Object.create(null)
  const roots = []
  for (const c of flat) {
    byId[c._id || c.id] = { ...c, replies: [] }
  }
  for (const c of flat) {
    const id = c._id || c.id
    const node = byId[id]
    const parentId = c.parentId
    if (parentId && byId[parentId]) {
      byId[parentId].replies.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

const POST_FEED_COLUMNS =
  'id,user_id,content,mood,poll,post_type,badge_data,workout_data,shared_from,created_at,updated_at'
/** Feed list omits base64 `images` (loaded in post detail) — they were timing out production. */
const POST_FEED_COLUMNS_WITH_IMAGES =
  'id,user_id,content,images,mood,poll,post_type,badge_data,workout_data,shared_from,created_at,updated_at'

const MAX_FEED_FOLLOWING = 80
/** Cap base64 image payload per post when images are explicitly included. */
const MAX_FEED_IMAGE_CHARS = 350_000

function slimImagesForFeed(images) {
  if (!Array.isArray(images) || !images.length) return []
  let used = 0
  const out = []
  for (const img of images) {
    const len = typeof img === 'string' ? img.length : 0
    if (len > MAX_FEED_IMAGE_CHARS) continue
    if (used + len > MAX_FEED_IMAGE_CHARS) break
    out.push(img)
    used += len
  }
  return out
}

function postLikelyHasImages(row) {
  if (Array.isArray(row.images) && row.images.length) return true
  const t = row.post_type || row.postType
  return t === 'image' || t === 'mixed'
}

async function getProfilesMap(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (!unique.length) return {}
  // Chunk large ID lists (PostgREST URL / payload limits)
  const chunkSize = 80
  const chunks = []
  for (let i = 0; i < unique.length; i += chunkSize) {
    chunks.push(unique.slice(i, i + chunkSize))
  }
  const maps = await Promise.all(
    chunks.map(async (chunk) => {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, name, username, avatar, stats')
        .in('id', chunk)
      return data || []
    })
  )
  return Object.fromEntries(maps.flat().map((p) => [p.id, p]))
}

/** Aggregate comment counts without shipping every comment row. */
async function getCommentCountsByPost(postIds) {
  if (!postIds.length) return {}
  const { data, error } = await supabaseAdmin.rpc('feed_comment_counts', { pids: postIds })
  if (!error && Array.isArray(data)) {
    return Object.fromEntries(data.map((r) => [r.post_id, Number(r.cnt) || 0]))
  }
  // Safe fallback: head+count per post (avoids loading every comment row)
  const pairs = await Promise.all(
    postIds.map(async (id) => {
      const { count } = await supabaseAdmin
        .from('post_comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', id)
      return [id, count || 0]
    })
  )
  return Object.fromEntries(pairs)
}

/** Aggregate reaction emoji counts without shipping every liker. */
async function getReactionStatsByPost(postIds) {
  if (!postIds.length) return {}
  const { data, error } = await supabaseAdmin.rpc('feed_reaction_stats', { pids: postIds })
  if (!error && Array.isArray(data)) {
    const byPost = {}
    for (const r of data) {
      if (!byPost[r.post_id]) byPost[r.post_id] = {}
      const emoji = normalizeReactionEmoji(r.emoji) || r.emoji || '❤️'
      byPost[r.post_id][emoji] = Number(r.cnt) || 0
    }
    return byPost
  }
  // Safe fallback: capped row scan (RPC preferred)
  let res = await supabaseAdmin
    .from('post_likes')
    .select('post_id, emoji')
    .in('post_id', postIds)
    .limit(3000)
  if (res.error && isMissingEmojiColumn(res.error)) {
    res = await supabaseAdmin
      .from('post_likes')
      .select('post_id')
      .in('post_id', postIds)
      .limit(3000)
  }
  const byPost = {}
  for (const l of res.data || []) {
    if (!byPost[l.post_id]) byPost[l.post_id] = {}
    const emoji = normalizeReactionEmoji(l.emoji) || l.emoji || '❤️'
    byPost[l.post_id][emoji] = (byPost[l.post_id][emoji] || 0) + 1
  }
  return byPost
}

async function enrichPostsLite(posts, viewerId = null) {
  if (!posts?.length) return []

  const postIds = posts.map((p) => p.id)
  const sharedIds = [...new Set(posts.map((p) => p.shared_from).filter(Boolean))]

  const [commentCountByPost, reactionSummaryByPost, myLikesRes, sharedRes] = await Promise.all([
    getCommentCountsByPost(postIds),
    getReactionStatsByPost(postIds),
    viewerId
      ? supabaseAdmin
          .from('post_likes')
          .select('post_id, emoji')
          .in('post_id', postIds)
          .eq('user_id', viewerId)
          .then(async (res) => {
            if (res.error && isMissingEmojiColumn(res.error)) {
              return supabaseAdmin
                .from('post_likes')
                .select('post_id')
                .in('post_id', postIds)
                .eq('user_id', viewerId)
            }
            return res
          })
      : Promise.resolve({ data: [] }),
    sharedIds.length
      ? supabaseAdmin.from('posts').select(POST_FEED_COLUMNS).in('id', sharedIds)
      : Promise.resolve({ data: [] })
  ])

  const myReactionByPost = {}
  for (const l of myLikesRes.data || []) {
    myReactionByPost[l.post_id] = normalizeReactionEmoji(l.emoji) || l.emoji || '❤️'
  }

  const sharedRows = sharedRes.data || []
  const authorIds = [
    ...posts.map((p) => p.user_id),
    ...sharedRows.map((p) => p.user_id)
  ]
  const userMap = await getProfilesMap(authorIds)
  const sharedMap = Object.fromEntries(sharedRows.map((p) => [p.id, p]))

  return posts.map((row) => {
    const author = userMap[row.user_id]
    const mappedAuthor = author
      ? {
          _id: author.id,
          id: author.id,
          name: author.name,
          username: author.username || null,
          avatar: author.avatar,
          stats: author.stats
        }
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
          ? {
              _id: sAuthor.id,
              id: sAuthor.id,
              name: sAuthor.name,
              username: sAuthor.username || null,
              avatar: sAuthor.avatar,
              stats: sAuthor.stats
            }
          : s.user_id,
        content: s.content,
        images: [],
        mood: s.mood || null,
        poll: s.poll || null,
        badgeData: s.badge_data || null,
        workoutData: nestedWorkout,
        postType: s.post_type || 'text',
        createdAt: s.created_at,
        imagesOmitted: postLikelyHasImages(s)
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
    const likesCount = reactionSummary.reduce((sum, r) => sum + (r.count || 0), 0)

    return {
      ...mapPost(
        { ...row, images: [] },
        {
          user: mappedAuthor,
          likes: [],
          comments: [],
          workoutData
        }
      ),
      likesCount,
      myReaction: viewerId ? myReactionByPost[row.id] || null : null,
      reactionSummary,
      reactors: [],
      sharedFrom,
      commentsCount: commentCountByPost[row.id] || 0,
      commentsLoaded: false,
      imagesOmitted: postLikelyHasImages(row)
    }
  })
}

async function enrichPosts(posts, viewerId = null, options = {}) {
  const lite = Boolean(options.lite)
  if (!posts?.length) return []
  if (lite) return enrichPostsLite(posts, viewerId)

  const postIds = posts.map((p) => p.id)
  const sharedIds = [...new Set(posts.map((p) => p.shared_from).filter(Boolean))]

  const likesQuery = supabaseAdmin
    .from('post_likes')
    .select('post_id, user_id, emoji')
    .in('post_id', postIds)
    .then(async (res) => {
      if (res.error && isMissingEmojiColumn(res.error)) {
        return supabaseAdmin.from('post_likes').select('post_id, user_id').in('post_id', postIds)
      }
      return res
    })

  const commentsQuery = supabaseAdmin
    .from('post_comments')
    .select('*')
    .in('post_id', postIds)
    .order('created_at', { ascending: true })

  const [{ data: likes }, { data: comments }, { data: sharedRows }] = await Promise.all([
    likesQuery,
    commentsQuery,
    sharedIds.length
      ? supabaseAdmin.from('posts').select(POST_FEED_COLUMNS).in('id', sharedIds)
      : Promise.resolve({ data: [] })
  ])

  const likeUserIds = (likes || []).map((l) => l.user_id)
  const commentUserIds = (comments || []).map((c) => c.user_id)
  const authorIds = [
    ...posts.map((p) => p.user_id),
    ...(sharedRows || []).map((p) => p.user_id),
    ...commentUserIds,
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
    const emoji = normalizeReactionEmoji(l.emoji) || l.emoji || '❤️'
    reactionByPostUser[l.post_id][l.user_id] = emoji
    if (!reactionSummaryByPost[l.post_id]) reactionSummaryByPost[l.post_id] = {}
    reactionSummaryByPost[l.post_id][emoji] = (reactionSummaryByPost[l.post_id][emoji] || 0) + 1
  }

  const commentsByPost = {}
  const commentsWithReactions = await mapCommentsWithReactions(comments || [], userMap, viewerId)
  // Preserve post_id from original rows (mapComment drops it)
  const postIdByCommentId = Object.fromEntries((comments || []).map((c) => [String(c.id), c.post_id]))
  for (const c of commentsWithReactions) {
    const pid = postIdByCommentId[String(c._id || c.id)]
    if (!pid) continue
    if (!commentsByPost[pid]) commentsByPost[pid] = []
    commentsByPost[pid].push(c)
  }
  for (const pid of Object.keys(commentsByPost)) {
    commentsByPost[pid] = nestComments(commentsByPost[pid])
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
        username: u?.username || null,
        avatar: u?.avatar || null
      }
    })

    const mappedComments = commentsByPost[row.id] || []
    const likesArr = likesByPost[row.id] || []

    return {
      ...mapPost(row, {
        user: mappedAuthor,
        likes: likesArr,
        comments: mappedComments,
        workoutData
      }),
      likesCount: likesArr.length,
      myReaction: viewerId ? reactionByPostUser[row.id]?.[viewerId] || null : null,
      reactionSummary,
      reactors,
      sharedFrom,
      commentsLoaded: true
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

function mapAuthorBrief(author) {
  if (!author?.id) return null
  return {
    _id: author.id,
    id: author.id,
    name: author.name,
    username: author.username || null,
    avatar: author.avatar,
    stats: author.stats || {}
  }
}

function mapFeedRpcPost(row) {
  const author = mapAuthorBrief(row.author) || row.user_id
  let workoutData = row.workout_data || null
  if (!workoutData && row.content && String(row.content).includes('[workout]')) {
    try {
      const match = String(row.content).match(/\[workout\]([\s\S]*?)\[\/workout\]/)
      if (match) workoutData = JSON.parse(match[1])
    } catch {
      /* ignore */
    }
  }

  let sharedFrom = null
  if (row.shared_post?.id) {
    const s = row.shared_post
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
      user: mapAuthorBrief(s.author) || s.user_id,
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

  const reactionSummary = Array.isArray(row.reaction_summary) ? row.reaction_summary : []
  return {
    ...mapPost(
      {
        id: row.id,
        user_id: row.user_id,
        content: row.content,
        images: [],
        mood: row.mood,
        poll: row.poll,
        post_type: row.post_type,
        badge_data: row.badge_data,
        workout_data: workoutData,
        shared_from: row.shared_from,
        created_at: row.created_at,
        updated_at: row.updated_at
      },
      { user: author, likes: [], comments: [], workoutData }
    ),
    likesCount: Number(row.likes_count) || 0,
    myReaction: normalizeReactionEmoji(row.my_reaction) || row.my_reaction || null,
    reactionSummary,
    reactors: [],
    sharedFrom,
    commentsCount: Number(row.comments_count) || 0,
    commentsLoaded: false,
    imagesOmitted: Boolean(row.images_omitted) || postLikelyHasImages(row),
    profilePublic: row.profile_public !== false,
    isFollowing: Boolean(row.is_following),
    hasPendingRequest: Boolean(row.has_pending_request),
    canFollow: Boolean(row.can_follow)
  }
}

// Prefer single-RPC feed page, then lite enrich without heavy base64 images.
router.get('/feed', authenticate, async (req, res) => {
  const started = Date.now()
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20)
    const before = req.query.before || null

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_social_feed_page', {
      p_viewer: req.user.id,
      p_before: before,
      p_limit: limit
    })

    if (!rpcError && rpcData && typeof rpcData === 'object') {
      const posts = Array.isArray(rpcData.posts) ? rpcData.posts.map(mapFeedRpcPost) : []
      res.setHeader('Server-Timing', `feed;dur=${Date.now() - started};desc="rpc"`)
      return res.json({
        posts,
        hasMore: Boolean(rpcData.hasMore),
        nextCursor: rpcData.nextCursor || null
      })
    }

    if (rpcError) {
      console.warn('[feed] RPC unavailable, using lite path:', rpcError.message)
    }

    const [{ data: following }, { data: pendingReqs }] = await Promise.all([
      supabaseAdmin
        .from('follows')
        .select('following_id')
        .eq('follower_id', req.user.id)
        .limit(200),
      supabaseAdmin
        .from('follow_requests')
        .select('to_user_id')
        .eq('from_user_id', req.user.id)
        .limit(100)
    ])

    const followingSet = new Set((following || []).map((f) => f.following_id))
    const pendingSet = new Set((pendingReqs || []).map((r) => r.to_user_id))

    // Oversample then filter by public/private so fallback matches RPC visibility
    let query = supabaseAdmin
      .from('posts')
      .select(POST_FEED_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(Math.min((limit + 1) * 4, 60))

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: rawPosts, error } = await query
    if (error) throw error

    const candidates = rawPosts || []
    const authorIds = [...new Set(candidates.map((p) => p.user_id).filter(Boolean))]
    const settingsMap = {}
    if (authorIds.length) {
      const { data: authors } = await supabaseAdmin
        .from('profiles')
        .select('id, settings')
        .in('id', authorIds)
      for (const a of authors || []) {
        settingsMap[a.id] = a.settings?.privacy?.profilePublic !== false
      }
    }

    const visible = candidates.filter((row) => {
      if (row.user_id === req.user.id) return true
      if (followingSet.has(row.user_id)) return true
      return settingsMap[row.user_id] !== false
    })

    const hasMore = visible.length > limit
    const page = hasMore ? visible.slice(0, limit) : visible
    const enriched = await enrichPosts(page, req.user.id, { lite: true })
    const withFlags = enriched.map((post) => {
      const aid = post.user?._id || post.user?.id || post.user
      const isSelf = aid === req.user.id
      const profilePublic = settingsMap[aid] !== false
      const isFollowing = followingSet.has(aid)
      const hasPendingRequest = pendingSet.has(aid)
      return {
        ...post,
        profilePublic,
        isFollowing,
        hasPendingRequest,
        canFollow: !isSelf && profilePublic && !isFollowing && !hasPendingRequest
      }
    })
    const nextCursor = page.length ? page[page.length - 1].created_at : null

    res.setHeader('Server-Timing', `feed;dur=${Date.now() - started};desc="lite"`)
    res.json({
      posts: withFlags,
      hasMore,
      nextCursor
    })
  } catch (error) {
    console.error('[feed] error', error?.message || error, `ms=${Date.now() - started}`)
    res.status(500).json({ message: 'Error al obtener feed', error: error.message })
  }
})

/** Lazy media for feed cards (keeps /feed payload tiny). */
router.get('/:id/images', authenticate, async (req, res) => {
  try {
    const { data: post, error } = await supabaseAdmin
      .from('posts')
      .select('id, user_id, images')
      .eq('id', req.params.id)
      .maybeSingle()
    if (error) throw error
    if (!post) return res.status(404).json({ message: 'Publicación no encontrada' })

    if (post.user_id !== req.user.id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('settings')
        .eq('id', post.user_id)
        .maybeSingle()
      const isPublic = profile?.settings?.privacy?.profilePublic !== false
      if (!isPublic) {
        const { data: follow } = await supabaseAdmin
          .from('follows')
          .select('id')
          .eq('follower_id', req.user.id)
          .eq('following_id', post.user_id)
          .maybeSingle()
        if (!follow) {
          return res.status(403).json({ message: 'Esta publicación no está disponible' })
        }
      }
    }

    res.setHeader('Cache-Control', 'private, max-age=120')
    res.json({ images: Array.isArray(post.images) ? post.images : [] })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener imágenes', error: error.message })
  }
})

// Single post (native detail view)
router.get('/post/:id', authenticate, async (req, res) => {
  try {
    const { data: post, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()
    if (error) throw error
    if (!post) return res.status(404).json({ message: 'Publicación no encontrada' })

    if (post.user_id !== req.user.id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('settings')
        .eq('id', post.user_id)
        .maybeSingle()
      const isPublic = profile?.settings?.privacy?.profilePublic !== false
      if (!isPublic) {
        const { data: follow } = await supabaseAdmin
          .from('follows')
          .select('id')
          .eq('follower_id', req.user.id)
          .eq('following_id', post.user_id)
          .maybeSingle()
        if (!follow) {
          return res.status(403).json({ message: 'Esta publicación no está disponible' })
        }
      }
    }

    const [enriched] = await enrichPosts([post], req.user.id)
    res.json(enriched)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener publicación', error: error.message })
  }
})

// Who reacted (always fresh — used by reactors modal)
router.get('/:id/reactors', authenticate, async (req, res) => {
  try {
    const { data: likes, error } = await supabaseAdmin
      .from('post_likes')
      .select('user_id, emoji')
      .eq('post_id', req.params.id)
      .then(async (result) => {
        if (result.error && String(result.error.message || '').includes('emoji')) {
          return supabaseAdmin.from('post_likes').select('user_id').eq('post_id', req.params.id)
        }
        return result
      })
    if (error) throw error

    const userMap = await getProfilesMap((likes || []).map((l) => l.user_id))
    const reactors = (likes || []).map((l) => {
      const u = userMap[l.user_id]
      return {
        userId: l.user_id,
        emoji: normalizeReactionEmoji(l.emoji) || l.emoji || '❤️',
        name: u?.name || 'Usuario',
        username: u?.username || null,
        avatar: u?.avatar || null
      }
    })
    res.json(reactors)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener reacciones', error: error.message })
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

    const imageList = Array.isArray(images) ? images : []
    const MAX_IMAGE_CHARS = 900_000
    for (const img of imageList) {
      if (typeof img === 'string' && img.length > MAX_IMAGE_CHARS) {
        return res.status(413).json({
          message:
            'Una imagen es demasiado pesada. La app la comprimirá al publicar; si el error continúa, usa otra foto.'
        })
      }
    }

    let finalPostType = postType || 'text'
    const isRoutineShare =
      postType === 'routine' || Boolean(workoutData?.isRoutine) || Boolean(workoutData?.shareKind === 'routine')
    if (workoutData && isRoutineShare) {
      finalPostType = 'routine'
    } else if (workoutData) {
      finalPostType = 'workout'
    } else if (badgeData) {
      finalPostType = 'badge'
    } else if (imageList.length > 0 && content) {
      finalPostType = 'mixed'
    } else if (imageList.length > 0) {
      finalPostType = 'image'
    } else if (poll) {
      finalPostType = 'poll'
    } else if (mood) {
      finalPostType = 'mood'
    }

    const insertPayload = {
      user_id: req.user.id,
      content: content || '',
      images: imageList,
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
    // null = explicit unlike; undefined/omit = toggle heart; string = set that reaction
    let emoji
    if (emojiRaw === null) {
      emoji = null
    } else if (emojiRaw === undefined || emojiRaw === '') {
      emoji = '❤️'
    } else {
      emoji = normalizeReactionEmoji(emojiRaw)
      if (!emoji) {
        return res.status(400).json({ message: 'Reacción no válida' })
      }
    }

    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada' })
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('post_likes')
      .select('*')
      .eq('post_id', post.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (existingErr && isMissingEmojiColumn(existingErr)) {
      // select * still works without column; ignore
    } else if (existingErr) {
      throw existingErr
    }

    let liked = false
    let myReaction = null

    if (emoji === null) {
      if (existing) {
        await supabaseAdmin
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', req.user.id)
      }
      liked = false
      myReaction = null
    } else if (existing && normalizeReactionEmoji(existing.emoji || '❤️') === emoji) {
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
      if (isMissingEmojiColumn(error)) {
        return res.status(503).json({
          message:
            'Falta la columna emoji en post_likes. Ejecuta supabase/migrations/20260806_post_likes_emoji_fix.sql en el SQL Editor.',
          code: 'MISSING_EMOJI_COLUMN'
        })
      }
      if (error) throw error
      liked = true
      myReaction = emoji
    } else {
      const { error } = await supabaseAdmin
        .from('post_likes')
        .insert({ post_id: post.id, user_id: req.user.id, emoji })
      if (isMissingEmojiColumn(error)) {
        return res.status(503).json({
          message:
            'Falta la columna emoji en post_likes. Ejecuta supabase/migrations/20260806_post_likes_emoji_fix.sql en el SQL Editor.',
          code: 'MISSING_EMOJI_COLUMN'
        })
      }
      if (error) throw error
      liked = true
      myReaction = emoji
    }

    const { count } = await supabaseAdmin
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id)

    if (liked) {
      const { data: stored, error: storedErr } = await supabaseAdmin
        .from('post_likes')
        .select('emoji')
        .eq('post_id', post.id)
        .eq('user_id', req.user.id)
        .maybeSingle()
      if (isMissingEmojiColumn(storedErr)) {
        return res.status(503).json({
          message:
            'Falta la columna emoji en post_likes. Ejecuta supabase/migrations/20260806_post_likes_emoji_fix.sql en el SQL Editor.',
          code: 'MISSING_EMOJI_COLUMN'
        })
      }
      if (stored?.emoji) myReaction = normalizeReactionEmoji(stored.emoji) || stored.emoji
    }

    const { data: likeRows, error: summaryErr } = await supabaseAdmin
      .from('post_likes')
      .select('emoji')
      .eq('post_id', post.id)

    if (isMissingEmojiColumn(summaryErr)) {
      return res.status(503).json({
        message:
          'Falta la columna emoji en post_likes. Ejecuta supabase/migrations/20260806_post_likes_emoji_fix.sql en el SQL Editor.',
        code: 'MISSING_EMOJI_COLUMN'
      })
    }

    const summaryMap = {}
    for (const row of likeRows || []) {
      const e = normalizeReactionEmoji(row.emoji) || row.emoji || '❤️'
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

// Comment on post (optional parentId = reply)
router.post('/:id/comment', authenticate, async (req, res) => {
  try {
    const { content, parentId } = req.body
    if (!content?.trim()) {
      return res.status(400).json({ message: 'El comentario no puede estar vacío' })
    }

    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada' })
    }

    let parent_id = null
    if (parentId) {
      const { data: parent } = await supabaseAdmin
        .from('post_comments')
        .select('id, post_id, parent_id')
        .eq('id', parentId)
        .maybeSingle()
      if (!parent || parent.post_id !== post.id) {
        return res.status(400).json({ message: 'Comentario padre inválido' })
      }
      // Only one nesting level: replies attach to the root comment
      parent_id = parent.parent_id || parent.id
    }

    const insertPayload = {
      post_id: post.id,
      user_id: req.user.id,
      content: content.trim()
    }
    if (parent_id) insertPayload.parent_id = parent_id

    const { error: insertError } = await supabaseAdmin.from('post_comments').insert(insertPayload)
    if (insertError) {
      // Fallback if parent_id column not migrated yet
      if (parent_id && String(insertError.message || '').includes('parent_id')) {
        const retry = await supabaseAdmin.from('post_comments').insert({
          post_id: post.id,
          user_id: req.user.id,
          content: content.trim()
        })
        if (retry.error) throw retry.error
      } else {
        throw insertError
      }
    }

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
    const mapped = await mapCommentsWithReactions(comments || [], userMap, req.user.id)
    res.json(nestComments(mapped))
  } catch (error) {
    res.status(500).json({ message: 'Error al comentar', error: error.message })
  }
})

// React to a comment (same emoji set as posts)
router.post('/comments/:commentId/like', authenticate, async (req, res) => {
  try {
    const emojiRaw = req.body?.emoji
    let emoji
    if (emojiRaw === null) {
      emoji = null
    } else if (emojiRaw === undefined || emojiRaw === '') {
      emoji = '❤️'
    } else {
      emoji = normalizeReactionEmoji(emojiRaw)
      if (!emoji) {
        return res.status(400).json({ message: 'Reacción no válida' })
      }
    }

    const { data: comment } = await supabaseAdmin
      .from('post_comments')
      .select('id')
      .eq('id', req.params.commentId)
      .maybeSingle()

    if (!comment) {
      return res.status(404).json({ message: 'Comentario no encontrado' })
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('comment_likes')
      .select('comment_id, user_id, emoji')
      .eq('comment_id', comment.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (existingErr) {
      if (/comment_likes|does not exist|42P01/i.test(existingErr.message || '')) {
        return res.status(503).json({
          message:
            'Falta la tabla comment_likes. Ejecuta supabase/migrations/APPLY_NOW_comment_likes.sql.',
          code: 'MISSING_COMMENT_LIKES'
        })
      }
      throw existingErr
    }

    let liked = false
    let myReaction = null

    if (emoji === null) {
      if (existing) {
        await supabaseAdmin
          .from('comment_likes')
          .delete()
          .eq('comment_id', comment.id)
          .eq('user_id', req.user.id)
      }
      liked = false
      myReaction = null
    } else if (existing && normalizeReactionEmoji(existing.emoji || '❤️') === emoji) {
      await supabaseAdmin
        .from('comment_likes')
        .delete()
        .eq('comment_id', comment.id)
        .eq('user_id', req.user.id)
      liked = false
      myReaction = null
    } else if (existing) {
      const { error } = await supabaseAdmin
        .from('comment_likes')
        .update({ emoji })
        .eq('comment_id', comment.id)
        .eq('user_id', req.user.id)
      if (error) throw error
      liked = true
      myReaction = emoji
    } else {
      const { error } = await supabaseAdmin.from('comment_likes').insert({
        comment_id: comment.id,
        user_id: req.user.id,
        emoji
      })
      if (error) throw error
      liked = true
      myReaction = emoji
    }

    const meta = await getCommentReactionMeta([comment.id], req.user.id)
    const m = meta[String(comment.id)] || { reactionSummary: [], likesCount: 0, myReaction: null }

    res.json({
      liked,
      likesCount: m.likesCount || 0,
      myReaction: liked ? myReaction || m.myReaction : null,
      reactionSummary: m.reactionSummary || []
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al reaccionar al comentario', error: error.message })
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

// Follow user — public profiles follow instantly; private require approval
router.post('/:id/follow', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.id
    const currentUserId = req.user.id

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: 'No puedes seguirte a ti mismo' })
    }

    const { data: targetUser } = await supabaseAdmin
      .from('profiles')
      .select('id, name, settings')
      .eq('id', targetUserId)
      .maybeSingle()

    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }

    const { data: existingFollow } = await supabaseAdmin
      .from('follows')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .maybeSingle()

    if (existingFollow) {
      return res.status(400).json({ message: 'Ya sigues a este usuario' })
    }

    const isPublic = targetUser.settings?.privacy?.profilePublic !== false

    // Public → follow instantly (no request backlog)
    if (isPublic) {
      await supabaseAdmin
        .from('follow_requests')
        .delete()
        .eq('from_user_id', currentUserId)
        .eq('to_user_id', targetUserId)

      const { error } = await supabaseAdmin.from('follows').upsert({
        follower_id: currentUserId,
        following_id: targetUserId
      })
      if (error) throw error

      await notifyUser({
        userId: targetUserId,
        type: 'new_follower',
        title: 'Nuevo seguidor',
        body: `${req.user.name} empezó a seguirte`,
        icon: '👤',
        relatedUserId: currentUserId,
        priority: 'normal'
      })

      return res.json({
        message: 'Ahora sigues a este usuario',
        status: 'following'
      })
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
