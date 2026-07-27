import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapChallenge } from '../lib/mappers.js'
import { authenticate, isAdmin } from '../middleware/auth.js'
import { awardXP } from '../services/xpService.js'

const router = express.Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function mapUserBrief(u, includeLevel = false) {
  if (!u) return null
  return {
    _id: u.id,
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    ...(includeLevel ? { stats: { level: u.stats?.level || 1 } } : {})
  }
}

async function getProfilesMap(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (!unique.length) return {}
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, avatar, stats')
    .in('id', unique)
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

function mapParticipant(row, userMap, includeLevel = false) {
  const u = userMap[row.user_id]
  return {
    user: mapUserBrief(u, includeLevel) || row.user_id,
    progress: Number(row.progress) || 0,
    completed: !!row.completed,
    completedAt: row.completed ? row.joined_at : null,
    joinedAt: row.joined_at
  }
}

async function hydrateChallenge(row, { includeLevel = false, sortParticipants = false } = {}) {
  if (!row) return null

  const { data: participants } = await supabaseAdmin
    .from('challenge_participants')
    .select('*')
    .eq('challenge_id', row.id)

  const userIds = [row.created_by, ...(participants || []).map((p) => p.user_id)]
  const userMap = await getProfilesMap(userIds)
  const creator = userMap[row.created_by]

  let mappedParticipants = (participants || []).map((p) =>
    mapParticipant(p, userMap, includeLevel)
  )
  if (sortParticipants) {
    mappedParticipants = mappedParticipants.sort((a, b) => b.progress - a.progress)
  }

  const mapped = mapChallenge(row, {
    participants: mappedParticipants
  })
  mapped.createdBy = creator
    ? { _id: creator.id, id: creator.id, name: creator.name, avatar: creator.avatar }
    : row.created_by
  mapped.featured = !!(row.reward && row.reward.featured)
  mapped.isPublic = row.reward?.isPublic !== false

  return mapped
}

async function createChallengeWithJoin({
  title,
  description,
  type,
  goal,
  unit,
  startDate,
  endDate,
  reward,
  image,
  createdBy,
  featured = false,
  isPublic = true
}) {
  const { data: challenge, error } = await supabaseAdmin
    .from('challenges')
    .insert({
      title,
      description: description || null,
      type,
      goal,
      unit: unit || null,
      start_date: startDate,
      end_date: endDate,
      reward: { ...(reward || { xp: 100 }), featured, isPublic },
      image: image || null,
      created_by: createdBy
    })
    .select('*')
    .single()

  if (error) throw error

  await supabaseAdmin.from('challenge_participants').insert({
    challenge_id: challenge.id,
    user_id: createdBy,
    progress: 0,
    completed: false
  })

  return challenge
}

// Get all active challenges
router.get('/', authenticate, async (req, res) => {
  try {
    const { active = true, featured } = req.query

    let query = supabaseAdmin.from('challenges').select('*').order('start_date', { ascending: true })

    if (active === 'true' || active === true) {
      query = query.gte('end_date', new Date().toISOString())
    }

    const { data, error } = await query
    if (error) throw error

    let rows = data || []
    if (featured === 'true') {
      rows = rows.filter((c) => c.reward?.featured)
    }

    rows.sort((a, b) => {
      const featA = a.reward?.featured ? 1 : 0
      const featB = b.reward?.featured ? 1 : 0
      if (featA !== featB) return featB - featA
      return new Date(a.start_date) - new Date(b.start_date)
    })

    const hydrated = await Promise.all(rows.map((c) => hydrateChallenge(c)))
    res.json(hydrated)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener retos', error: error.message })
  }
})

// Get user's challenges
router.get('/my', authenticate, async (req, res) => {
  try {
    const { data: parts, error: partsError } = await supabaseAdmin
      .from('challenge_participants')
      .select('challenge_id')
      .eq('user_id', req.user.id)

    if (partsError) throw partsError
    const ids = (parts || []).map((p) => p.challenge_id)
    if (!ids.length) return res.json([])

    const { data, error } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .in('id', ids)
      .order('end_date', { ascending: true })

    if (error) throw error
    const hydrated = await Promise.all((data || []).map((c) => hydrateChallenge(c)))
    res.json(hydrated)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tus retos', error: error.message })
  }
})

// Get single challenge
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Reto no encontrado' })

    res.json(await hydrateChallenge(data, { includeLevel: true, sortParticipants: true }))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener reto', error: error.message })
  }
})

