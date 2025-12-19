import User from '../models/User.js'
import Notification from '../models/Notification.js'

// Badge definitions with difficulty tiers
// Difficulty: easy (Fácil), normal (Normal), epic (Épico), legendary (Legendario), training_legend (Leyenda del Training)
const BADGE_DEFINITIONS = [
  // FÁCIL - Entrenamientos
  { id: 'first_workout', name: 'Primer Entrenamiento', icon: '🎯', xpRequired: 0, type: 'workout', threshold: 1, difficulty: 'easy' },
  { id: 'workout_5', name: '5 Entrenamientos', icon: '💪', xpRequired: 0, type: 'workout', threshold: 5, difficulty: 'easy' },
  { id: 'workout_10', name: '10 Entrenamientos', icon: '💪', xpRequired: 0, type: 'workout', threshold: 10, difficulty: 'easy' },
  { id: 'workout_25', name: '25 Entrenamientos', icon: '🔥', xpRequired: 0, type: 'workout', threshold: 25, difficulty: 'normal' },
  { id: 'workout_50', name: '50 Entrenamientos', icon: '🔥', xpRequired: 0, type: 'workout', threshold: 50, difficulty: 'normal' },
  { id: 'workout_100', name: '100 Entrenamientos', icon: '🏆', xpRequired: 0, type: 'workout', threshold: 100, difficulty: 'epic' },
  { id: 'workout_250', name: '250 Entrenamientos', icon: '⚡', xpRequired: 0, type: 'workout', threshold: 250, difficulty: 'legendary' },
  { id: 'workout_500', name: '500 Entrenamientos', icon: '👑', xpRequired: 0, type: 'workout', threshold: 500, difficulty: 'legendary' },
  { id: 'workout_1000', name: '1000 Entrenamientos', icon: '🌟', xpRequired: 0, type: 'workout', threshold: 1000, difficulty: 'training_legend' },
  
  // FÁCIL - Rachas
  { id: 'streak_3', name: 'Racha de 3 Días', icon: '⚡', xpRequired: 0, type: 'streak', threshold: 3, difficulty: 'easy' },
  { id: 'streak_7', name: 'Racha de 7 Días', icon: '⚡', xpRequired: 0, type: 'streak', threshold: 7, difficulty: 'easy' },
  { id: 'streak_14', name: 'Racha de 14 Días', icon: '🌟', xpRequired: 0, type: 'streak', threshold: 14, difficulty: 'normal' },
  { id: 'streak_30', name: 'Racha de 30 Días', icon: '🌟', xpRequired: 0, type: 'streak', threshold: 30, difficulty: 'normal' },
  { id: 'streak_60', name: 'Racha de 60 Días', icon: '🔥', xpRequired: 0, type: 'streak', threshold: 60, difficulty: 'epic' },
  { id: 'streak_90', name: 'Racha de 90 Días', icon: '🏆', xpRequired: 0, type: 'streak', threshold: 90, difficulty: 'epic' },
  { id: 'streak_180', name: 'Racha de 180 Días', icon: '👑', xpRequired: 0, type: 'streak', threshold: 180, difficulty: 'legendary' },
  { id: 'streak_365', name: 'Racha de 365 Días', icon: '🌟', xpRequired: 0, type: 'streak', threshold: 365, difficulty: 'training_legend' },
  
  // FÁCIL - XP
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
  
  // FÁCIL - Niveles
  { id: 'level_2', name: 'Nivel 2', icon: '🎖️', xpRequired: 0, type: 'level', threshold: 2, difficulty: 'easy' },
  { id: 'level_5', name: 'Nivel 5', icon: '🎖️', xpRequired: 0, type: 'level', threshold: 5, difficulty: 'easy' },
  { id: 'level_10', name: 'Nivel 10', icon: '🏅', xpRequired: 0, type: 'level', threshold: 10, difficulty: 'normal' },
  { id: 'level_15', name: 'Nivel 15', icon: '🏅', xpRequired: 0, type: 'level', threshold: 15, difficulty: 'normal' },
  { id: 'level_20', name: 'Nivel 20', icon: '🔥', xpRequired: 0, type: 'level', threshold: 20, difficulty: 'epic' },
  { id: 'level_30', name: 'Nivel 30', icon: '⚡', xpRequired: 0, type: 'level', threshold: 30, difficulty: 'epic' },
  { id: 'level_50', name: 'Nivel 50', icon: '👑', xpRequired: 0, type: 'level', threshold: 50, difficulty: 'legendary' },
  { id: 'level_75', name: 'Nivel 75', icon: '🌟', xpRequired: 0, type: 'level', threshold: 75, difficulty: 'legendary' },
  { id: 'level_100', name: 'Nivel 100', icon: '💫', xpRequired: 0, type: 'level', threshold: 100, difficulty: 'training_legend' },
  
  // FÁCIL - Retos
  { id: 'challenge_1', name: 'Primer Reto', icon: '🎯', xpRequired: 0, type: 'challenge', threshold: 1, difficulty: 'easy' },
  { id: 'challenge_5', name: '5 Retos Completados', icon: '🎯', xpRequired: 0, type: 'challenge', threshold: 5, difficulty: 'easy' },
  { id: 'challenge_10', name: 'Maestro de Retos', icon: '🏆', xpRequired: 0, type: 'challenge', threshold: 10, difficulty: 'normal' },
  { id: 'challenge_25', name: '25 Retos Completados', icon: '🔥', xpRequired: 0, type: 'challenge', threshold: 25, difficulty: 'epic' },
  { id: 'challenge_50', name: '50 Retos Completados', icon: '⚡', xpRequired: 0, type: 'challenge', threshold: 50, difficulty: 'epic' },
  { id: 'challenge_100', name: '100 Retos Completados', icon: '👑', xpRequired: 0, type: 'challenge', threshold: 100, difficulty: 'legendary' },
  
  // FÁCIL - Clases
  { id: 'class_1', name: 'Primera Clase', icon: '📅', xpRequired: 0, type: 'class', threshold: 1, difficulty: 'easy' },
  { id: 'class_10', name: '10 Clases', icon: '📅', xpRequired: 0, type: 'class', threshold: 10, difficulty: 'easy' },
  { id: 'class_25', name: '25 Clases', icon: '🎓', xpRequired: 0, type: 'class', threshold: 25, difficulty: 'normal' },
  { id: 'class_50', name: '50 Clases', icon: '🎓', xpRequired: 0, type: 'class', threshold: 50, difficulty: 'normal' },
  { id: 'class_100', name: '100 Clases', icon: '🏆', xpRequired: 0, type: 'class', threshold: 100, difficulty: 'epic' },
  { id: 'class_250', name: '250 Clases', icon: '👑', xpRequired: 0, type: 'class', threshold: 250, difficulty: 'legendary' },
  
  // NORMAL - Social
  { id: 'social_5', name: 'Social Novato', icon: '⭐', xpRequired: 0, type: 'social', threshold: 5, difficulty: 'easy' },
  { id: 'social_10', name: 'Social Star', icon: '⭐', xpRequired: 0, type: 'social', threshold: 10, difficulty: 'easy' },
  { id: 'social_25', name: 'Influencer', icon: '🌟', xpRequired: 0, type: 'social', threshold: 25, difficulty: 'normal' },
  { id: 'social_50', name: 'Comunidad Activa', icon: '🔥', xpRequired: 0, type: 'social', threshold: 50, difficulty: 'epic' },
  { id: 'social_100', name: 'Líder Social', icon: '👑', xpRequired: 0, type: 'social', threshold: 100, difficulty: 'legendary' },
  
  // ÉPICO - Especiales
  { id: 'early_bird', name: 'Madrugador', icon: '🌅', xpRequired: 0, type: 'special', threshold: 10, difficulty: 'normal' },
  { id: 'night_owl', name: 'Búho Nocturno', icon: '🦉', xpRequired: 0, type: 'special', threshold: 10, difficulty: 'normal' },
  { id: 'weekend_warrior', name: 'Guerrero de Fin de Semana', icon: '⚔️', xpRequired: 0, type: 'special', threshold: 20, difficulty: 'epic' },
  { id: 'consistency_king', name: 'Rey de la Consistencia', icon: '👑', xpRequired: 0, type: 'special', threshold: 100, difficulty: 'legendary' },
  { id: 'all_rounder', name: 'Atleta Completo', icon: '🏅', xpRequired: 0, type: 'special', threshold: 50, difficulty: 'epic' }
]

