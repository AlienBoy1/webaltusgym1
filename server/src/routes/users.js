import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapProfile, mapWorkout, attachSocial } from '../lib/mappers.js'
import { authenticate, isAdmin, invalidateAuthProfileCache } from '../middleware/auth.js'
import { normalizeUsername, validateUsernameFormat } from '../utils/username.js'
import {
  mapMembershipPlanRow,
  syncMembershipPlansLifecycle
} from '../services/membershipService.js'
import { isPaidEraLive } from '../utils/membershipLifecycle.js'
import { checkBadgeUnlocks } from '../services/xpService.js'
import { ensureQiSiSystem } from '../services/qisiService.js'
import { QISI_USERNAME } from '../utils/qisi.js'
import {
  persistMedia,
  slimMediaForList,
  migrateProfileMediaRow,
  scheduleProfileMediaMigrate,
  isInlineDataUrl
} from '../utils/mediaStorage.js'

const router = express.Router()

async function loadQiSiRailPerson({ source = 'system', hasStory = false, hasUnseen = false } = {}) {
  try {
    const qisi = await ensureQiSiSystem()
    if (!qisi?.id) return null
    return {
      _id: qisi.id,
      id: qisi.id,
      name: qisi.name,
      username: qisi.username || QISI_USERNAME,
      avatar: qisi.avatar,
      lastSeenAt: new Date().toISOString(),
      source,
      isQiSi: true,
      hasStory,
      hasUnseen
    }
  } catch {
    return null
  }
}

function pinQiSiFirst(people, qisiPerson) {
  if (!qisiPerson) return people
  const rest = (people || []).filter((p) => String(p.id || p._id) !== String(qisiPerson.id))
  return [qisiPerson, ...rest]
}

async function assertUsernameAvailable(username, excludeUserId = null) {
  const check = validateUsernameFormat(username)
  if (!check.ok) {
    const err = new Error(check.message)
    err.status = 400
    err.code = 'USERNAME_INVALID'
    throw err
  }
  let query = supabaseAdmin.from('profiles').select('id').eq('username', check.username)
  if (excludeUserId) query = query.neq('id', excludeUserId)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (data) {
    const err = new Error('Este username ya está en uso')
    err.status = 409
    err.code = 'USERNAME_TAKEN'
    throw err
  }
  return check.username
}

router.get('/stats', authenticate, async (req, res) => {
  try {
    const { count } = await supabaseAdmin
      .from('workouts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)

    const stats = req.user.stats || {}
    res.json({
      totalWorkouts: count || stats.totalWorkouts || 0,
      currentStreak: stats.currentStreak || 0,
      longestStreak: stats.longestStreak || 0,
      level: stats.level || 1,
      xp: stats.xp || 0
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message })
  }
})

/** Persist last disconnection (Messenger-style last seen). */
router.post('/me/last-seen', authenticate, async (req, res) => {
  try {
    const iso = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ last_seen_at: iso, updated_at: iso })
      .eq('id', req.user.id)
    if (error) throw error
    res.json({ ok: true, lastSeenAt: iso })
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar última conexión', error: error.message })
  }
})

/**
 * Dashboard presence rail: people I follow first, then suggestions.
 * Includes lastSeenAt for offline labels.
 */
router.get('/presence-rail', authenticate, async (req, res) => {
  try {
    const me = req.user.id
    const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 40)

    const { data: followingRows } = await supabaseAdmin
      .from('follows')
      .select('following_id')
      .eq('follower_id', me)
      .limit(80)

    const followingIds = (followingRows || []).map((r) => r.following_id).filter(Boolean)
    const followingSet = new Set(followingIds)

    let following = []
    if (followingIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, name, username, last_seen_at, last_login')
        .in('id', followingIds)
      following = (profiles || []).map((p) => ({
        _id: p.id,
        id: p.id,
        name: p.name,
        username: p.username || null,
        avatar: null,
        lastSeenAt: p.last_seen_at || p.last_login || null,
        source: 'following'
      }))
      following.sort((a, b) => {
        const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0
        const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0
        return bt - at
      })
    }

    // Suggestions: active members not yet followed (and not self)
    let suggestions = []
    const { data: pool } = await supabaseAdmin
      .from('profiles')
      .select('id, name, username, last_seen_at, last_login, membership')
      .neq('id', me)
      .limit(80)

    suggestions = (pool || [])
      .filter((p) => !followingSet.has(p.id))
      .filter((p) => {
        const status = p.membership?.status
        return !status || status === 'active' || status === 'expiring'
      })
      .map((p) => ({
        _id: p.id,
        id: p.id,
        name: p.name,
        username: p.username || null,
        avatar: null,
        lastSeenAt: p.last_seen_at || p.last_login || null,
        source: 'suggestion'
      }))
      .sort((a, b) => {
        const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0
        const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0
        return bt - at
      })
      .slice(0, 20)

    const people = [...following, ...suggestions].slice(0, limit)
    const qisiPerson = await loadQiSiRailPerson({ source: 'system' })
    res.json({ people: pinQiSiFirst(people, qisiPerson).slice(0, limit) })
  } catch (error) {
    console.error('presence-rail error:', error)
    res.status(500).json({ message: 'Error al cargar personas', error: error.message })
  }
})

