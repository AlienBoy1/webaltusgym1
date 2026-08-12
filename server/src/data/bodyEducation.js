/** Educational copy for Progress body hub (Spanish). Not medical advice. */

export const BODY_EDUCATION = {
  heightCm: {
    id: 'heightCm',
    title: 'Altura',
    what: 'Tu estatura en centímetros. Se usa para calcular el IMC y la TMB.',
    how: 'Mídete sin zapatos, espalda contra la pared, por la mañana si es posible.',
    limits: 'La altura no cambia con el entrenamiento; solo ayuda a contextualizar el peso.'
  },
  weightKg: {
    id: 'weightKg',
    title: 'Peso corporal',
    what: 'Tu masa corporal actual. Es la métrica más útil para ver tendencias en el tiempo.',
    how: 'Pésate en las mismas condiciones (p. ej. al despertar, después de ir al baño).',
    limits: 'El peso oscila por agua, comida y glucógeno. Mira la tendencia semanal, no un solo día.'
  },
  targetWeightKg: {
    id: 'targetWeightKg',
    title: 'Peso objetivo',
    what: 'La meta de peso que quieres alcanzar o mantener.',
    how: 'Elige un rango realista (0.25–0.75 kg/semana de cambio suele ser sostenible).',
    limits: 'Un objetivo no define salud. Combínalo con fuerza, energía y hábitos.'
  },
  bmi: {
    id: 'bmi',
    title: 'IMC (índice de masa corporal)',
    what: 'Relación peso/altura². Es un indicador poblacional rápido, no un diagnóstico.',
    how: 'IMC = peso (kg) / [altura (m)]². Categorías OMS: bajo, saludable, sobrepeso, obesidad.',
    limits: 'No distingue músculo de grasa. Atletas musculosos pueden tener IMC alto sin exceso de grasa. No sustituye evaluación médica.'
  },
  bodyFatPct: {
    id: 'bodyFatPct',
    title: 'Porcentaje de grasa',
    what: 'Estimación de la proporción de masa grasa respecto al peso total.',
    how: 'Puedes medirlo con báscula de bioimpedancia, plicómetro o estimación visual profesional.',
    limits: 'Los métodos caseros tienen error. Úsalo como tendencia, no como cifra absoluta.'
  },
  waistCm: {
    id: 'waistCm',
    title: 'Cintura',
    what: 'Perímetro a la altura del ombligo. Relacionado con grasa abdominal.',
    how: 'Cinta flexible, exhalación normal, sin apretar la piel.',
    limits: 'Es un contexto útil junto al peso; no es diagnóstico clínico.'
  },
  hipCm: {
    id: 'hipCm',
    title: 'Cadera',
    what: 'Perímetro en la parte más ancha de la cadera/glúteos.',
    how: 'Útil junto a la cintura para ver cambios de composición.',
    limits: 'Opcional. Sirve más para seguimiento personal que para fórmulas.'
  },
  bmr: {
    id: 'bmr',
    title: 'TMB (tasa metabólica basal)',
    what: 'Estimación de calorías que tu cuerpo gastaría en reposo absoluto.',
    how: 'Usamos Mifflin-St Jeor con sexo, edad, peso y altura.',
    limits: 'Es una estimación. Medicamentos, sueño y genética influyen. No es consejo médico.'
  },
  tdee: {
    id: 'tdee',
    title: 'TDEE (gasto energético diario)',
    what: 'Estimación de calorías totales al día según tu nivel de actividad.',
    how: 'TMB × factor de actividad (sedentario → muy activo).',
    limits: 'Ajusta según cómo responda tu peso real en 2–3 semanas.'
  },
  calories: {
    id: 'calories',
    title: 'Rango calórico sugerido',
    what: 'Ventana educativa alrededor del TDEE según tu objetivo (perder, ganar, mantener, recomposición).',
    how: 'Déficit suave para perder; superávit suave para ganar; cerca de mantenimiento para recomposición.',
    limits: 'No es un plan nutricional personalizado. Si tienes condiciones de salud, consulta a un profesional.'
  },
  sex: {
    id: 'sex',
    title: 'Sexo biológico',
    what: 'Se usa solo para fórmulas de TMB (Mifflin-St Jeor).',
    how: 'Elige la opción que corresponda a la fórmula; no se muestra públicamente.',
    limits: 'Privado. No define identidad ni se comparte en el perfil social.'
  },
  age: {
    id: 'age',
    title: 'Edad',
    what: 'Necesaria para estimar TMB con precisión razonable.',
    how: 'Puedes indicar fecha de nacimiento o edad aproximada.',
    limits: 'Solo se usa en cálculos; no se publica.'
  },
  fitnessLevel: {
    id: 'fitnessLevel',
    title: 'Nivel de condición',
    what: 'Cómo te sientes entrenando hoy: principiante → élite.',
    how: 'Sé honesto: mejor empezar más fácil e ir subiendo.',
    limits: 'QySi usa este dato para sugerir nivel de rutina del catálogo.'
  },
  activityLevel: {
    id: 'activityLevel',
    title: 'Nivel de actividad',
    what: 'Cuánto te mueves fuera del gimnasio (trabajo, caminatas, etc.).',
    how: 'Sedentario (poco movimiento) → muy activo (trabajo físico o deporte diario).',
    limits: 'Afecta el TDEE. Si tu peso no se mueve, ajusta este factor o las calorías.'
  },
  goalDetail: {
    id: 'goalDetail',
    title: 'Detalle de objetivo',
    what: 'Qué quieres lograr con el peso/composición: perder, ganar, mantener o recomposición.',
    how: 'Recomposición = ganar músculo y reducir grasa de forma lenta, cerca de mantenimiento.',
    limits: 'Define el rango calórico sugerido y los tips de rutina.'
  }
}

export function listEducation() {
  return Object.values(BODY_EDUCATION)
}

export function getEducation(id) {
  return BODY_EDUCATION[id] || null
}