/**
 * Award XP to a user and check for level ups
 * @param {String} userId - User ID
 * @param {Number} amount - XP amount to award
 * @param {String} reason - Reason for awarding XP
 * @param {Boolean} skipBadgeCheck - Skip badge checking to prevent infinite loops
 * @returns {Promise<Object>} Updated user stats
 */
export async function awardXP(userId, amount, reason = 'Actividad', skipBadgeCheck = false) {
  try {
    const user = await User.findById(userId)
    if (!user) throw new Error('Usuario no encontrado')

    const oldLevel = user.stats?.level || 1
    user.stats = user.stats || {}
    user.stats.xp = (user.stats.xp || 0) + amount

    // Calculate level (100 XP per level)
    const newLevel = Math.floor((user.stats.xp || 0) / 100) + 1
    user.stats.level = newLevel

    const leveledUp = newLevel > oldLevel

    await user.save()

    // Send notification if leveled up
    if (leveledUp) {
      await Notification.create({
        user: userId,
        type: 'level_up',
        title: `¡Subiste a Nivel ${newLevel}!`,
        body: `Has alcanzado el nivel ${newLevel}. ¡Sigue así!`,
        icon: '🎉',
        priority: 'high'
      })
    }

    // Check for badge unlocks (unless we're skipping to prevent loops)
    if (!skipBadgeCheck) {
      await checkBadgeUnlocks(userId, false)
    }

    return {
      xp: user.stats.xp,
      level: user.stats.level,
      leveledUp,
      oldLevel
    }
  } catch (error) {
    console.error('Error awarding XP:', error)
    throw error
  }
}

