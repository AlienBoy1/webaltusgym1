import { supabaseAdmin } from '../lib/supabase.js'

const BADGE_DEFINITIONS = [
  { id: 'first_workout', name: 'Primer Entrenamiento', icon: '🎯', xpRequired: 0, type: 'workout', threshold: 1, difficulty: 'easy' },
  { id: 'workout_5', name: '5 Entrenamientos', icon: '💪', xpRequired: 0, type: 'workout', threshold: 5, difficulty: 'easy' },
  { id: 'workout_10', name: '10 Entrenamientos', icon: '💪', xpRequired: 0, type: 'workout', threshold: 10, difficulty: 'easy' },
  { id: 'workout_25', name: '25 Entrenamientos', icon: '🔥', xpRequired: 0, type: 'workout', threshold: 25, difficulty: 'normal' },
  { id: 'workout_50', name: '50 Entrenamientos', icon: '🔥', xpRequired: 0, type: 'workout', threshold: 50, difficulty: 'normal' },
  { id: 'workout_100', name: '100 Entrenamientos', icon: '🏆', xpRequired: 0, type: 'workout', threshold: 100, difficulty: 'epic' },
  { id: 'workout_250', name: '250 Entrenamientos', icon: '⚡', xpRequired: 0, type: 'workout', threshold: 250, difficulty: 'legendary' },
  { id: 'workout_500', name: '500 Entrenamientos', icon: '👑', xpRequired: 0, type: 'workout', threshold: 500, difficulty: 'legendary' },
  { id: 'workout_1000', name: '1000 Entrenamientos', icon: '🌟', xpRequired: 0, type: 'workout', threshold: 1000, difficulty: 'training_legend' },
  { id: 'streak_3', name: 'Racha de 3 Días', icon: '⚡', xpRequired: 0, type: 'streak', threshold: 3, difficulty: 'easy' },
  { id: 'streak_7', name: 'Racha de 7 Días', icon: '⚡', xpRequired: 0, type: 'streak', threshold: 7, difficulty: 'easy' },
  { id: 'streak_14', name: 'Racha de 14 Días', icon: '🌟', xpRequired: 0, type: 'streak', threshold: 14, difficulty: 'normal' },
  { id: 'streak_30', name: 'Racha de 30 Días', icon: '🌟', xpRequired: 0, type: 'streak', threshold: 30, difficulty: 'normal' },
  { id: 'streak_60', name: 'Racha de 60 Días', icon: '🔥', xpRequired: 0, type: 'streak', threshold: 60, difficulty: 'epic' },
  { id: 'streak_90', name: 'Racha de 90 Días', icon: '🏆', xpRequired: 0, type: 'streak', threshold: 90, difficulty: 'epic' },
  { id: 'streak_180', name: 'Racha de 180 Días', icon: '👑', xpRequired: 0, type: 'streak', threshold: 180, difficulty: 'legendary' },
  { id: 'streak_365', name: 'Racha de 365 Días', icon: '🌟', xpRequired: 0, type: 'streak', threshold: 365, difficulty: 'training_legend' },
  { id: 'xp_50', name: '50 XP', icon: '⭐', xpRequired: 50, type: 'xp', threshold: 50, difficulty: 'easy' },
  { id: 'xp_100', name: '100 XP', icon: '⭐', xpRequired: 100, type: 'xp', threshold: 100, difficulty: 'easy' },
  { id: 'xp_250', name: '250 XP', icon: '💎', xpRequired: 250, type: 'xp', threshold: 250, difficulty: 'easy' },
  { id: 'xp_500', name: '500 XP', icon: '💎', xpRequired: 500, type: 'xp', threshold: 500, difficulty: 'normal' },
  { id: 'xp_1000', name: '1000 XP', icon: '👑', xpRequired: 1000, type: 'xp', threshold: 1000, difficulty: 'normal' },
  { id: 'xp_2500', name: '2500 XP', icon: '🔥', xpRequired: 2500, type: 'xp', threshold: 2500, difficulty: 'epic' },
  { id: 'xp_5000', name: '5000 XP', icon: '🚀', xpRequired: 5000, type: 'xp', threshold: 5000, difficulty: 'epic' },
  { id: 'xp_10000', name: '10000 XP', icon: '🌟', xpRequired: 10000, type: 'xp', threshold: 10000, difficulty: 'legendary' },
  { id: 'xp_25000', name: '25000 XP', icon: '👑', xpRequired: 25000, type: 'xp', threshold: 25000, difficulty: 'legendary' },
  { id: 'xp_50000', name: '50000 XP', icon: '💫', xpRequired: 50000, type: 'xp', threshold: 50000, difficulty: 'training_legend' },
  { id: 'level_2', name: 'Nivel 2', icon: '🎖️', xpRequired: 0, type: 'level', threshold: 2, difficulty: 'easy' },
  { id: 'level_5', name: 'Nivel 5', icon: '🎖️', xpRequired: 0, type: 'level', threshold: 5, difficulty: 'easy' },
  { id: 'level_10', name: 'Nivel 10', icon: '🏅', xpRequired: 0, type: 'level', threshold: 10, difficulty: 'normal' },
  { id: 'level_15', name: 'Nivel 15', icon: '🏅', xpRequired: 0, type: 'level', threshold: 15, difficulty: 'normal' },
  { id: 'level_20', name: 'Nivel 20', icon: '🔥', xpRequired: 0, type: 'level', threshold: 20, difficulty: 'epic' },
  { id: 'level_30', name: 'Nivel 30', icon: '⚡', xpRequired: 0, type: 'level', threshold: 30, difficulty: 'epic' },
  { id: 'level_50', name: 'Nivel 50', icon: '👑', xpRequired: 0, type: 'level', threshold: 50, difficulty: 'legendary' },
  { id: 'level_75', name: 'Nivel 75', icon: '🌟', xpRequired: 0, type: 'level', threshold: 75, difficulty: 'legendary' },
  { id: 'level_100', name: 'Nivel 100', icon: '💫', xpRequired: 0, type: 'level', threshold: 100, difficulty: 'training_legend' },
  { id: 'challenge_1', name: 'Primer Reto', icon: '🎯', xpRequired: 0, type: 'challenge', threshold: 1, difficulty: 'easy' },
  { id: 'challenge_5', name: '5 Retos Completados', icon: '🎯', xpRequired: 0, type: 'challenge', threshold: 5, difficulty: 'easy' },
  { id: 'challenge_10', name: 'Maestro de Retos', icon: '🏆', xpRequired: 0, type: 'challenge', threshold: 10, difficulty: 'normal' },
  { id: 'challenge_25', name: '25 Retos Completados', icon: '🔥', xpRequired: 0, type: 'challenge', threshold: 25, difficulty: 'epic' },
  { id: 'challenge_50', name: '50 Retos Completados', icon: '⚡', xpRequired: 0, type: 'challenge', threshold: 50, difficulty: 'epic' },
  { id: 'challenge_100', name: '100 Retos Completados', icon: '👑', xpRequired: 0, type: 'challenge', threshold: 100, difficulty: 'legendary' },
  { id: 'class_1', name: 'Primera Clase', icon: '📅', xpRequired: 0, type: 'class', threshold: 1, difficulty: 'easy' },
  { id: 'class_10', name: '10 Clases', icon: '📅', xpRequired: 0, type: 'class', threshold: 10, difficulty: 'easy' },
  { id: 'class_25', name: '25 Clases', icon: '🎓', xpRequired: 0, type: 'class', threshold: 25, difficulty: 'normal' },
  { id: 'class_50', name: '50 Clases', icon: '🎓', xpRequired: 0, type: 'class', threshold: 50, difficulty: 'normal' },
  { id: 'class_100', name: '100 Clases', icon: '🏆', xpRequired: 0, type: 'class', threshold: 100, difficulty: 'epic' },
  { id: 'class_250', name: '250 Clases', icon: '👑', xpRequired: 0, type: 'class', threshold: 250, difficulty: 'legendary' },
  { id: 'social_5', name: 'Social Novato', icon: '⭐', xpRequired: 0, type: 'social', threshold: 5, difficulty: 'easy' },
  { id: 'social_10', name: 'Social Star', icon: '⭐', xpRequired: 0, type: 'social', threshold: 10, difficulty: 'easy' },
  { id: 'social_25', name: 'Influencer', icon: '🌟', xpRequired: 0, type: 'social', threshold: 25, difficulty: 'normal' },
  { id: 'social_50', name: 'Comunidad Activa', icon: '🔥', xpRequired: 0, type: 'social', threshold: 50, difficulty: 'epic' },
  { id: 'social_100', name: 'Líder Social', icon: '👑', xpRequired: 0, type: 'social', threshold: 100, difficulty: 'legendary' },
  { id: 'early_bird', name: 'Madrugador', icon: '🌅', xpRequired: 0, type: 'special', threshold: 10, difficulty: 'normal' },
  { id: 'night_owl', name: 'Búho Nocturno', icon: '🦉', xpRequired: 0, type: 'special', threshold: 10, difficulty: 'normal' },
  { id: 'weekend_warrior', name: 'Guerrero de Fin de Semana', icon: '⚔️', xpRequired: 0, type: 'special', threshold: 20, difficulty: 'epic' },
  { id: 'consistency_king', name: 'Rey de la Consistencia', icon: '👑', xpRequired: 0, type: 'special', threshold: 100, difficulty: 'legendary' },
  { id: 'all_rounder', name: 'Atleta Completo', icon: '🏅', xpRequired: 0, type: 'special', threshold: 50, difficulty: 'epic' }
]

