/**
 * Body metrics calculations (educational, not medical advice).
 * Shared formulas for Progress hub.
 */

export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
}

export const FITNESS_LEVELS = ['beginner', 'intermediate', 'advanced', 'elite']
export const GOAL_DETAILS = ['lose', 'gain', 'maintain', 'recomp']
export const GOALS = ['muscle', 'weight', 'health', 'strength']
export const SEXES = ['male', 'female']

const RANGES = {
  heightCm: [100, 250],
  weightKg: [30, 300],
  targetWeightKg: [30, 300],
  bodyFatPct: [3, 60],
  waistCm: [40, 200],
  hipCm: [40, 200],
  age: [13, 100],
  weeklyWorkouts: [0, 14]
}

export function clampNum(n, min, max) {
  const v = Number(n)
  if (!Number.isFinite(v)) return null
  if (v < min || v > max) return null
  return v
}

export function ageFromBirthDate(birthDate, at = new Date()) {
  if (!birthDate) return null
  const d = new Date(birthDate)
  if (Number.isNaN(d.getTime())) return null
  let age = at.getFullYear() - d.getFullYear()
  const m = at.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) age -= 1
  return age >= 0 ? age : null
}

/** Normalize legacy admin registration keys into canonical snapshot. */
export function normalizeBodySnapshot(raw = {}, goalTopLevel = null) {
  const p = raw && typeof raw === 'object' ? raw : {}
  const heightCm =
    clampNum(p.heightCm ?? p.height, ...RANGES.heightCm) ?? null
  const weightKg =
    clampNum(p.weightKg ?? p.weight, ...RANGES.weightKg) ?? null
  const targetWeightKg =
    clampNum(p.targetWeightKg ?? p.targetWeight ?? p.bodyGoals?.targetWeightKg, ...RANGES.targetWeightKg) ??
    null
  const bodyFatPct = clampNum(p.bodyFatPct ?? p.bodyFat, ...RANGES.bodyFatPct)
  const waistCm = clampNum(p.waistCm, ...RANGES.waistCm)
  const hipCm = clampNum(p.hipCm, ...RANGES.hipCm)

  let sex = p.sex || null
  if (sex === 'other' || sex === 'prefer_not_say') sex = null
  if (sex && !SEXES.includes(sex)) sex = null
  // legacy gender
  if (!sex && (p.gender === 'male' || p.gender === 'female')) sex = p.gender

  const birthDate = p.birthDate || null
  let age = clampNum(p.age, ...RANGES.age)
  const fromBirth = ageFromBirthDate(birthDate)
  if (fromBirth != null) age = clampNum(fromBirth, ...RANGES.age)

  const fitnessLevel = FITNESS_LEVELS.includes(p.fitnessLevel) ? p.fitnessLevel : 'beginner'
  const activityLevel = Object.prototype.hasOwnProperty.call(ACTIVITY_FACTORS, p.activityLevel)
    ? p.activityLevel
    : 'moderate'
  const goalDetail = GOAL_DETAILS.includes(p.goalDetail) ? p.goalDetail : null
  const goal = GOALS.includes(goalTopLevel) ? goalTopLevel : GOALS.includes(p.goal) ? p.goal : null

  const bodyGoalsRaw = p.bodyGoals && typeof p.bodyGoals === 'object' ? p.bodyGoals : {}
  const bodyGoals = {
    targetWeightKg:
      clampNum(bodyGoalsRaw.targetWeightKg ?? targetWeightKg, ...RANGES.targetWeightKg) ?? null,
    weeklyWorkouts: clampNum(bodyGoalsRaw.weeklyWorkouts, ...RANGES.weeklyWorkouts) ?? 3,
    targetDate: bodyGoalsRaw.targetDate || null,
    calorieTargetOverride: clampNum(bodyGoalsRaw.calorieTargetOverride, 800, 6000)
  }

  return {
    sex,
    birthDate,
    age,
    heightCm,
    weightKg,
    targetWeightKg: bodyGoals.targetWeightKg,
    bodyFatPct,
    waistCm,
    hipCm,
    fitnessLevel,
    activityLevel,
    goalDetail,
    goal,
    bodyGoals,
    bio: typeof p.bio === 'string' ? p.bio : undefined,
    coverUrl: p.coverUrl
  }
}

export function calcBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null
  const m = heightCm / 100
  if (m <= 0) return null
  return Math.round((weightKg / (m * m)) * 10) / 10
}