/**
 * Check and unlock badges for a user
 * @param {String} userId - User ID
 * @param {Boolean} skipXPBadges - Skip XP-based badges to prevent loops
 * @returns {Promise<Array>} Newly unlocked badges
 */
export async function checkBadgeUnlocks(userId, skipXPBadges = false) {
  try {
    const user = await User.findById(userId)
    if (!user) throw new Error('Usuario no encontrado')

    const unlockedBadges = []
    const userBadgeIds = (user.badges || []).map(b => b.id || b._id)

    for (const badgeDef of BADGE_DEFINITIONS) {
      // Skip if already unlocked
      if (userBadgeIds.includes(badgeDef.id)) continue

      // Skip XP badges if requested
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
          // Count social interactions (posts, comments, likes, shares)
          const socialCount = (user.stats?.socialInteractions || 0)
          shouldUnlock = socialCount >= badgeDef.threshold
          break
        case 'challenge':
          // Count completed challenges
          const challengeCount = (user.stats?.challengesCompleted || 0)
          shouldUnlock = challengeCount >= badgeDef.threshold
          break
        case 'class':
          // Count completed classes
          const classCount = (user.stats?.classesCompleted || 0)
          shouldUnlock = classCount >= badgeDef.threshold
          break
        case 'special':
          // Special badges need custom logic
          shouldUnlock = false
          break
        default:
          shouldUnlock = false
      }

      if (shouldUnlock) {
        user.badges = user.badges || []
        user.badges.push({
          id: badgeDef.id,
          name: badgeDef.name,
          icon: badgeDef.icon,
          earnedAt: new Date()
        })

        unlockedBadges.push(badgeDef)

        // Send notification
        await Notification.create({
          user: userId,
          type: 'badge_unlocked',
          title: `¡Nueva Insignia Desbloqueada!`,
          body: `Has desbloqueado: ${badgeDef.name} ${badgeDef.icon}`,
          icon: badgeDef.icon,
          priority: 'high'
        })
      }
    }

    if (unlockedBadges.length > 0) {
      await user.save()
    }

    return unlockedBadges
  } catch (error) {
    console.error('Error checking badge unlocks:', error)
    throw error
  }
}

/**
 * Get all badge definitions
 * @returns {Array} All badge definitions
 */
export function getBadgeDefinitions() {
  return BADGE_DEFINITIONS
}

