/**
 * Client-side body metric helpers (preview + unit conversion).
 * Server remains source of truth for persisted calculations.
 */

export const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentario' },
  { value: 'light', label: 'Ligero' },
  { value: 'moderate', label: 'Moderado' },
  { value: 'active', label: 'Activo' },
  { value: 'very_active', label: 'Muy activo' }
]

export const FITNESS_OPTIONS = [
  { value: 'beginner', label: 'Principiante' },
  { value: 'intermediate', label: 'Intermedio' },
  { value: 'advanced', label: 'Avanzado' },
  { value: 'elite', label: 'Élite' }
]

export const GOAL_DETAIL_OPTIONS = [
  { value: 'lose', label: 'Perder peso' },
  { value: 'gain', label: 'Ganar peso / masa' },
  { value: 'maintain', label: 'Mantener' },
  { value: 'recomp', label: 'Recomposición' }
]

export const GOAL_OPTIONS = [
  { value: 'muscle', label: 'Músculo' },
  { value: 'weight', label: 'Peso' },
  { value: 'health', label: 'Salud' },
  { value: 'strength', label: 'Fuerza' }
]

export function kgToDisplay(kg, unit = 'kg') {
  if (kg == null || !Number.isFinite(Number(kg))) return ''
  if (unit === 'lb') return String(Math.round(Number(kg) * 2.20462 * 10) / 10)
  return String(Number(kg))
}

export function displayToKg(value, unit = 'kg') {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (unit === 'lb') return Math.round((n / 2.20462) * 10) / 10
  return n
}

export function cmToDisplay(cm, unit = 'cm') {
  if (cm == null || !Number.isFinite(Number(cm))) return ''
  if (unit === 'ft') {
    const totalIn = Number(cm) / 2.54
    const ft = Math.floor(totalIn / 12)
    const inch = Math.round(totalIn % 12)
    return `${ft}'${inch}"`
  }
  return String(Number(cm))
}

export function displayToCm(value, unit = 'cm') {
  if (unit === 'ft') {
    const s = String(value).trim()
    const m = s.match(/^(\d+)\s*['′]?\s*(\d+)?/)
    if (m) {
      const ft = Number(m[1]) || 0
      const inch = Number(m[2]) || 0
      return Math.round((ft * 12 + inch) * 2.54)
    }
    const n = Number(s)
    if (!Number.isFinite(n)) return null
    // interpret as total inches if plain number
    return Math.round(n * 2.54)
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function calcBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

export const BODY_EDUCATION = {
  heightCm: {
    id: 'heightCm',
    title: 'Altura',
    what: 'Tu estatura. Se usa para calcular el IMC y la TMB.',
    how: 'Mídete sin zapatos, espalda contra la pared.',
    limits: 'No cambia con el entrenamiento; contextualiza el peso.'
  },
  weightKg: {
    id: 'weightKg',
    title: 'Peso corporal',
    what: 'Tu masa actual. Ideal para ver tendencias en el tiempo.',
    how: 'Pésate en las mismas condiciones (p. ej. al despertar).',
    limits: 'Oscila por agua y comida. Mira la tendencia semanal.'
  },
  targetWeightKg: {
    id: 'targetWeightKg',
    title: 'Peso objetivo',
    what: 'La meta de peso que quieres alcanzar o mantener.',
    how: '0.25–0.75 kg/semana suele ser un ritmo sostenible.',
    limits: 'Combínalo con fuerza, energía y hábitos — no solo la báscula.'
  },
  bmi: {
    id: 'bmi',
    title: 'IMC',
    what: 'Relación peso/altura². Indicador poblacional rápido.',
    how: 'IMC = kg / m². Categorías: bajo, saludable, sobrepeso, obesidad.',
    limits: 'No distingue músculo de grasa. No es diagnóstico médico.'
  },
  bodyFatPct: {
    id: 'bodyFatPct',
    title: '% de grasa',
    what: 'Estimación de masa grasa respecto al peso total.',
    how: 'Bioimpedancia, plicómetro o estimación profesional.',
    limits: 'Métodos caseros tienen error. Úsalo como tendencia.'
  },
  waistCm: {
    id: 'waistCm',
    title: 'Cintura',
    what: 'Perímetro a la altura del ombligo.',
    how: 'Cinta flexible, exhalación normal, sin apretar.',
    limits: 'Contexto útil junto al peso; no es diagnóstico.'
  },
  hipCm: {
    id: 'hipCm',
    title: 'Cadera',
    what: 'Perímetro en la parte más ancha de cadera/glúteos.',
    how: 'Útil junto a la cintura para ver composición.',
    limits: 'Opcional; seguimiento personal.'
  },
  bmr: {
    id: 'bmr',
    title: 'TMB',
    what: 'Calorías estimadas en reposo absoluto.',
    how: 'Fórmula Mifflin-St Jeor (sexo, edad, peso, altura).',
    limits: 'Estimación educativa. No sustituye valoración médica.'
  },
  tdee: {
    id: 'tdee',
    title: 'TDEE',
    what: 'Gasto energético diario estimado según actividad.',
    how: 'TMB × factor de actividad.',
    limits: 'Ajusta según cómo responda tu peso en 2–3 semanas.'
  },
  calories: {
    id: 'calories',
    title: 'Rango calórico',
    what: 'Ventana sugerida según tu objetivo corporal.',
    how: 'Déficit / superávit suave o mantenimiento.',
    limits: 'No es un plan nutricional personalizado.'
  },
  sex: {
    id: 'sex',
    title: 'Sexo biológico',
    what: 'Solo para fórmulas de TMB. Privado.',
    how: 'Elige la opción para el cálculo Mifflin-St Jeor.',
    limits: 'No se muestra en el perfil social.'
  },
  age: {
    id: 'age',
    title: 'Edad',
    what: 'Necesaria para estimar TMB.',
    how: 'Fecha de nacimiento o edad aproximada.',
    limits: 'Solo cálculos; no se publica.'
  },
  fitnessLevel: {
    id: 'fitnessLevel',
    title: 'Nivel de condición',
    what: 'Cómo te sientes entrenando hoy.',
    how: 'Sé honesto: mejor empezar más fácil.',
    limits: 'QySi lo usa para sugerir nivel del catálogo.'
  },
  activityLevel: {
    id: 'activityLevel',
    title: 'Nivel de actividad',
    what: 'Movimiento fuera del gimnasio.',
    how: 'Sedentario → muy activo.',
    limits: 'Afecta el TDEE estimado.'
  },
  goalDetail: {
    id: 'goalDetail',
    title: 'Detalle de objetivo',
    what: 'Perder, ganar, mantener o recomposición.',
    how: 'Recomposición = cerca de mantenimiento con fuerza.',
    limits: 'Define tips y rango calórico sugerido.'
  }
}