export function bmiCategory(bmi) {
  if (bmi == null) return null
  if (bmi < 18.5) return { id: 'underweight', label: 'Bajo peso' }
  if (bmi < 25) return { id: 'normal', label: 'Peso saludable' }
  if (bmi < 30) return { id: 'overweight', label: 'Sobrepeso' }
  return { id: 'obesity', label: 'Obesidad' }
}

/** Mifflin-St Jeor BMR (kcal/day). Requires sex + age. */
export function calcBmr({ weightKg, heightCm, age, sex }) {
  if (!weightKg || !heightCm || !age || !sex) return null
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  if (sex === 'male') return Math.round(base + 5)
  if (sex === 'female') return Math.round(base - 161)
  return null
}

export function calcTdee(bmr, activityLevel = 'moderate') {
  if (bmr == null) return null
  const factor = ACTIVITY_FACTORS[activityLevel] || ACTIVITY_FACTORS.moderate
  return Math.round(bmr * factor)
}

export function calorieTarget(tdee, goalDetail) {
  if (tdee == null) return null
  const detail = goalDetail || 'maintain'
  if (detail === 'lose') {
    return { min: Math.round(tdee - 500), max: Math.round(tdee - 300), label: 'Déficit moderado' }
  }
  if (detail === 'gain') {
    return { min: Math.round(tdee + 200), max: Math.round(tdee + 400), label: 'Superávit moderado' }
  }
  if (detail === 'recomp') {
    return { min: Math.round(tdee - 150), max: Math.round(tdee + 150), label: 'Cerca de mantenimiento' }
  }
  return { min: Math.round(tdee - 100), max: Math.round(tdee + 100), label: 'Mantenimiento' }
}

export function mapGoalDetailToTopGoal(goalDetail, currentGoal) {
  if (goalDetail === 'lose' || goalDetail === 'gain') return 'weight'
  if (goalDetail === 'recomp') return 'muscle'
  if (goalDetail === 'maintain') return currentGoal === 'strength' ? 'strength' : 'health'
  return currentGoal || 'health'
}

export function buildRoutineTips(snapshot, metrics) {
  const tips = []
  const level = snapshot.fitnessLevel || 'beginner'
  const detail = snapshot.goalDetail || 'maintain'
  const bmiCat = metrics?.bmiCategory?.id

  if (level === 'beginner') {
    tips.push({
      id: 'freq-beginner',
      title: 'Frecuencia',
      body: 'Empieza con 2–3 sesiones/semana de cuerpo completo o tren superior/inferior. Prioriza técnica antes que carga.'
    })
  } else if (level === 'intermediate') {
    tips.push({
      id: 'freq-inter',
      title: 'Frecuencia',
      body: '3–5 sesiones/semana funcionan bien. Alterna estímulos (empuje/jalón/pierna) y deja 48h a grupos grandes.'
    })
  } else {
    tips.push({
      id: 'freq-adv',
      title: 'Frecuencia',
      body: 'Puedes entrenar 4–6 días con periodización. Controla fatiga: deloads cada 4–8 semanas.'
    })
  }

  if (detail === 'lose') {
    tips.push({
      id: 'lose-mix',
      title: 'Fuerza + cardio',
      body: 'Mantén fuerza 2–4 días y añade cardio moderado. El déficit calórico hace el trabajo; el entrenamiento preserva músculo.'
    })
  } else if (detail === 'gain' || detail === 'recomp') {
    tips.push({
      id: 'gain-overload',
      title: 'Sobrecarga progresiva',
      body: 'Aumenta peso o reps cada 1–2 semanas en movimientos compuestos (sentadilla, peso muerto, press, remo).'
    })
  } else if (detail === 'maintain') {
    tips.push({
      id: 'maintain-balance',
      title: 'Equilibrio',
      body: 'Combina fuerza y movilidad. Usa el mantenimiento para pulir técnica y consistencia.'
    })
  }

  if (snapshot.goal === 'strength') {
    tips.push({
      id: 'strength-rest',
      title: 'Descansos',
      body: 'En cargas altas, 2–3 minutos entre series pesadas. Calidad de reps > volumen infinito.'
    })
  }

  if (bmiCat === 'underweight') {
    tips.push({
      id: 'uw-note',
      title: 'Contexto IMC',
      body: 'Si buscas ganar masa, prioriza superávit suave y compuestos. El IMC no distingue músculo de grasa.'
    })
  } else if (bmiCat === 'overweight' || bmiCat === 'obesity') {
    tips.push({
      id: 'ow-note',
      title: 'Contexto IMC',
      body: 'Prioriza consistencia y sueño. Combinar fuerza con caminatas diarias suele ser sostenible. Consulta a un profesional de salud si hace falta.'
    })
  }

  tips.push({
    id: 'disclaimer',
    title: 'Importante',
    body: 'Estas sugerencias son educativas y generales. No sustituyen valoración médica ni de un entrenador certificado.'
  })

  return tips
}