export async function awardXP(userId, amount, reason = 'Actividad', skipBadgeCheck = false) {
  const { data: user, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error || !user) throw new Error('Usuario no encontrado')

  const oldLevel = user.stats?.level || 1
  const stats = { ...(user.stats || {}) }
  stats.xp = (stats.xp || 0) + amount
  const newLevel = Math.floor((stats.xp || 0) / 100) + 1
  stats.level = newLevel
  const leveledUp = newLevel > oldLevel

  await supabaseAdmin
    .from('profiles')
    .update({ stats, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (leveledUp) {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'level_up',
      title: `¡Subiste a Nivel ${newLevel}!`,
      body: `Has alcanzado el nivel ${newLevel}. ¡Sigue así!`,
      icon: '🎉',
      priority: 'high'
    })
  }

  if (!skipBadgeCheck) {
    await checkBadgeUnlocks(userId, false)
  }

  return { xp: stats.xp, level: stats.level, leveledUp, oldLevel }
}

export async function checkBadgeUnlocks(userId, skipXPBadges = false) {
  const { data: user, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error || !user) throw new Error('Usuario no encontrado')

  const unlockedBadges = []
  const badges = [...(user.badges || [])]
  const userBadgeIds = badges.map((b) => b.id || b._id)

  for (const badgeDef of BADGE_DEFINITIONS) {
    if (userBadgeIds.includes(badgeDef.id)) continue
    if (skipXPBadges && badgeDef.type === 'xp') continue

    let shouldUnlock = false
    switch (badgeDef.type) {
      case 'workout':
        shouldUnlock = (user.stats?.totalWorkouts || 0) >= badgeDef.threshold
        break
      case 'streak':
        shouldUnlock = (user.stats?.longestStreak || 0) >= badgeDef.threshold
        break
      case 'level':
        shouldUnlock = (user.stats?.level || 1) >= badgeDef.threshold
        break
      case 'xp':
        shouldUnlock = (user.stats?.xp || 0) >= badgeDef.threshold
        break
      case 'social':
        shouldUnlock = (user.stats?.socialInteractions || 0) >= badgeDef.threshold
        break
      case 'challenge':
        shouldUnlock = (user.stats?.challengesCompleted || 0) >= badgeDef.threshold
        break
      case 'class':
        shouldUnlock = (user.stats?.classesCompleted || 0) >= badgeDef.threshold
        break
      default:
        shouldUnlock = false
    }

    if (shouldUnlock) {
      badges.push({
        id: badgeDef.id,
        name: badgeDef.name,
        icon: badgeDef.icon,
        earnedAt: new Date().toISOString()
      })
      unlockedBadges.push(badgeDef)
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'badge_unlocked',
        title: '¡Nueva Insignia Desbloqueada!',
        body: `Has desbloqueado: ${badgeDef.name} ${badgeDef.icon}`,
        icon: badgeDef.icon,
        priority: 'high'
      })
    }
  }

  if (unlockedBadges.length > 0) {
    await supabaseAdmin
      .from('profiles')
      .update({ badges, updated_at: new Date().toISOString() })
      .eq('id', userId)
  }

  return unlockedBadges
}

export function getBadgeDefinitions() {
  return BADGE_DEFINITIONS
}