/**
 * Community rail: all public profiles + private ones the viewer follows.
 * Includes lastSeenAt and active-story flags (for StoriesRail priority).
 */
router.get('/community-rail', authenticate, async (req, res) => {
  try {
    const me = req.user.id
    const limit = Math.min(Math.max(Number(req.query.limit) || 48, 1), 80)

    const { data: followingRows } = await supabaseAdmin
      .from('follows')
      .select('following_id')
      .eq('follower_id', me)
      .limit(80)

    const followingIds = (followingRows || []).map((r) => r.following_id).filter(Boolean)
    const followingSet = new Set(followingIds)

    const now = new Date().toISOString()
    const { data: activeStories } = await supabaseAdmin
      .from('stories')
      .select('id, user_id')
      .gt('expires_at', now)
      .neq('user_id', me)
      .limit(200)

    const storyIdsByUser = new Map()
    for (const row of activeStories || []) {
      if (!row?.user_id) continue
      if (!storyIdsByUser.has(row.user_id)) storyIdsByUser.set(row.user_id, [])
      storyIdsByUser.get(row.user_id).push(row.id)
    }
    const storyAuthorIds = [...storyIdsByUser.keys()]

    const seedIds = [...new Set([...followingIds, ...storyAuthorIds])]

    let { data: pool } = await supabaseAdmin
      .from('profiles')
      .select('id, name, username, last_seen_at, last_login, membership, settings')
      .neq('id', me)
      .order('last_seen_at', { ascending: false })
      .limit(120)

    if (seedIds.length) {
      const missing = seedIds.filter((id) => !(pool || []).some((p) => p.id === id))
      if (missing.length) {
        const { data: extras } = await supabaseAdmin
          .from('profiles')
          .select('id, name, username, last_seen_at, last_login, membership, settings')
          .in('id', missing)
        pool = [...(pool || []), ...(extras || [])]
      }
    }

    // Unseen = any active story of theirs without a view from me
    const allStoryIds = (activeStories || []).map((s) => s.id)
    const viewedSet = new Set()
    if (allStoryIds.length) {
      const { data: views } = await supabaseAdmin
        .from('story_views')
        .select('story_id')
        .eq('user_id', me)
        .in('story_id', allStoryIds)
      for (const v of views || []) viewedSet.add(v.story_id)
    }

    const isActiveMember = (membership) => {
      const status = membership?.status
      return !status || status === 'active' || status === 'expiring'
    }

    const isVisible = (profile) => {
      if (followingSet.has(profile.id)) return true
      return profile.settings?.privacy?.profilePublic !== false
    }

    const people = (pool || [])
      .filter((p) => isActiveMember(p.membership) && isVisible(p))
      .map((p) => {
        const storyIds = storyIdsByUser.get(p.id) || []
        const hasStory = storyIds.length > 0
        const hasUnseen = hasStory && storyIds.some((id) => !viewedSet.has(id))
        return {
          _id: p.id,
          id: p.id,
          name: p.name,
          username: p.username || null,
          avatar: null,
          lastSeenAt: p.last_seen_at || p.last_login || null,
          hasStory,
          hasUnseen,
          source: followingSet.has(p.id) ? 'following' : 'community'
        }
      })
      .sort((a, b) => {
        if (a.hasStory !== b.hasStory) return a.hasStory ? -1 : 1
        if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1
        const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0
        const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0
        return bt - at
      })
      .slice(0, limit)

    res.setHeader('Cache-Control', 'private, max-age=20')
    let qisiPerson = null
    try {
      const qisi = await ensureQiSiSystem()
      if (qisi?.id) {
        const storyIds = storyIdsByUser.get(qisi.id) || []
        const hasStory = storyIds.length > 0
        const hasUnseen = hasStory && storyIds.some((id) => !viewedSet.has(id))
        qisiPerson = {
          _id: qisi.id,
          id: qisi.id,
          name: qisi.name,
          username: qisi.username || QISI_USERNAME,
          avatar: qisi.avatar,
          lastSeenAt: new Date().toISOString(),
          hasStory,
          hasUnseen,
          source: 'system',
          isQiSi: true
        }
      }
    } catch {
      /* ignore */
    }
    res.json({ people: pinQiSiFirst(people, qisiPerson).slice(0, limit) })
  } catch (error) {
    console.error('community-rail error:', error)
    res.status(500).json({ message: 'Error al cargar la comunidad', error: error.message })
  }
})