/** Soft QySi catalog hints from body profile. */
export function recommendFromBody(snapshot, metrics = {}) {
  const fitness = snapshot.fitnessLevel || 'beginner'
  let suggestedLevelId = 'beginner'
  if (fitness === 'intermediate') suggestedLevelId = 'intermediate'
  if (fitness === 'advanced' || fitness === 'elite') suggestedLevelId = 'advanced'

  const preferredVariants = []
  const reasonKeys = []

  if (snapshot.goal === 'strength' || snapshot.goalDetail === 'gain') {
    preferredVariants.push('gym', 'fullbody')
    reasonKeys.push('strength_or_gain')
  } else if (snapshot.goalDetail === 'lose' || snapshot.goal === 'weight') {
    preferredVariants.push('gym', 'home', 'running')
    reasonKeys.push('weight_management')
  } else if (snapshot.goal === 'health') {
    preferredVariants.push('home', 'fullbody', 'calisthenics')
    reasonKeys.push('general_health')
  } else {
    preferredVariants.push('gym', 'fullbody', 'calisthenics')
    reasonKeys.push('balanced')
  }

  if (metrics?.bmiCategory?.id === 'underweight') {
    reasonKeys.push('focus_muscle')
  }

  // Prefer program focus
  let preferredProgramId = 'full'
  if (snapshot.goal === 'strength') preferredProgramId = 'upper'
  if (snapshot.goalDetail === 'lose') preferredProgramId = 'full'

  return {
    suggestedLevelId,
    preferredVariants: [...new Set(preferredVariants)],
    preferredProgramId,
    reasonKeys
  }
}

export function computeMetrics(snapshot) {
  const bmi = calcBmi(snapshot.weightKg, snapshot.heightCm)
  const category = bmiCategory(bmi)
  const bmr = calcBmr({
    weightKg: snapshot.weightKg,
    heightCm: snapshot.heightCm,
    age: snapshot.age,
    sex: snapshot.sex
  })
  const tdee = calcTdee(bmr, snapshot.activityLevel)
  let calories = calorieTarget(tdee, snapshot.goalDetail)
  if (snapshot.bodyGoals?.calorieTargetOverride) {
    const o = snapshot.bodyGoals.calorieTargetOverride
    calories = { min: o, max: o, label: 'Objetivo personalizado', override: true }
  }
  return {
    bmi,
    bmiCategory: category,
    bmr,
    tdee,
    calories,
    missingForBmr: [
      !snapshot.weightKg && 'weightKg',
      !snapshot.heightCm && 'heightCm',
      !snapshot.age && 'age',
      !snapshot.sex && 'sex'
    ].filter(Boolean)
  }
}

