/**
 * Challenge helpers — time goals, exercise result labels, share payloads.
 */

/** Normalize exercise templates from create/API payloads. */
export function normalizeChallengeExercises(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((ex, index) => {
      const name = String(ex?.name || '').trim()
      const targetReps = Number(ex?.targetReps ?? ex?.target_reps ?? ex?.reps)
      if (!name || !Number.isFinite(targetReps) || targetReps <= 0) return null
      const id = String(ex?.id || `ex-${index + 1}`)
      return { id, name, targetReps }
    })
    .filter(Boolean)
}

export function sumExerciseTargets(exercises) {
  return normalizeChallengeExercises(exercises).reduce((sum, ex) => sum + ex.targetReps, 0)
}

/** Cap each entry to its exercise target; return { map, total }. */
export function clampExerciseProgress(exercises, progressInput) {
  const list = normalizeChallengeExercises(exercises)
  const src =
    progressInput && typeof progressInput === 'object' && !Array.isArray(progressInput)
      ? progressInput
      : {}
  const map = {}
  let total = 0
  for (const ex of list) {
    const raw = Number(src[ex.id] ?? src[ex.name] ?? 0)
    const val = Number.isFinite(raw) ? Math.max(0, Math.min(ex.targetReps, raw)) : 0
    map[ex.id] = val
    total += val
  }
  return { map, total }
}

export function isTimeGoalChallenge(challengeOrData) {
  if (!challengeOrData) return false
  const mode = challengeOrData.goalMode || challengeOrData.goal_mode
  if (mode === 'time') return true
  const unit = String(challengeOrData.unit || challengeOrData.challengeUnit || '').toLowerCase()
  return unit === 'min' || unit === 'mins' || unit === 'minuto' || unit === 'minutos' || unit === 'seg' || unit === 'segundos'
}

/** Target duration in ms for a time-goal challenge. Goal is stored in minutes by default. */
export function getTimeGoalMs(challenge) {
  if (!challenge) return 0
  const unit = String(challenge.unit || '').toLowerCase()
  const goal = Number(challenge.goal) || 0
  if (unit === 'seg' || unit === 'segundos') return Math.max(0, goal * 1000)
  // minutes (default for time mode)
  return Math.max(0, goal * 60 * 1000)
}

export function formatChallengeGoal(challenge) {
  if (!challenge) return ''
  const goal = challenge.goal ?? challenge.challengeGoal
  const unit = challenge.unit || challenge.challengeUnit || ''
  if (isTimeGoalChallenge(challenge)) {
    const u = String(unit || 'min').toLowerCase()
    if (u === 'seg' || u === 'segundos') return `${goal} seg`
    return `${goal} min`
  }
  return unit ? `${goal} ${unit}` : String(goal)
}

/**
 * Infer secondary exercise metric after a time-based challenge completes.
 * Distance/running → km; otherwise repetitions.
 */
export function getExerciseResultMeta(type, description = '') {
  const desc = String(description || '')
  const isDistance =
    type === 'distance' ||
    /running|correr|carrera|km|distancia|trote|cardio\s*run/i.test(desc)

  if (isDistance) {
    return {
      unit: 'km',
      label: 'Kilómetros recorridos',
      placeholder: 'Ej: 5.2',
      step: '0.1',
      inputMode: 'decimal'
    }
  }

  return {
    unit: 'reps',
    label: 'Repeticiones realizadas',
    placeholder: 'Ej: 50',
    step: '1',
    inputMode: 'numeric'
  }
}

export function buildChallengeSharePayload(challenge, opts = {}) {
  const {
    shareMode = 'invite',
    xpAwarded,
    accumulatedMs,
    resultValue,
    resultUnit,
    content
  } = opts

  const title = challenge.title || challenge.challengeTitle || 'Reto'
  const endDate = challenge.endDate || challenge.end_date || null
  const goalMode = challenge.goalMode || (isTimeGoalChallenge(challenge) ? 'time' : 'quantity')

  const workoutData = {
    shareKind: 'challenge',
    shareMode,
    challengeId: challenge._id || challenge.id || challenge.challengeId || null,
    challengeTitle: title,
    challengeDescription: challenge.description || '',
    challengeType: challenge.type || challenge.challengeType || 'custom',
    challengeGoal: challenge.goal ?? challenge.challengeGoal,
    challengeUnit: challenge.unit || challenge.challengeUnit || null,
    goalMode,
    exercises: normalizeChallengeExercises(challenge.exercises || challenge.reward?.exercises),
    rewardXp: challenge.reward?.xp || xpAwarded || 100,
    participantsCount: challenge.participants?.length || challenge.participantsCount || 0,
    endDate,
    challengeEndDate: endDate,
    creatorName:
      (typeof challenge.createdBy === 'object' ? challenge.createdBy?.name : null) ||
      challenge.creatorName ||
      null
  }

  if (shareMode === 'completed') {
    workoutData.xpAwarded = xpAwarded ?? challenge.reward?.xp ?? 100
    workoutData.accumulatedMs = accumulatedMs || 0
    if (resultValue != null) workoutData.resultValue = resultValue
    if (resultUnit) workoutData.resultUnit = resultUnit
  }

  const defaultContent =
    shareMode === 'completed'
      ? `¡Completé el reto "${title}"! 🏆`
      : `¡Únete al reto "${title}"! 🎯`

  return {
    content: content || defaultContent,
    postType: 'challenge',
    workoutData
  }
}

export function formatElapsed(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${m}:${String(s).padStart(2, '0')}`
}