router.get('/profile', authenticate, async (req, res) => {
  try {
    const { data: raw } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, name, username, email, phone, role, avatar, goal, membership, stats, badges, settings, profile, onboarding_completed, must_reset_password, last_login, created_at, updated_at'
      )
      .eq('id', req.user.id)
      .single()
    const profile = raw ? await migrateProfileMediaRow(raw) : raw
    res.json({ ...mapProfile(profile), settings: profile?.settings || {} })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener perfil', error: error.message })
  }
})

/** Avatar + cover only — used after slim /auth/me so the shell can show real photos. */
router.get('/profile-media', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, avatar, profile')
      .eq('id', req.user.id)
      .single()
    if (error) throw error
    const row = await migrateProfileMediaRow(data || {})
    res.setHeader('Cache-Control', 'private, max-age=30')
    res.json({
      avatar: slimMediaForList(row?.avatar),
      coverUrl: slimMediaForList(row?.profile?.coverUrl)
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener media del perfil', error: error.message })
  }
})

/** Batch avatars/names — avoids N× GET /users/:id (which also loads the social graph). */
router.get('/avatars', authenticate, async (req, res) => {
  try {
    const raw = String(req.query.ids || '')
    const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 40)
    if (!ids.length) return res.json({ users: [] })

    let rows = []
    const rpc = await supabaseAdmin.rpc('list_profile_avatars', { ids })
    if (!rpc.error) {
      rows = rpc.data || []
      const pending = rows.filter((p) => p.pending_storage).map((p) => ({ id: p.id }))
      if (pending.length) scheduleProfileMediaMigrate(pending)
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, name, username, avatar')
        .in('id', ids)
      if (error) throw error
      rows = (data || []).map((p) => {
        const pending = isInlineDataUrl(p.avatar)
        if (pending) scheduleProfileMediaMigrate(p)
        return {
          id: p.id,
          name: p.name,
          username: p.username,
          avatar: pending ? null : slimMediaForList(p.avatar),
          pending_storage: pending
        }
      })
    }

    res.setHeader('Cache-Control', 'private, max-age=30')
    res.json({
      users: (rows || []).map((p) => ({
        id: p.id,
        _id: p.id,
        name: p.name,
        username: p.username || null,
        avatar: p.avatar || null
      }))
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener avatares', error: error.message })
  }
})

router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, avatar, phone, settings, goal, profile, username } = req.body
    const updateData = { updated_at: new Date().toISOString() }
    if (name) updateData.name = name
    if (avatar !== undefined) {
      try {
        updateData.avatar = await persistMedia(avatar, {
          folder: 'avatars',
          userId: req.user.id,
          id: 'avatar'
        })
      } catch (persistErr) {
        if (persistErr?.status === 413) {
          return res.status(413).json({ message: persistErr.message })
        }
        throw persistErr
      }
    }
    if (phone !== undefined) updateData.phone = phone
    if (goal !== undefined) updateData.goal = goal

    const { data: current } = await supabaseAdmin
      .from('profiles')
      .select('settings, profile')
      .eq('id', req.user.id)
      .single()

    if (settings !== undefined) {
      updateData.settings = { ...(current?.settings || {}), ...settings }
    }
    if (profile !== undefined) {
      updateData.profile = { ...(current?.profile || {}), ...profile }
      if (updateData.profile.coverUrl === null || updateData.profile.coverUrl === '') {
        delete updateData.profile.coverUrl
      } else if (isInlineDataUrl(updateData.profile.coverUrl)) {
        try {
          updateData.profile.coverUrl = await persistMedia(updateData.profile.coverUrl, {
            folder: 'covers',
            userId: req.user.id,
            id: 'cover'
          })
        } catch (persistErr) {
          if (persistErr?.status === 413) {
            return res.status(413).json({ message: persistErr.message })
          }
          throw persistErr
        }
      }
    }

    if (username !== undefined) {
      try {
        updateData.username = await assertUsernameAvailable(username, req.user.id)
      } catch (err) {
        return res.status(err.status || 400).json({ message: err.message, code: err.code })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', req.user.id)
      .select(
        'id, name, username, email, phone, role, avatar, goal, membership, stats, badges, settings, onboarding_completed, must_reset_password, last_login, created_at, updated_at'
      )
      .single()

    if (error) {
      if (String(error.message || '').toLowerCase().includes('duplicate')) {
        return res.status(409).json({ message: 'Este username ya está en uso', code: 'USERNAME_TAKEN' })
      }
      throw error
    }
    invalidateAuthProfileCache(req.user.id)

    // Tutorial completion flags → badge unlocks (+ XP)
    let unlockedBadges = []
    if (settings !== undefined) {
      try {
        const unlocked = await checkBadgeUnlocks(req.user.id, false)
        unlockedBadges = (unlocked || []).map((b) => ({
          id: b.id,
          name: b.name,
          icon: b.icon,
          xpReward: Number(b.xpReward) || 0,
          type: b.type || null
        }))
        const { data: refreshed } = await supabaseAdmin
          .from('profiles')
          .select('stats, badges, settings')
          .eq('id', req.user.id)
          .single()
        if (refreshed) {
          data.stats = refreshed.stats
          data.badges = refreshed.badges
          data.settings = refreshed.settings
        }
      } catch (badgeErr) {
        console.warn('badge check after profile update:', badgeErr?.message || badgeErr)
      }
    }

    const out = { ...data }
    const storedCover = updateData.profile?.coverUrl
    out.profile = {
      ...(updateData.profile || current?.profile || {}),
      coverUrl: slimMediaForList(storedCover)
    }
    out.avatar = slimMediaForList(out.avatar)
    res.json({
      message: 'Perfil actualizado',
      user: mapProfile(out),
      unlockedBadges
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar perfil', error: error.message })
  }
})

router.post('/complete-onboarding', authenticate, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
    if (error) throw error
    res.json({ message: 'Onboarding completado', onboardingCompleted: true })
  } catch (error) {
    res.status(500).json({ message: 'Error al completar onboarding', error: error.message })
  }
})