// Create challenge
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, type, goal, startDate, endDate, reward, targetUsers, description, unit, image } =
      req.body

    if (!title || !type || !goal || !startDate || !endDate) {
      return res.status(400).json({ message: 'Faltan campos requeridos' })
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'La fecha de inicio debe ser anterior a la fecha de fin' })
    }

    if (targetUsers && Array.isArray(targetUsers) && targetUsers.length > 0) {
      const validUserIds = targetUsers.filter((id) => UUID_RE.test(String(id)))

      if (validUserIds.length !== targetUsers.length) {
        return res.status(400).json({ message: 'Algunos IDs de usuarios no son válidos' })
      }

      const uniqueUserIds = [...new Set(validUserIds.map((id) => String(id)))]

      const challenge = await createChallengeWithJoin({
        title,
        description,
        type,
        goal,
        unit,
        startDate,
        endDate,
        reward: reward || { xp: 100 },
        image,
        createdBy: req.user.id,
        isPublic: false
      })

      if (uniqueUserIds.length > 0) {
        process.nextTick(async () => {
          try {
            const batchSize = 10
            for (let i = 0; i < uniqueUserIds.length; i += batchSize) {
              const batch = uniqueUserIds.slice(i, i + batchSize)
              await Promise.all(
                batch.map(async (userId) => {
                  try {
                    await supabaseAdmin.from('notifications').insert({
                      user_id: userId,
                      type: 'challenge_invite',
                      title: '¡Nuevo reto disponible!',
                      body: `${req.user.name} te ha invitado a "${title}"`,
                      icon: '🎯',
                      priority: 'medium'
                    })
                  } catch (err) {
                    console.error(`Error creating notification for user ${userId}:`, err)
                  }
                })
              )
            }
          } catch (err) {
            console.error('Error sending challenge notifications:', err)
          }
        })
      }

      res.status(201).json(await hydrateChallenge(challenge))
    } else {
      const challenge = await createChallengeWithJoin({
        title,
        description,
        type,
        goal,
        unit,
        startDate,
        endDate,
        reward: reward || { xp: 100 },
        image,
        createdBy: req.user.id,
        isPublic: true
      })

      res.status(201).json(await hydrateChallenge(challenge))
    }
  } catch (error) {
    res.status(500).json({ message: 'Error al crear reto', error: error.message })
  }
})

// Join challenge
router.post('/:id/join', authenticate, async (req, res) => {
  try {
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!challenge) {
      return res.status(404).json({ message: 'Reto no encontrado' })
    }

    const { data: existing } = await supabaseAdmin
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (existing) {
      return res.status(400).json({ message: 'Ya participas en este reto' })
    }

    if (new Date() > new Date(challenge.end_date)) {
      return res.status(400).json({ message: 'Este reto ya ha terminado' })
    }

    await supabaseAdmin.from('challenge_participants').insert({
      challenge_id: challenge.id,
      user_id: req.user.id,
      progress: 0,
      completed: false
    })

    await supabaseAdmin.from('notifications').insert({
      user_id: req.user.id,
      type: 'challenge_invite',
      title: '¡Te uniste al reto!',
      body: `Ahora participas en "${challenge.title}"`,
      icon: '🎯'
    })

    res.json({
      message: 'Te has unido al reto',
      challenge: await hydrateChallenge(challenge)
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al unirse al reto', error: error.message })
  }
})

// Leave challenge
router.delete('/:id/leave', authenticate, async (req, res) => {
  try {
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!challenge) {
      return res.status(404).json({ message: 'Reto no encontrado' })
    }

    await supabaseAdmin
      .from('challenge_participants')
      .delete()
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)

    res.json({ message: 'Has abandonado el reto' })
  } catch (error) {
    res.status(500).json({ message: 'Error al abandonar reto', error: error.message })
  }
})