export function validateProfilePatch(body = {}) {
  const errors = []
  const out = {}

  if (body.sex !== undefined) {
    if (body.sex === null || body.sex === '') out.sex = null
    else if (!SEXES.includes(body.sex)) errors.push('Sexo inválido (male/female para fórmulas)')
    else out.sex = body.sex
  }

  if (body.birthDate !== undefined) {
    if (!body.birthDate) out.birthDate = null
    else {
      const d = new Date(body.birthDate)
      if (Number.isNaN(d.getTime())) errors.push('Fecha de nacimiento inválida')
      else out.birthDate = d.toISOString().slice(0, 10)
    }
  }

  if (body.age !== undefined) {
    const a = clampNum(body.age, ...RANGES.age)
    if (body.age !== null && body.age !== '' && a == null) errors.push('Edad fuera de rango (13–100)')
    else if (a != null) out.age = a
  }

  const numFields = [
    ['heightCm', RANGES.heightCm, 'Altura'],
    ['weightKg', RANGES.weightKg, 'Peso'],
    ['targetWeightKg', RANGES.targetWeightKg, 'Peso objetivo'],
    ['bodyFatPct', RANGES.bodyFatPct, '% grasa'],
    ['waistCm', RANGES.waistCm, 'Cintura'],
    ['hipCm', RANGES.hipCm, 'Cadera']
  ]
  for (const [key, range, label] of numFields) {
    if (body[key] === undefined) continue
    if (body[key] === null || body[key] === '') {
      out[key] = null
      continue
    }
    const v = clampNum(body[key], ...range)
    if (v == null) errors.push(`${label} fuera de rango`)
    else out[key] = v
  }

  if (body.fitnessLevel !== undefined) {
    if (!FITNESS_LEVELS.includes(body.fitnessLevel)) errors.push('Nivel de condición inválido')
    else out.fitnessLevel = body.fitnessLevel
  }

  if (body.activityLevel !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(ACTIVITY_FACTORS, body.activityLevel)) {
      errors.push('Nivel de actividad inválido')
    } else out.activityLevel = body.activityLevel
  }

  if (body.goalDetail !== undefined) {
    if (body.goalDetail === null || body.goalDetail === '') out.goalDetail = null
    else if (!GOAL_DETAILS.includes(body.goalDetail)) errors.push('Detalle de objetivo inválido')
    else out.goalDetail = body.goalDetail
  }

  if (body.goal !== undefined) {
    if (body.goal === null || body.goal === '') out.goal = null
    else if (!GOALS.includes(body.goal)) errors.push('Objetivo inválido')
    else out.goal = body.goal
  }

  if (body.bodyGoals !== undefined && body.bodyGoals && typeof body.bodyGoals === 'object') {
    const bg = {}
    if (body.bodyGoals.targetWeightKg !== undefined) {
      const v = clampNum(body.bodyGoals.targetWeightKg, ...RANGES.targetWeightKg)
      if (body.bodyGoals.targetWeightKg !== null && body.bodyGoals.targetWeightKg !== '' && v == null) {
        errors.push('Peso meta fuera de rango')
      } else bg.targetWeightKg = v
    }
    if (body.bodyGoals.weeklyWorkouts !== undefined) {
      const v = clampNum(body.bodyGoals.weeklyWorkouts, ...RANGES.weeklyWorkouts)
      if (v == null) errors.push('Entrenamientos/semana fuera de rango')
      else bg.weeklyWorkouts = v
    }
    if (body.bodyGoals.targetDate !== undefined) {
      bg.targetDate = body.bodyGoals.targetDate || null
    }
    if (body.bodyGoals.calorieTargetOverride !== undefined) {
      if (
        body.bodyGoals.calorieTargetOverride === null ||
        body.bodyGoals.calorieTargetOverride === ''
      ) {
        bg.calorieTargetOverride = null
      } else {
        const v = clampNum(body.bodyGoals.calorieTargetOverride, 800, 6000)
        if (v == null) errors.push('Calorías objetivo fuera de rango')
        else bg.calorieTargetOverride = v
      }
    }
    out.bodyGoals = bg
  }

  return { errors, patch: out }
}

function parseReps(reps) {
  if (reps == null) return 0
  if (typeof reps === 'number' && Number.isFinite(reps)) return Math.max(0, reps)
  const s = String(reps)
  const m = s.match(/(\d+)/)
  return m ? Number(m[1]) : 0
}

function workoutVolumeStats(workout) {
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : []
  const done = exercises.filter((e) => e?.completed !== false)
  let sets = 0
  let reps = 0
  let loadVolume = 0
  for (const ex of done) {
    const s = Number(ex?.setsCompleted ?? ex?.sets) || 0
    const r = parseReps(ex?.reps)
    sets += s
    reps += s * r
    const w =
      Number(ex?.weight ?? ex?.weightKg ?? ex?.load ?? ex?.kg ?? ex?.loadKg) || 0
    if (w > 0 && s > 0) loadVolume += w * s * Math.max(r, 1)
  }
  // Composite score: prioritize work done even without load logged
  const volumeScore = Math.round(loadVolume > 0 ? loadVolume : sets * 10 + reps + done.length * 5)
  return {
    exercises: done.length,
    sets,
    reps,
    loadVolume: Math.round(loadVolume),
    volumeScore
  }
}

/**
 * Build training volume series + educational projection band + coaching tips.
 */