/** Check username availability (public to authenticated users) */
router.get('/username/check', authenticate, async (req, res) => {
  try {
    const raw = req.query.u || req.query.username || ''
    const format = validateUsernameFormat(raw)
    if (!format.ok) {
      return res.json({ available: false, username: format.username, message: format.message })
    }
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', format.username)
      .neq('id', req.user.id)
      .maybeSingle()
    if (data) {
      return res.json({
        available: false,
        username: format.username,
        message: 'Este username ya está en uso'
      })
    }
    res.json({ available: true, username: format.username, message: 'Username disponible' })
  } catch (error) {
    res.status(500).json({ message: 'Error al validar username', error: error.message })
  }
})

/** Claim / set username once for existing users */
router.post('/username', authenticate, async (req, res) => {
  try {
    if (req.user.username) {
      return res.status(400).json({
        message: 'Ya tienes un username registrado',
        code: 'USERNAME_EXISTS',
        username: req.user.username
      })
    }
    let username
    try {
      username = await assertUsernameAvailable(req.body.username, req.user.id)
    } catch (err) {
      return res.status(err.status || 400).json({ message: err.message, code: err.code })
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ username, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select('*')
      .single()

    if (error) {
      if (String(error.message || '').toLowerCase().includes('duplicate')) {
        return res.status(409).json({ message: 'Este username ya está en uso', code: 'USERNAME_TAKEN' })
      }
      throw error
    }
    res.json({ message: 'Username registrado', user: mapProfile(data) })
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar username', error: error.message })
  }
})

router.put('/:id/role', authenticate, isAdmin, async (req, res) => {
  try {
    const { role } = req.body
    if (!['user', 'admin', 'trainer'].includes(role)) {
      return res.status(400).json({ message: 'Rol inválido' })
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error || !data) return res.status(404).json({ message: 'Usuario no encontrado' })

    await supabaseAdmin.auth.admin.updateUserById(req.params.id, {
      app_metadata: { role }
    })

    res.json({ message: 'Rol actualizado', user: mapProfile(data) })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar rol', error: error.message })
  }
})

router.put('/:id/membership', authenticate, isAdmin, async (req, res) => {
  try {
    const { plan, status, endDate } = req.body
    const { data: current } = await supabaseAdmin
      .from('profiles')
      .select('membership')
      .eq('id', req.params.id)
      .single()

    if (!current) return res.status(404).json({ message: 'Usuario no encontrado' })

    const membership = {
      ...(current.membership || {}),
      ...(plan !== undefined ? { plan } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(endDate !== undefined ? { endDate } : {})
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ membership, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error) throw error
    res.json({ message: 'Membresía actualizada', user: mapProfile(data) })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar membresía', error: error.message })
  }
})

router.get('/memberships', authenticate, async (req, res) => {
  try {
    await syncMembershipPlansLifecycle()

    const { data, error } = await supabaseAdmin
      .from('membership_plans')
      .select(
        'id, plan, name, description, price, duration, duration_unit, benefits, features, active, created_at'
      )
      .order('price', { ascending: true })
    if (error) throw error

    const paidLive = isPaidEraLive()
    const list = (data || []).map(mapMembershipPlanRow)

    // Users see:
    // - legacy plans while free era is live
    // - scheduled paid plans as "coming soon" before Jan 1 2027
    // - only public paid plans after cutover
    const visible = list.filter((p) => {
      if (paidLive) return p.era === 'paid' || (p.active && !p.isLegacyFree)
      return p.era === 'legacy' || p.phase === 'scheduled' || p.era === 'scheduled_paid'
    })

    res.json(
      visible.map((p) => ({
        _id: p.id,
        id: p.id,
        plan: p.plan,
        name: p.name,
        description: p.description,
        price: p.price,
        duration: p.duration,
        durationUnit: p.durationUnit,
        benefits: p.benefits,
        features: p.features,
        active: p.active,
        era: p.era,
        phase: p.phase,
        lifecycleLabel: p.lifecycleLabel,
        publicFrom: p.publicFrom,
        retiresAt: p.retiresAt,
        isLegacyFree: p.isLegacyFree,
        comingSoon: p.phase === 'scheduled'
      }))
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener membresías', error: error.message })
  }
})

router.get('/badges/definitions', authenticate, async (req, res) => {
  try {
    const { getBadgeDefinitions } = await import('../services/xpService.js')
    res.json(getBadgeDefinitions())
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener definiciones de insignias', error: error.message })
  }
})

/** Re-evaluate unlocks (e.g. tutorial badges for users who already completed guides). */
router.post('/badges/sync', authenticate, async (req, res) => {
  try {
    const unlocked = await checkBadgeUnlocks(req.user.id, false)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, name, username, email, phone, role, avatar, goal, membership, stats, badges, settings, onboarding_completed, must_reset_password, last_login, created_at, updated_at'
      )
      .eq('id', req.user.id)
      .single()
    if (error) throw error
    invalidateAuthProfileCache(req.user.id)
    res.json({
      unlocked: (unlocked || []).map((b) => ({ id: b.id, name: b.name, icon: b.icon, xpReward: b.xpReward || 0 })),
      user: mapProfile(data)
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al sincronizar insignias', error: error.message })
  }
})

router.get('/search', authenticate, async (req, res) => {
  try {
    const { q, filter } = req.query
    let query = supabaseAdmin
      .from('profiles')
      .select('id, name, username, email, stats, membership, role')
      .neq('id', req.user.id)
      .limit(50)

    if (q?.trim()) {
      const term = q.trim().replace(/^@+/, '')
      const safe = term.replace(/[%_,]/g, '')
      query = query
        .or(`name.ilike.%${safe}%,username.ilike.%${safe}%,email.ilike.%${safe}%`)
        .limit(20)
    }

    if (filter === 'following') {
      const { data: following } = await supabaseAdmin
        .from('follows')
        .select('following_id')
        .eq('follower_id', req.user.id)
        .limit(200)
      const ids = (following || []).map((f) => f.following_id)
      if (!ids.length) return res.json([])
      query = query.in('id', ids)
    } else if (filter === 'mentions') {
      // Only mutual follows may be @mentioned
      const [{ data: followingRowsM }, { data: followerRowsM }] = await Promise.all([
        supabaseAdmin
          .from('follows')
          .select('following_id')
          .eq('follower_id', req.user.id)
          .limit(200),
        supabaseAdmin
          .from('follows')
          .select('follower_id')
          .eq('following_id', req.user.id)
          .limit(200)
      ])
      const followingSetM = new Set((followingRowsM || []).map((f) => f.following_id))
      const mutualIds = (followerRowsM || [])
        .map((f) => f.follower_id)
        .filter((id) => followingSetM.has(id))
      if (!mutualIds.length) return res.json([])
      query = query.in('id', mutualIds).not('username', 'is', null)
    } else if (filter === 'not_following') {
      const { data: following } = await supabaseAdmin
        .from('follows')
        .select('following_id')
        .eq('follower_id', req.user.id)
        .limit(200)
      const ids = (following || []).map((f) => f.following_id)
      if (ids.length) query = query.not('id', 'in', `(${ids.join(',')})`)
    } else if (filter === 'with_conversation') {
      const { data: msgs } = await supabaseAdmin
        .from('messages')
        .select('from_user_id, to_user_id')
        .or(`from_user_id.eq.${req.user.id},to_user_id.eq.${req.user.id}`)
        .order('created_at', { ascending: false })
        .limit(200)
      const ids = [
        ...new Set(
          (msgs || []).map((m) =>
            m.from_user_id === req.user.id ? m.to_user_id : m.from_user_id
          )
        )
      ]
      if (!ids.length) return res.json([])
      query = query.in('id', ids)
    }

    const { data, error } = await query
    if (error) throw error

    const [{ data: followingRows }, { data: pendingRows }] = await Promise.all([
      supabaseAdmin
        .from('follows')
        .select('following_id')
        .eq('follower_id', req.user.id)
        .limit(200),
      supabaseAdmin
        .from('follow_requests')
        .select('to_user_id')
        .eq('from_user_id', req.user.id)
        .limit(200)
    ])
    const followingSet = new Set((followingRows || []).map((f) => f.following_id))
    const pendingSet = new Set((pendingRows || []).map((r) => r.to_user_id))

    let users = (data || []).map((u) => ({
      _id: u.id,
      id: u.id,
      name: u.name,
      username: u.username || null,
      avatar: null,
      stats: u.stats || null,
      membership: u.membership || null,
      role: u.role || 'user',
      isFollowing: followingSet.has(u.id),
      hasPendingRequest: pendingSet.has(u.id)
    }))

    // Mentions: prioritize username prefix matches (already mutual-only)
    if (filter === 'mentions') {
      const term = normalizeUsername(q || '')
      users = users
        .filter((u) => u.username)
        .sort((a, b) => {
          const aStarts = a.username.startsWith(term) ? 0 : 1
          const bStarts = b.username.startsWith(term) ? 0 : 1
          if (aStarts !== bStarts) return aStarts - bStarts
          return a.username.localeCompare(b.username)
        })
        .slice(0, 8)
    }

    // Suggestions: prioritize people you don't follow yet, then people you already follow
    if (filter === 'suggestions') {
      users = users
        .sort((a, b) => Number(a.isFollowing) - Number(b.isFollowing))
        .slice(0, 16)
    }

    res.json(users)
  } catch (error) {
    console.error('Error searching users:', error)
    res.status(500).json({ message: 'Error al buscar usuarios', error: error.message })
  }
})

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: 'ID de usuario inválido' })
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const PROFILE_PUBLIC_COLUMNS =
      'id, name, username, email, phone, role, avatar, goal, membership, stats, badges, settings, profile, onboarding_completed, must_reset_password, last_login, last_seen_at, created_at, updated_at'
    let query = supabaseAdmin.from('profiles').select(PROFILE_PUBLIC_COLUMNS)
    if (isUuid) {
      query = query.eq('id', id)
    } else {
      const handle = String(id).replace(/^@+/, '').toLowerCase()
      query = query.eq('username', handle)
    }

    const { data: found, error } = await query.maybeSingle()

    if (error || !found) return res.status(404).json({ message: 'Usuario no encontrado' })
    const profile = await migrateProfileMediaRow(found)

    // Hide badges from visitors when profile is private and they don't follow
    if (profile.id !== req.user.id) {
      const isPublic = profile.settings?.privacy?.profilePublic !== false
      if (!isPublic) {
        const { data: follow } = await supabaseAdmin
          .from('follows')
          .select('id')
          .eq('follower_id', req.user.id)
          .eq('following_id', profile.id)
          .maybeSingle()
        if (!follow) {
          profile.badges = []
        }
      }
    }

    const lite = ['1', 'true', 'yes'].includes(String(req.query.lite || '').toLowerCase())
    const withSocial = lite ? profile : await attachSocial(supabaseAdmin, profile)
    res.json(mapProfile(withSocial))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuario', error: error.message })
  }
})

export default router