// Update progress
router.put('/:id/progress', authenticate, async (req, res) => {
  try {
    const { progress } = req.body

    if (progress === undefined || progress === null || progress < 0) {
      return res.status(400).json({ message: 'El progreso es requerido y debe ser un número no negativo' })
    }

    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!challenge) {
      return res.status(404).json({ message: 'Reto no encontrado' })
    }

    const { data: participant } = await supabaseAdmin
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!participant) {
      return res.status(400).json({ message: 'No participas en este reto' })
    }

    const { data: updatedParticipant, error } = await supabaseAdmin
      .from('challenge_participants')
      .update({ progress })
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)
      .select('*')
      .single()

    if (error) throw error

    const hydrated = await hydrateChallenge(challenge, { includeLevel: true })
    const { data: updatedUser } = await supabaseAdmin
      .from('profiles')
      .select('stats, badges')
      .eq('id', req.user.id)
      .single()

    const updatedPart = hydrated.participants.find(
      (p) => (p.user?.id || p.user?._id || p.user) === req.user.id
    )

    res.json({
      message: 'Progreso actualizado',
      participant: updatedPart || {
        ...mapParticipant(updatedParticipant, {}),
        user: req.user.id
      },
      challenge: {
        _id: challenge.id,
        id: challenge.id,
        title: challenge.title,
        goal: challenge.goal,
        participants: hydrated.participants
      },
      canComplete: progress >= Number(challenge.goal) && !participant.completed,
      userStats: {
        xp: updatedUser?.stats?.xp || 0,
        level: updatedUser?.stats?.level || 1
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar progreso', error: error.message })
  }
})