export function buildTrainingAnalytics(workouts = [], { weeklyTarget = 3 } = {}) {
  const byDay = new Map()

  for (const w of workouts || []) {
    const when = w.completed_at || w.completedAt || w.created_at || w.createdAt
    if (!when) continue
    const day = String(when).slice(0, 10)
    const stats = workoutVolumeStats(w)
    const prev = byDay.get(day) || {
      date: day,
      sessions: 0,
      exercises: 0,
      sets: 0,
      reps: 0,
      volumeScore: 0
    }
    prev.sessions += 1
    prev.exercises += stats.exercises
    prev.sets += stats.sets
    prev.reps += stats.reps
    prev.volumeScore += stats.volumeScore
    byDay.set(day, prev)
  }

  const training = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))

  // Educational projection: gentle +3%/session progressive trend from baseline
  const projection = []
  if (training.length) {
    const baseline =
      training.slice(0, Math.min(3, training.length)).reduce((s, p) => s + p.volumeScore, 0) /
      Math.min(3, training.length)
    let expected = Math.max(baseline, 20)
    for (let i = 0; i < training.length; i++) {
      const actual = training[i].volumeScore
      const low = Math.round(expected * 0.85)
      const high = Math.round(expected * 1.2)
      projection.push({
        date: training[i].date,
        actual,
        expected: Math.round(expected),
        expectedLow: low,
        expectedHigh: high,
        sessions: training[i].sessions,
        exercises: training[i].exercises,
        sets: training[i].sets,
        reps: training[i].reps
      })
      expected *= 1.03
    }
    // Forward-looking educational horizon (2 weeks) — no actual
    const lastDate = new Date(training[training.length - 1].date + 'T12:00:00')
    for (let i = 1; i <= 4; i++) {
      lastDate.setDate(lastDate.getDate() + 3)
      const d = lastDate.toISOString().slice(0, 10)
      projection.push({
        date: d,
        actual: null,
        expected: Math.round(expected),
        expectedLow: Math.round(expected * 0.85),
        expectedHigh: Math.round(expected * 1.2),
        sessions: null,
        exercises: null,
        sets: null,
        reps: null,
        projected: true
      })
      expected *= 1.03
    }
  }

  const coaching = buildTrainingCoaching(training, projection, weeklyTarget)
  return { training, projection, coaching }
}

export function buildTrainingCoaching(training, projection, weeklyTarget = 3) {
  const tips = []
  const sessions = training.reduce((s, p) => s + (p.sessions || 0), 0)

  if (!training.length) {
    tips.push({
      id: 'start',
      tone: 'info',
      title: 'Empieza a registrar sesiones',
      body: 'Cada entrenamiento completado suma ejercicios, series y reps. Aquí verás tu volumen real y una proyección educativa de posibles resultados.'
    })
    return tips
  }

  tips.push({
    id: 'how-read',
    tone: 'info',
    title: 'Cómo leer esta gráfica',
    body: 'La línea sólida es tu volumen real (sesiones × ejercicios × series/reps). La franja es una proyección educativa de progreso posible — no una promesa ni un diagnóstico.'
  })

  const recent = projection.filter((p) => p.actual != null).slice(-4)
  const below = recent.filter((p) => p.actual < p.expectedLow).length
  const above = recent.filter((p) => p.actual > p.expectedHigh).length

  if (below >= 2) {
    tips.push({
      id: 'below-expected',
      tone: 'calm',
      title: 'Si no ves el resultado “esperado”, no te frustres',
      body: 'Los planes casi nunca funcionan perfecto a la primera: sueño, estrés, técnica, calorías y recuperación cambian el ritmo. Ajusta objetivos en “Mis objetivos” o consulta a un entrenador/profesional de salud si lo necesitas.'
    })
    tips.push({
      id: 'why-plans-fail',
      tone: 'strategy',
      title: 'Por qué a veces el plan no arranca',
      body: 'Metas demasiado agresivas, poca consistencia semanal, cargas sin progresión o comparar tu semana 1 con el “ideal” de la app. Edita tu meta semanal a algo sostenible y vuelve a medir en 2–3 semanas.'
    })
  } else if (above >= 2) {
    tips.push({
      id: 'above-expected',
      tone: 'positive',
      title: 'Vas por encima de la proyección',
      body: 'Buen volumen. Vigila recuperación: si subes muy rápido, un deload o bajar un poco la meta semanal puede evitar estancamientos.'
    })
  } else {
    tips.push({
      id: 'on-track',
      tone: 'positive',
      title: 'Tendencia estable',
      body: 'Estás cerca de la banda proyectada. La consistencia importa más que un pico aislado. Sigue registrando sesiones completas.'
    })
  }

  if (weeklyTarget > 0 && sessions > 0) {
    tips.push({
      id: 'edit-goals',
      tone: 'action',
      title: 'Ajusta tus objetivos a tu realidad',
      body: `Tu meta semanal actual es ~${weeklyTarget} sesiones. Si te cuesta cumplirla, bájala; si ya la superas con holgura, súbela con cuidado. Usa “Editar” en Mis objetivos.`
    })
  }

  tips.push({
    id: 'specialist',
    tone: 'calm',
    title: '¿Cuándo pedir ayuda profesional?',
    body: 'Dolor persistente, fatiga extrema, o cambios de peso/ánimo que te preocupen: acude a un especialista. Esta app es educativa, no sustituye valoración médica ni entrenamiento personalizado.'
  })

  return tips
}

