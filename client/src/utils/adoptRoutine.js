import api from './api'
import { toStartableTemplate } from '../components/RoutineDetailModal'

const WORKOUT_TEMPLATES_KEY = 'qyntra:workout_templates'

export function resolveAdoptSourceId(routine) {
  if (!routine) return null
  return routine.routineId || routine.id || routine._id || null
}

export function findLocalAdoption(sourceId) {
  if (!sourceId) return null
  try {
    const stored = JSON.parse(localStorage.getItem(WORKOUT_TEMPLATES_KEY) || '[]')
    if (!Array.isArray(stored)) return null
    return (
      stored.find((t) => String(t?.sourceRoutineId || '') === String(sourceId)) || null
    )
  } catch {
    return null
  }
}

function persistAdoptedLocal(local) {
  const stored = JSON.parse(localStorage.getItem(WORKOUT_TEMPLATES_KEY) || '[]')
  const list = Array.isArray(stored) ? stored : []
  const sourceId = local?.sourceRoutineId
  const next = sourceId
    ? list.filter((t) => String(t?.sourceRoutineId || '') !== String(sourceId))
    : list
  localStorage.setItem(WORKOUT_TEMPLATES_KEY, JSON.stringify([...next, local]))
}

/**
 * Adopt a public/community routine into Entrenos (one adoption per source).
 * Returns { ok, local?, already?, offline?, message? }.
 */
export async function adoptRoutineToWorkouts(routine, { author } = {}) {
  if (!routine) {
    return { ok: false, message: 'Rutina no válida para adoptar' }
  }

  if (routine.sourceRoutineId || routine.isEditedFork || routine.isCollaboratorVersion) {
    return {
      ok: false,
      message:
        'Esta versión colaborativa no se puede adoptar. Adopta la rutina original del creador.'
    }
  }

  const sourceId = resolveAdoptSourceId(routine)
  if (!sourceId) {
    return { ok: false, message: 'Rutina no válida para adoptar' }
  }

  const existingLocal = findLocalAdoption(sourceId)
  if (existingLocal) {
    return {
      ok: false,
      already: true,
      message:
        'Ya adoptaste esta rutina. Elimínala en Entrenos si quieres volver a adoptarla.',
      existing: existingLocal
    }
  }

  try {
    const { data } = await api.post(`/workouts/routines/${sourceId}/adopt`)
    const creator = data.originalCreator || author || routine.user || routine.originalCreator
    const local = toStartableTemplate({
      ...data,
      exercises: data.exercises || routine.exercises,
      originalCreator: creator,
      originalCreatorId:
        data.originalCreatorId ||
        creator?.id ||
        creator?._id ||
        author?.id ||
        author?._id ||
        routine.user?.id ||
        routine.user?._id,
      sourceRoutineId: data.sourceRoutineId || sourceId,
      user: creator
    })
    local.serverId = data.id || data._id
    local.isPublic = false
    if (data.localId) local.id = data.localId
    persistAdoptedLocal(local)
    return { ok: true, local }
  } catch (error) {
    const status = error?.response?.status
    const code = error?.response?.data?.code
    const message = error?.response?.data?.message

    if (status === 409 || code === 'ALREADY_ADOPTED') {
      return {
        ok: false,
        already: true,
        message:
          message ||
          'Ya adoptaste esta rutina. Elimínala en Entrenos si quieres volver a adoptarla.'
      }
    }

    if (status === 400 || status === 403 || status === 404) {
      return { ok: false, message: message || 'No se pudo adoptar la rutina' }
    }

    // Offline only: save once locally (duplicate already blocked above)
    if (!error?.response && Array.isArray(routine.exercises) && routine.exercises.length) {
      const creator = author || routine.user || routine.originalCreator
      const local = toStartableTemplate({
        ...routine,
        sourceRoutineId: sourceId,
        originalCreator: creator,
        originalCreatorId: creator?.id || creator?._id || routine.userId || null
      })
      persistAdoptedLocal(local)
      return { ok: true, local, offline: true }
    }

    return { ok: false, message: message || 'No se pudo adoptar la rutina' }
  }
}