// Complete challenge and get XP
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!challenge) {
      return res.status(404).json({ message: 'Reto no encontrado' })
    }

    const { data: participant } = await supabaseAdmin
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!participant) {
      return res.status(400).json({ message: 'No participas en este reto' })
    }

    if (participant.completed) {
      return res.status(400).json({ message: 'Ya completaste este reto' })
    }

    if (Number(participant.progress) < Number(challenge.goal)) {
      return res.status(400).json({ message: 'No has alcanzado el objetivo del reto' })
    }

    const completedAt = new Date().toISOString()
    await supabaseAdmin
      .from('challenge_participants')
      .update({ completed: true })
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)

    const { data: user } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single()

    const oldLevel = user.stats?.level || 1
    const stats = { ...(user.stats || {}) }
    stats.challengesCompleted = (stats.challengesCompleted || 0) + 1
    await supabaseAdmin
      .from('profiles')
      .update({ stats, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)

    let xpResult = null
    let unlockedBadges = []
    try {
      xpResult = await awardXP(
        req.user.id,
        challenge.reward?.xp || 100,
        `Completaste el reto: ${challenge.title}`,
        false
      )
      const { checkBadgeUnlocks } = await import('../services/xpService.js')
      unlockedBadges = await checkBadgeUnlocks(req.user.id, false)
    } catch (xpError) {
      console.error('Error awarding XP:', xpError)
    }

    const { getBadgeDefinitions } = await import('../services/xpService.js')
    const badgeDefinitions = getBadgeDefinitions()
    const { data: refreshed } = await supabaseAdmin
      .from('profiles')
      .select('stats, badges')
      .eq('id', req.user.id)
      .single()

    const userBadgeIds = (refreshed?.badges || user.badges || []).map((b) => b.id || b._id)
    const nextBadge = badgeDefinitions
      .filter((b) => !userBadgeIds.includes(b.id) && b.type === 'xp')
      .sort((a, b) => a.xpRequired - b.xpRequired)[0]

    let challengeBadge = null
    if (challenge.reward?.badge) {
      const hasBadge = (refreshed?.badges || []).some(
        (b) => (b.id || b._id) === challenge.reward.badge.id
      )
      if (!hasBadge) {
        challengeBadge = {
          id: challenge.reward.badge.id,
          name: challenge.reward.badge.name,
          icon: challenge.reward.badge.icon
        }
        const badges = [
          ...(refreshed?.badges || []),
          { ...challengeBadge, earnedAt: new Date().toISOString() }
        ]
        await supabaseAdmin
          .from('profiles')
          .update({ badges, updated_at: new Date().toISOString() })
          .eq('id', req.user.id)
      }
    }

    const { data: updatedUser } = await supabaseAdmin
      .from('profiles')
      .select('stats, badges')
      .eq('id', req.user.id)
      .single()

    const motivationalMessages = [
      '¡Increíble! Sigues superando tus límites 💪',
      '¡Eres una máquina! Sigue así 🚀',
      '¡Excelente trabajo! Tu dedicación es admirable ⭐',
      '¡Felicidades! Cada reto te acerca más a tus metas 🎯',
      '¡Impresionante! Tu constancia es inspiradora 🔥'
    ]
    const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)]

    process.nextTick(async () => {
      try {
        await supabaseAdmin.from('notifications').insert({
          user_id: req.user.id,
          type: 'challenge_complete',
          title: '🏆 ¡Reto completado!',
          body: `${randomMessage} Completaste "${challenge.title}" y ganaste ${challenge.reward?.xp || 100} XP`,
          icon: '🏆',
          priority: 'high',
          related_data: {
            challengeId: challenge.id,
            challengeTitle: challenge.title,
            xpAwarded: challenge.reward?.xp || 100,
            unlockedBadges: unlockedBadges.map((b) => ({ id: b.id, name: b.name, icon: b.icon })),
            challengeBadge,
            nextBadge: nextBadge
              ? {
                  id: nextBadge.id,
                  name: nextBadge.name,
                  icon: nextBadge.icon,
                  xpRequired: nextBadge.xpRequired,
                  currentXP: updatedUser?.stats?.xp || 0,
                  xpNeeded: nextBadge.xpRequired - (updatedUser?.stats?.xp || 0)
                }
              : null
          }
        })
      } catch (err) {
        console.error('Error creating completion notification:', err)
      }
    })

    res.json({
      message: 'Reto completado exitosamente',
      xpAwarded: challenge.reward?.xp || 100,
      participant: {
        user: req.user.id,
        progress: Number(participant.progress) || 0,
        completed: true,
        completedAt
      },
      motivationalMessage: randomMessage,
      unlockedBadges: unlockedBadges.map((b) => ({ id: b.id, name: b.name, icon: b.icon })),
      challengeBadge,
      nextBadge: nextBadge
        ? {
            id: nextBadge.id,
            name: nextBadge.name,
            icon: nextBadge.icon,
            xpRequired: nextBadge.xpRequired,
            currentXP: updatedUser?.stats?.xp || 0,
            xpNeeded: nextBadge.xpRequired - (updatedUser?.stats?.xp || 0)
          }
        : null,
      leveledUp: xpResult?.leveledUp || false,
      newLevel: xpResult?.level || updatedUser?.stats?.level || oldLevel,
      userStats: {
        xp: updatedUser?.stats?.xp || 0,
        level: updatedUser?.stats?.level || 1
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al completar reto', error: error.message })
  }
})

// Get leaderboard
router.get('/:id/leaderboard', authenticate, async (req, res) => {
  try {
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!challenge) {
      return res.status(404).json({ message: 'Reto no encontrado' })
    }

    const hydrated = await hydrateChallenge(challenge, {
      includeLevel: true,
      sortParticipants: true
    })

    const leaderboard = hydrated.participants.map((p, index) => ({
      rank: index + 1,
      user: p.user,
      progress: p.progress,
      completed: p.completed,
      completedAt: p.completedAt,
      percentage: Math.min(100, (p.progress / Number(challenge.goal)) * 100)
    }))

    res.json(leaderboard)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener ranking', error: error.message })
  }
})

// Admin: Delete challenge
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await supabaseAdmin.from('challenge_participants').delete().eq('challenge_id', req.params.id)
    await supabaseAdmin.from('challenges').delete().eq('id', req.params.id)
    res.json({ message: 'Reto eliminado' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar reto', error: error.message })
  }
})

export default router
