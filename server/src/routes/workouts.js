import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapWorkout, mapProfile } from '../lib/mappers.js'
import { authenticate } from '../middleware/auth.js'
import { notifyUser } from '../services/notificationService.js'

const router = express.Router()

const defaultTemplates = [
  {
    id: 1,
    name: 'Pecho y Tríceps',
    exercises: [
      { name: 'Press Banca', sets: 4, reps: 10 },
      { name: 'Press Inclinado', sets: 3, reps: 12 },
      { name: 'Aperturas', sets: 3, reps: 15 },
      { name: 'Fondos', sets: 3, reps: 12 },
      { name: 'Extensiones Tríceps', sets: 3, reps: 15 }
    ]
  },
  {
    id: 2,
    name: 'Espalda y Bíceps',
    exercises: [
      { name: 'Dominadas', sets: 4, reps: 8 },
      { name: 'Remo con Barra', sets: 4, reps: 10 },
      { name: 'Jalón al Pecho', sets: 3, reps: 12 },
      { name: 'Curl con Barra', sets: 3, reps: 12 },
      { name: 'Curl Martillo', sets: 3, reps: 12 }
    ]
  },
  {
    id: 3,
    name: 'Piernas',
    exercises: [
      { name: 'Sentadillas', sets: 4, reps: 10 },
      { name: 'Prensa', sets: 4, reps: 12 },
      { name: 'Peso Muerto Rumano', sets: 3, reps: 10 },
      { name: 'Extensiones', sets: 3, reps: 15 },
      { name: 'Curl Femoral', sets: 3, reps: 12 }
    ]
  },
  {
    id: 4,
    name: 'Hombros y Core',
    exercises: [
      { name: 'Press Militar', sets: 4, reps: 10 },
      { name: 'Elevaciones Laterales', sets: 3, reps: 15 },
      { name: 'Pájaros', sets: 3, reps: 15 },
      { name: 'Plancha', sets: 3, reps: '60s' },
      { name: 'Crunch', sets: 3, reps: 20 }
    ]
  }
]

router.get('/templates/all', authenticate, async (req, res) => {
  res.json(defaultTemplates)
})

function normalizeDays(days) {
  if (!Array.isArray(days)) return []
  return [...new Set(days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
}

function normalizeExerciseName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function exerciseIdentity(ex) {
  return {
    name: String(ex?.name || '').trim(),
    sets: Number(ex?.sets ?? ex?.setsCompleted) || 0,
    reps: String(ex?.reps ?? '')
  }
}

function exerciseChanged(a, b) {
  if (!a || !b) return true
  const left = exerciseIdentity(a)
  const right = exerciseIdentity(b)
  return left.name !== right.name || left.sets !== right.sets || left.reps !== right.reps
}

/** Stamp adoption metadata so collaborator diffs stay accurate later. */
function stampAdoptedExercises(exercises) {
  return (Array.isArray(exercises) ? exercises : []).map((ex, i) => {
    const id = ex?.id || `ex-origin-${i}-${Date.now()}`
    const snap = exerciseIdentity(ex)
    return {
      ...ex,
      id,
      originExerciseId: ex?.originExerciseId || id,
      originSnapshot: ex?.originSnapshot || {
        name: snap.name,
        sets: snap.sets,
        reps: snap.reps
      }
    }
  })
}

/**
 * Tag fork exercises vs author originals:
 * - author: unchanged from adoption snapshot / source
 * - edited: came from author but modified
 * - collaborator: added by the GymRat collaborator
 */
function annotateForkExercises(forkExercises, sourceExercises = []) {
  const sourceList = Array.isArray(sourceExercises) ? sourceExercises : []
  const sourceById = new Map()
  const sourceByName = new Map()
  for (const ex of sourceList) {
    const id = ex?.id || ex?.originExerciseId
    if (id) sourceById.set(String(id), ex)
    const key = normalizeExerciseName(ex?.name)
    if (key && !sourceByName.has(key)) sourceByName.set(key, ex)
  }

  const used = new Set()
  return (Array.isArray(forkExercises) ? forkExercises : []).map((ex, index) => {
    const originId = ex?.originExerciseId || ex?.id || null
    let baseline = null

    if (ex?.originSnapshot) {
      baseline = {
        name: ex.originSnapshot.name,
        sets: ex.originSnapshot.sets,
        reps: ex.originSnapshot.reps
      }
    } else if (originId && sourceById.has(String(originId))) {
      baseline = sourceById.get(String(originId))
      used.add(String(originId))
    } else {
      const key = normalizeExerciseName(ex?.name)
      if (key && sourceByName.has(key)) {
        const match = sourceByName.get(key)
        const mid = String(match.id || match.originExerciseId || key)
        if (!used.has(mid)) {
          baseline = match
          used.add(mid)
        }
      }
    }

    let provenance = 'collaborator'
    let provenanceLabel = 'Colaborador'
    if (baseline) {
      if (exerciseChanged(ex, baseline)) {
        provenance = 'edited'
        provenanceLabel = 'Editada'
      } else {
        provenance = 'author'
        provenanceLabel = 'Autor'
      }
    }

    return {
      ...ex,
      id: ex?.id || `fork-ex-${index}`,
      provenance,
      provenanceLabel
    }
  })
}

function preserveExerciseOrigins(incoming, previous = []) {
  const prevById = new Map(
    (Array.isArray(previous) ? previous : [])
      .filter((ex) => ex?.id)
      .map((ex) => [String(ex.id), ex])
  )
  return (Array.isArray(incoming) ? incoming : []).map((ex, i) => {
    const prev = (ex?.id && prevById.get(String(ex.id))) || null
    const originExerciseId = ex?.originExerciseId || prev?.originExerciseId || null
    const originSnapshot = ex?.originSnapshot || prev?.originSnapshot || null
    return {
      ...ex,
      id: ex?.id || prev?.id || `ex-${Date.now()}-${i}`,
      ...(originExerciseId ? { originExerciseId } : {}),
      ...(originSnapshot ? { originSnapshot } : {})
    }
  })
}

async function healMissingExerciseOrigins(exercises, sourceId) {
  const list = Array.isArray(exercises) ? exercises : []
  if (!sourceId || !list.some((ex) => !ex?.originSnapshot && !ex?.originExerciseId)) {
    return list
  }
  try {
    const { data: source } = await supabaseAdmin
      .from('workout_routines')
      .select('exercises')
      .eq('id', sourceId)
      .maybeSingle()
    if (!source) return list
    const used = new Set()
    return list.map((ex) => {
      if (ex?.originSnapshot || ex?.originExerciseId) return ex
      const key = normalizeExerciseName(ex?.name)
      const match = (source.exercises || []).find((s) => {
        const sid = String(s.id || s.originExerciseId || '')
        if (sid && used.has(sid)) return false
        return normalizeExerciseName(s.name) === key
      })
      if (!match) return ex
      const sid = String(match.id || match.originExerciseId || key)
      used.add(sid)
      const snap = exerciseIdentity(match)
      return {
        ...ex,
        originExerciseId: match.id || ex.id,
        originSnapshot: { name: snap.name, sets: snap.sets, reps: snap.reps }
      }
    })
  } catch {
    return list
  }
}

function buildForkViewPayload(fork, source, editor, creator) {
  const annotated = annotateForkExercises(fork.exercises || [], source?.exercises || [])
  const mapped = mapRoutine(fork, editor, creator)
  return {
    ...mapped,
    id: fork.id,
    _id: fork.id,
    name: fork.name,
    exercises: annotated,
    canAdopt: false,
    isCollaboratorVersion: true,
    isEditedFork: Boolean(fork.is_edited_fork || true),
    forkView: true,
    sourceRoutineId: fork.source_routine_id || source?.id || null,
    editor: editor
      ? {
          _id: editor.id || fork.user_id,
          id: editor.id || fork.user_id,
          name: editor.name,
          username: editor.username || null,
          avatar: editor.avatar
        }
      : null,
    stats: {
      author: annotated.filter((e) => e.provenance === 'author').length,
      edited: annotated.filter((e) => e.provenance === 'edited').length,
      collaborator: annotated.filter((e) => e.provenance === 'collaborator').length
    }
  }
}

function mapRoutine(row, user = null, originalCreator = null) {
  const creator = originalCreator || (row.original_creator_id && user && row.original_creator_id === user.id
    ? user
    : null)
  return {
    _id: row.id,
    id: row.id,
    localId: row.local_id || null,
    name: row.name,
    color: row.color || 'primary',
    exercises: row.exercises || [],
    days: normalizeDays(row.days),
    isPublic: Boolean(row.is_public),
    userId: row.user_id,
    user: user
      ? {
          _id: user.id,
          id: user.id,
          name: user.name,
          username: user.username || null,
          avatar: user.avatar
        }
      : undefined,
    sourceRoutineId: row.source_routine_id || null,
    originalCreatorId: row.original_creator_id || row.user_id || null,
    originalCreator: creator
      ? {
          _id: creator.id,
          id: creator.id,
          name: creator.name,
          username: creator.username || null,
          avatar: creator.avatar
        }
      : undefined,
    adoptCount: Number(row.adopt_count) || 0,
    isEditedFork: Boolean(row.is_edited_fork),
    collaboratorAt: row.collaborator_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function loadProfilesMap(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (!unique.length) return {}
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, username, avatar')
    .in('id', unique)
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

async function getCommunityUserIds(userId) {
  const [{ data: following }, { data: followers }] = await Promise.all([
    supabaseAdmin.from('follows').select('following_id').eq('follower_id', userId),
    supabaseAdmin.from('follows').select('follower_id').eq('following_id', userId)
  ])
  return [
    ...new Set([
      ...(following || []).map((f) => f.following_id),
      ...(followers || []).map((f) => f.follower_id)
    ])
  ]
}

async function canAccessOwnerRoutines(viewerId, ownerId) {
  if (!viewerId || !ownerId) return false
  if (viewerId === ownerId) return true
  const communityIds = await getCommunityUserIds(viewerId)
  if (communityIds.includes(ownerId)) return true
  const { data: owner } = await supabaseAdmin
    .from('profiles')
    .select('settings')
    .eq('id', ownerId)
    .maybeSingle()
  return owner?.settings?.privacy?.profilePublic === true
}

/** When an adopter edits their fork, become a GymRat collaborator. */
function collaboratorPatchForRow(existing, userId, { force = false, sourceRoutineId = null } = {}) {
  const sourceId = existing?.source_routine_id || sourceRoutineId || null
  if (!sourceId) return null
  // Any save on an adopted copy marks the GymRat as collaborator
  if (existing?.is_edited_fork && !force) {
    return { is_edited_fork: true }
  }
  return {
    is_edited_fork: true,
    collaborator_at: existing?.collaborator_at || new Date().toISOString()
  }
}

function provenanceRepairPatch(existing, body, userId) {
  const patch = {}
  const bodySource = body?.sourceRoutineId || body?.source_routine_id || null
  const bodyCreator = body?.originalCreatorId || body?.original_creator_id || null
  if (!existing?.source_routine_id && bodySource) {
    patch.source_routine_id = bodySource
  }
  if (!existing?.original_creator_id && bodyCreator && bodyCreator !== userId) {
    patch.original_creator_id = bodyCreator
  } else if (!existing?.original_creator_id && bodyCreator) {
    // Keep creator id even if same as user in edge cases when client sends it for an adoption chain
    patch.original_creator_id = bodyCreator
  }
  return patch
}

function stableExercisesKey(exercises) {
  try {
    return JSON.stringify(
      (Array.isArray(exercises) ? exercises : []).map((ex) => ({
        name: String(ex?.name || '').trim().toLowerCase(),
        sets: Number(ex?.sets) || 0,
        reps: String(ex?.reps ?? '')
      }))
    )
  } catch {
    return '[]'
  }
}

function forkLooksEdited(fork, source) {
  if (fork?.is_edited_fork) return true
  const updatedMs = fork?.updated_at ? new Date(fork.updated_at).getTime() : 0
  const createdMs = fork?.created_at ? new Date(fork.created_at).getTime() : 0
  if (updatedMs && createdMs && updatedMs - createdMs > 1200) return true
  if (source) {
    if (String(fork?.name || '').trim() !== String(source.name || '').trim()) return true
    if (stableExercisesKey(fork?.exercises) !== stableExercisesKey(source.exercises)) return true
  }
  return false
}

// My saved routines (server sync for GymRat / public)
router.get('/routines', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workout_routines')
      .select('*')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false })
    if (error) throw error
    const creatorIds = (data || []).map((r) => r.original_creator_id || r.user_id)
    const profiles = await loadProfilesMap(creatorIds)
    res.json(
      (data || []).map((row) => {
        const creatorId = row.original_creator_id || row.user_id
        return mapRoutine(row, null, profiles[creatorId] || null)
      })
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener rutinas', error: error.message })
  }
})

// Explore public routines from community (followers graph) + public profiles
router.get('/routines/explore', authenticate, async (req, res) => {
  try {
    const communityIds = await getCommunityUserIds(req.user.id)

    const { data: publicProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name, username, avatar, settings')
      .neq('id', req.user.id)

    const openProfileIds = (publicProfiles || [])
      .filter((p) => p.settings?.privacy?.profilePublic === true)
      .map((p) => p.id)

    const allowedIds = [...new Set([req.user.id, ...communityIds, ...openProfileIds])]
    if (!allowedIds.length) {
      return res.json([])
    }

    const { data, error } = await supabaseAdmin
      .from('workout_routines')
      .select('*')
      .eq('is_public', true)
      .is('source_routine_id', null)
      .in('user_id', allowedIds)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const profileMap = Object.fromEntries((publicProfiles || []).map((p) => [p.id, p]))
    // Also fetch community profiles missing from publicProfiles select if needed
    const missing = (data || []).map((r) => r.user_id).filter((id) => !profileMap[id])
    if (missing.length) {
      const { data: extra } = await supabaseAdmin
        .from('profiles')
        .select('id, name, username, avatar, settings')
        .in('id', missing)
      for (const p of extra || []) profileMap[p.id] = p
    }

    // Community members + own public routines always visible; others only if profilePublic
    const filtered = (data || []).filter((row) => {
      if (row.user_id === req.user.id) return true
      if (communityIds.includes(row.user_id)) return true
      return profileMap[row.user_id]?.settings?.privacy?.profilePublic === true
    })

    res.json(
      filtered.map((row) => {
        const owner = profileMap[row.user_id]
          ? {
              id: row.user_id,
              name: profileMap[row.user_id].name,
              username: profileMap[row.user_id].username || null,
              avatar: profileMap[row.user_id].avatar
            }
          : null
        return mapRoutine(row, owner, owner)
      })
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al explorar rutinas', error: error.message })
  }
})

router.post('/routines', authenticate, async (req, res) => {
  try {
    const { name, exercises, color, isPublic, localId, id, days, markCollaborator } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Nombre requerido' })

    const payload = {
      user_id: req.user.id,
      name: name.trim(),
      exercises: exercises || [],
      color: color || 'primary',
      days: normalizeDays(days),
      is_public: Boolean(isPublic),
      local_id: localId || null,
      updated_at: new Date().toISOString()
    }
    const forceCollab = markCollaborator === true || markCollaborator === 'true'
    const bodySourceId = req.body?.sourceRoutineId || req.body?.source_routine_id || null
    const bodyCreatorId = req.body?.originalCreatorId || req.body?.original_creator_id || null

    const insertPayload = {
      ...payload,
      original_creator_id: bodyCreatorId || req.user.id,
      ...(bodySourceId
        ? {
            source_routine_id: bodySourceId,
            is_edited_fork: Boolean(forceCollab),
            collaborator_at: forceCollab ? new Date().toISOString() : null
          }
        : {})
    }

    const buildUpdatePayload = async (existing) => {
      const repair = provenanceRepairPatch(existing, req.body, req.user.id)
      const merged = { ...existing, ...repair }
      const sourceId =
        repair.source_routine_id ||
        existing?.source_routine_id ||
        bodySourceId ||
        null
      let exercises = preserveExerciseOrigins(payload.exercises, existing?.exercises)
      if (sourceId) {
        exercises = await healMissingExerciseOrigins(exercises, sourceId)
      }
      const contentChanged =
        String(existing?.name || '') !== String(payload.name || '') ||
        stableExercisesKey(existing?.exercises) !== stableExercisesKey(exercises)

      let collabFinal = null
      if (sourceId && (forceCollab || contentChanged)) {
        collabFinal = collaboratorPatchForRow(merged, req.user.id, {
          force: true,
          sourceRoutineId: sourceId
        })
      } else if (sourceId && existing?.is_edited_fork) {
        collabFinal = { is_edited_fork: true }
      }
      return {
        ...payload,
        exercises,
        ...repair,
        ...(collabFinal || {})
      }
    }

    let row
    if (id) {
      const { data: existing } = await supabaseAdmin
        .from('workout_routines')
        .select('*')
        .eq('id', id)
        .eq('user_id', req.user.id)
        .maybeSingle()
      if (!existing) return res.status(404).json({ message: 'Rutina no encontrada' })
      const updatePayload = await buildUpdatePayload(existing)
      const { data, error } = await supabaseAdmin
        .from('workout_routines')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', req.user.id)
        .select('*')
        .maybeSingle()
      if (error) {
        if (/is_edited_fork|collaborator_at|source_routine_id|original_creator_id/i.test(String(error.message || ''))) {
          const retry = await supabaseAdmin
            .from('workout_routines')
            .update(payload)
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select('*')
            .maybeSingle()
          if (retry.error) throw retry.error
          row = retry.data
        } else {
          throw error
        }
      } else {
        row = data
      }
    } else if (localId) {
      const { data: existing } = await supabaseAdmin
        .from('workout_routines')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('local_id', localId)
        .maybeSingle()

      if (existing?.id) {
        const updatePayload = await buildUpdatePayload(existing)
        const { data, error } = await supabaseAdmin
          .from('workout_routines')
          .update(updatePayload)
          .eq('id', existing.id)
          .select('*')
          .single()
        if (error) {
          if (/is_edited_fork|collaborator_at|source_routine_id|original_creator_id/i.test(String(error.message || ''))) {
            const retry = await supabaseAdmin
              .from('workout_routines')
              .update(payload)
              .eq('id', existing.id)
              .select('*')
              .single()
            if (retry.error) throw retry.error
            row = retry.data
          } else {
            throw error
          }
        } else {
          row = data
        }
      } else {
        const { data, error } = await supabaseAdmin
          .from('workout_routines')
          .insert(insertPayload)
          .select('*')
          .single()
        if (error) throw error
        row = data
      }
    } else {
      const { data, error } = await supabaseAdmin
        .from('workout_routines')
        .insert(insertPayload)
        .select('*')
        .single()
      if (error) throw error
      row = data
    }

    // Enrich creator for adopted forks
    let creator = null
    if (row?.original_creator_id) {
      const profiles = await loadProfilesMap([row.original_creator_id])
      creator = profiles[row.original_creator_id] || null
    }
    res.status(201).json(mapRoutine(row, null, creator))
  } catch (error) {
    const msg = String(error.message || '')
    if (msg.toLowerCase().includes('days') && req.body) {
      try {
        const { name, exercises, color, isPublic, localId, id } = req.body
        const payload = {
          user_id: req.user.id,
          name: String(name || '').trim(),
          exercises: exercises || [],
          color: color || 'primary',
          is_public: Boolean(isPublic),
          local_id: localId || null,
          updated_at: new Date().toISOString()
        }
        let row
        if (id) {
          const retry = await supabaseAdmin
            .from('workout_routines')
            .update(payload)
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select('*')
            .maybeSingle()
          if (retry.error) throw retry.error
          row = retry.data
        } else {
          const retry = await supabaseAdmin.from('workout_routines').insert(payload).select('*').single()
          if (retry.error) throw retry.error
          row = retry.data
        }
        return res.status(201).json(mapRoutine(row))
      } catch (retryErr) {
        return res.status(500).json({ message: 'Error al guardar rutina', error: retryErr.message })
      }
    }
    res.status(500).json({ message: 'Error al guardar rutina', error: error.message })
  }
})

router.put('/routines/:id', authenticate, async (req, res) => {
  try {
    const { name, exercises, color, isPublic, localId, days } = req.body
    const { data: existing } = await supabaseAdmin
      .from('workout_routines')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle()
    if (!existing) return res.status(404).json({ message: 'Rutina no encontrada' })

    const updateData = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name
    if (exercises !== undefined) updateData.exercises = exercises
    if (color !== undefined) updateData.color = color
    if (days !== undefined) updateData.days = normalizeDays(days)
    if (isPublic !== undefined) updateData.is_public = Boolean(isPublic)
    if (localId !== undefined) updateData.local_id = localId

    const collab = collaboratorPatchForRow(existing, req.user.id)
    if (collab) Object.assign(updateData, collab)

    const { data, error } = await supabaseAdmin
      .from('workout_routines')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Rutina no encontrada' })
    let creator = null
    if (data.original_creator_id) {
      const profiles = await loadProfilesMap([data.original_creator_id])
      creator = profiles[data.original_creator_id] || null
    }
    res.json(mapRoutine(data, null, creator))
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar rutina', error: error.message })
  }
})

router.delete('/routines/:id', authenticate, async (req, res) => {
  try {
    const { data: existing, error: findErr } = await supabaseAdmin
      .from('workout_routines')
      .select('id, source_routine_id, is_edited_fork')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle()
    if (findErr) throw findErr
    if (!existing) return res.status(404).json({ message: 'Rutina no encontrada' })

    const { data, error } = await supabaseAdmin
      .from('workout_routines')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Rutina no encontrada' })

    // Leave GymRat count on the original when an adoption is removed
    if (existing.source_routine_id) {
      try {
        const { data: source } = await supabaseAdmin
          .from('workout_routines')
          .select('id, adopt_count')
          .eq('id', existing.source_routine_id)
          .maybeSingle()
        if (source) {
          const next = Math.max(0, (Number(source.adopt_count) || 0) - 1)
          await supabaseAdmin
            .from('workout_routines')
            .update({ adopt_count: next, updated_at: new Date().toISOString() })
            .eq('id', source.id)
        }
      } catch (countErr) {
        console.warn('adopt_count decrement failed:', countErr?.message || countErr)
      }
    }

    res.json({
      message: 'Rutina eliminada',
      removedAdoption: Boolean(existing.source_routine_id),
      removedCollaborator: Boolean(existing.is_edited_fork)
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar rutina', error: error.message })
  }
})

/** View a collaborator (edited) fork — not adoptable.
 * Registered before `/routines/:id/...` variants that could steal the path.
 */
router.get('/routines/fork/:forkId', authenticate, async (req, res) => {
  try {
    const forkId = req.params.forkId
    if (!forkId || forkId === 'undefined' || forkId === 'null') {
      return res.status(400).json({ message: 'Versión no válida' })
    }

    const { data: fork, error } = await supabaseAdmin
      .from('workout_routines')
      .select('*')
      .eq('id', forkId)
      .maybeSingle()
    if (error) throw error
    if (!fork) return res.status(404).json({ message: 'Versión no encontrada' })

    let source = null
    if (fork.source_routine_id) {
      const { data } = await supabaseAdmin
        .from('workout_routines')
        .select('*')
        .eq('id', fork.source_routine_id)
        .maybeSingle()
      source = data
    }

    // Heal missing source link via adopt notifications
    if (!source) {
      try {
        const { data: notes } = await supabaseAdmin
          .from('notifications')
          .select('related_data')
          .eq('type', 'routine_adopted')
          .contains('related_data', { adoptedRoutineId: fork.id })
          .limit(1)
        const sourceId = notes?.[0]?.related_data?.routineId
        if (sourceId) {
          const { data } = await supabaseAdmin
            .from('workout_routines')
            .select('*')
            .eq('id', sourceId)
            .maybeSingle()
          source = data
          if (source) {
            await supabaseAdmin
              .from('workout_routines')
              .update({
                source_routine_id: source.id,
                original_creator_id: fork.original_creator_id || source.original_creator_id || source.user_id
              })
              .eq('id', fork.id)
            fork.source_routine_id = source.id
          }
        }
      } catch {
        /* ignore heal */
      }
    }

    // Owner viewing own fork
    if (fork.user_id === req.user.id) {
      // Heal exercise origin metadata for better labels
      if (source?.id) {
        const healed = await healMissingExerciseOrigins(fork.exercises || [], source.id)
        if (JSON.stringify(healed) !== JSON.stringify(fork.exercises || [])) {
          await supabaseAdmin.from('workout_routines').update({ exercises: healed }).eq('id', fork.id)
          fork.exercises = healed
        }
      }
      const profiles = await loadProfilesMap([fork.original_creator_id || fork.user_id, fork.user_id])
      const editor = profiles[fork.user_id] || null
      const creator = profiles[fork.original_creator_id || source?.user_id || fork.user_id] || editor
      return res.json(buildForkViewPayload(fork, source, editor, creator))
    }

    if (!source) {
      return res.status(403).json({ message: 'Esta versión no está disponible' })
    }

    const allowed = await canAccessOwnerRoutines(req.user.id, source.user_id)
    if (!allowed && !source.is_public) {
      return res.status(403).json({ message: 'No tienes acceso a esta versión' })
    }

    // Heal origins on fork so labels work for legacy adoptions
    {
      const healed = await healMissingExerciseOrigins(fork.exercises || [], source.id)
      if (JSON.stringify(healed) !== JSON.stringify(fork.exercises || [])) {
        try {
          await supabaseAdmin.from('workout_routines').update({ exercises: healed }).eq('id', fork.id)
          fork.exercises = healed
        } catch {
          fork.exercises = healed
        }
      }
    }

    const profiles = await loadProfilesMap([
      fork.user_id,
      fork.original_creator_id || source.user_id,
      source.user_id
    ])
    const editor = profiles[fork.user_id] || null
    const creator = profiles[fork.original_creator_id || source.user_id] || profiles[source.user_id] || null

    res.json(buildForkViewPayload(fork, source, editor, creator))
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar versión', error: error.message })
  }
})

/** GymRats who adopted this public routine and edited their copy (collaborators). */
router.get('/routines/:id/collaborators', authenticate, async (req, res) => {
  try {
    const { data: source, error } = await supabaseAdmin
      .from('workout_routines')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()
    if (error) throw error
    if (!source) return res.status(404).json({ message: 'Rutina no encontrada' })

    const allowed = await canAccessOwnerRoutines(req.user.id, source.user_id)
    if (!allowed && !source.is_public) {
      return res.status(403).json({ message: 'No tienes acceso a esta rutina' })
    }
    // If this row is itself a fork, resolve collaborators on the original
    let root = source
    if (source.source_routine_id) {
      const { data: original } = await supabaseAdmin
        .from('workout_routines')
        .select('*')
        .eq('id', source.source_routine_id)
        .maybeSingle()
      if (!original) return res.json({ collaborators: [] })
      root = original
    }

    const forkById = new Map()

    const ingestForks = (rows) => {
      for (const f of rows || []) {
        if (!f?.id || f.user_id === root.user_id) continue
        forkById.set(f.id, f)
      }
    }

    // Primary: forks linked by source_routine_id
    {
      const result = await supabaseAdmin
        .from('workout_routines')
        .select(
          'id, user_id, name, exercises, collaborator_at, updated_at, created_at, is_edited_fork, source_routine_id, original_creator_id'
        )
        .eq('source_routine_id', root.id)
        .order('updated_at', { ascending: false })
        .limit(100)

      if (result.error) {
        if (!/is_edited_fork|collaborator_at|source_routine_id|exercises/i.test(String(result.error.message || ''))) {
          throw result.error
        }
        // Fallback without optional columns
        const fallback = await supabaseAdmin
          .from('workout_routines')
          .select('id, user_id, name, exercises, updated_at, created_at, source_routine_id')
          .eq('source_routine_id', root.id)
          .order('updated_at', { ascending: false })
          .limit(100)
        if (fallback.error) {
          if (/source_routine_id/i.test(String(fallback.error.message || ''))) {
            return res.json({ collaborators: [] })
          }
          throw fallback.error
        }
        ingestForks(fallback.data)
      } else {
        ingestForks(result.data)
      }
    }

    // Heal from adopt notifications (covers copies that lost source_routine_id)
    try {
      const { data: notes } = await supabaseAdmin
        .from('notifications')
        .select('related_data, related_user_id')
        .eq('type', 'routine_adopted')
        .eq('user_id', root.user_id)
        .order('created_at', { ascending: false })
        .limit(80)

      const adoptedIds = []
      for (const n of notes || []) {
        const rid = n.related_data?.routineId
        const aid = n.related_data?.adoptedRoutineId
        if (rid && String(rid) === String(root.id) && aid) adoptedIds.push(aid)
      }
      const missing = [...new Set(adoptedIds)].filter((id) => !forkById.has(id))
      if (missing.length) {
        const { data: orphans } = await supabaseAdmin
          .from('workout_routines')
          .select(
            'id, user_id, name, exercises, collaborator_at, updated_at, created_at, is_edited_fork, source_routine_id, original_creator_id'
          )
          .in('id', missing)
        for (const row of orphans || []) {
          // Repair provenance so future queries work
          if (!row.source_routine_id) {
            try {
              await supabaseAdmin
                .from('workout_routines')
                .update({
                  source_routine_id: root.id,
                  original_creator_id: row.original_creator_id || root.original_creator_id || root.user_id
                })
                .eq('id', row.id)
              row.source_routine_id = root.id
            } catch {
              /* ignore */
            }
          }
          ingestForks([row])
        }
      }
    } catch (healErr) {
      console.warn('collaborator notification heal skipped:', healErr?.message || healErr)
    }

    const collaborated = []
    for (const f of forkById.values()) {
      const looksEdited = forkLooksEdited(f, root)
      if (!looksEdited) continue

      // Heal exercise origins for accurate client-side labels even before fork GET
      try {
        const healed = await healMissingExerciseOrigins(f.exercises || [], root.id)
        f.exercises = healed
      } catch {
        /* ignore */
      }

      if (!f.is_edited_fork) {
        try {
          await supabaseAdmin
            .from('workout_routines')
            .update({
              is_edited_fork: true,
              collaborator_at: f.collaborator_at || f.updated_at || new Date().toISOString(),
              source_routine_id: f.source_routine_id || root.id,
              exercises: f.exercises
            })
            .eq('id', f.id)
          f.is_edited_fork = true
        } catch {
          /* ignore heal errors */
        }
      }
      collaborated.push(f)
    }

    const profiles = await loadProfilesMap(collaborated.map((f) => f.user_id))
    const me = req.user.id
    const list = collaborated.map((f) => {
      const u = profiles[f.user_id]
      const annotated = annotateForkExercises(f.exercises || [], root.exercises || [])
      return {
        forkId: f.id,
        routineId: f.id,
        name: f.name,
        exercises: annotated,
        collaboratorAt: f.collaborator_at || f.updated_at,
        isMe: f.user_id === me,
        forkView: true,
        user: u
          ? {
              _id: u.id,
              id: u.id,
              name: u.name,
              username: u.username || null,
              avatar: u.avatar
            }
          : { _id: f.user_id, id: f.user_id, name: 'Usuario', username: null, avatar: null }
      }
    })

    list.sort((a, b) => {
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1
      const at = a.collaboratorAt ? new Date(a.collaboratorAt).getTime() : 0
      const bt = b.collaboratorAt ? new Date(b.collaboratorAt).getTime() : 0
      return bt - at
    })

    res.json({ collaborators: list, sourceRoutineId: root.id })
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar colaboradores', error: error.message })
  }
})

router.post('/routines/:id/adopt', authenticate, async (req, res) => {
  try {
    const { data: source, error } = await supabaseAdmin
      .from('workout_routines')
      .select('*')
      .eq('id', req.params.id)
      .eq('is_public', true)
      .maybeSingle()
    if (error) throw error
    if (!source) return res.status(404).json({ message: 'Rutina no disponible' })

    if (source.source_routine_id || source.is_edited_fork) {
      return res.status(400).json({
        message:
          'Esta versión colaborativa no se puede adoptar. Adopta la rutina original del creador.'
      })
    }

    // One adoption per user per source routine
    const { data: alreadyRows, error: alreadyErr } = await supabaseAdmin
      .from('workout_routines')
      .select('id, name, is_edited_fork, local_id')
      .eq('user_id', req.user.id)
      .eq('source_routine_id', source.id)
      .limit(1)
    if (alreadyErr && !/source_routine_id/i.test(String(alreadyErr.message || ''))) {
      throw alreadyErr
    }
    const already = Array.isArray(alreadyRows) ? alreadyRows[0] : null
    if (already) {
      return res.status(409).json({
        code: 'ALREADY_ADOPTED',
        message:
          'Ya adoptaste esta rutina. Elimínala en Entrenos si quieres volver a adoptarla.',
        existingId: already.id,
        existingLocalId: already.local_id || null,
        isEditedFork: Boolean(already.is_edited_fork),
        name: already.name
      })
    }

    // Privacy: community OR public profile
    if (source.user_id !== req.user.id) {
      const communityIds = await getCommunityUserIds(req.user.id)
      if (!communityIds.includes(source.user_id)) {
        const { data: owner } = await supabaseAdmin
          .from('profiles')
          .select('settings')
          .eq('id', source.user_id)
          .maybeSingle()
        if (owner?.settings?.privacy?.profilePublic !== true) {
          return res.status(403).json({ message: 'No tienes acceso a esta rutina' })
        }
      }
    }

    const originalCreatorId = source.original_creator_id || source.user_id
    const adoptedExercises = stampAdoptedExercises(source.exercises || [])

    const payload = {
      user_id: req.user.id,
      name: source.name,
      exercises: adoptedExercises,
      color: source.color || 'primary',
      is_public: false,
      local_id: `adopted-${Date.now()}`,
      source_routine_id: source.id,
      original_creator_id: originalCreatorId,
      updated_at: new Date().toISOString()
    }

    const { data, error: insertError } = await supabaseAdmin
      .from('workout_routines')
      .insert(payload)
      .select('*')
      .single()

    let row = data
    let finalError = insertError
    if (insertError && /source_routine_id|original_creator_id|adopt_count/i.test(String(insertError.message || ''))) {
      const legacy = {
        user_id: req.user.id,
        name: source.name,
        exercises: adoptedExercises,
        color: source.color || 'primary',
        is_public: false,
        local_id: `adopted-${Date.now()}`,
        updated_at: new Date().toISOString()
      }
      const retry = await supabaseAdmin.from('workout_routines').insert(legacy).select('*').single()
      row = retry.data
      finalError = retry.error
    }
    if (finalError) throw finalError

    try {
      await supabaseAdmin
        .from('workout_routines')
        .update({
          adopt_count: (Number(source.adopt_count) || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', source.id)
    } catch (countErr) {
      console.warn('adopt_count update failed:', countErr?.message || countErr)
    }

    if (originalCreatorId && originalCreatorId !== req.user.id) {
      const adopterName = req.user.username
        ? `@${req.user.username}`
        : req.user.name || 'Un GymRat'
      try {
        await notifyUser({
          userId: originalCreatorId,
          type: 'routine_adopted',
          title: 'Nuevo GymRat en tu rutina',
          body: `${adopterName} adoptó tu rutina «${source.name}». ¡Ahora entrenan juntos!`,
          icon: '💪',
          relatedUserId: req.user.id,
          relatedData: {
            routineId: source.id,
            adoptedRoutineId: row.id,
            routineName: source.name
          },
          priority: 'normal',
          pushTag: `routine-adopt-${source.id}-${req.user.id}`,
          pushUrl: '/workouts'
        })
      } catch (notifyErr) {
        console.warn('routine adopt notify failed:', notifyErr?.message || notifyErr)
      }
    }

    const profiles = await loadProfilesMap([originalCreatorId])
    res.status(201).json(mapRoutine(row, null, profiles[originalCreatorId] || null))
  } catch (error) {
    res.status(500).json({ message: 'Error al adoptar rutina', error: error.message })
  }
})

router.get('/history', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workouts')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    res.json((data || []).map(mapWorkout))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener historial', error: error.message })
  }
})

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, exercises, duration, notes, metrics, durationSeconds } = req.body

    const payload = {
      user_id: req.user.id,
      name,
      exercises: exercises || [],
      duration: duration ?? (durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : 0),
      notes: notes || null,
      completed_at: new Date().toISOString()
    }

    const metricsPayload = metrics || null
    if (metricsPayload) {
      payload.metrics = metricsPayload
      // Fallback if metrics column missing: embed in notes
      if (!payload.notes) {
        payload.notes = JSON.stringify({ metrics: metricsPayload })
      }
    }

    let workout
    let { data, error } = await supabaseAdmin
      .from('workouts')
      .insert(payload)
      .select('*')
      .single()

    // Retry without metrics column if schema not migrated yet
    if (error && String(error.message || '').toLowerCase().includes('metrics')) {
      const fallback = { ...payload }
      delete fallback.metrics
      fallback.notes = JSON.stringify({
        metrics: metricsPayload || {},
        note: notes || ''
      })
      const retry = await supabaseAdmin.from('workouts').insert(fallback).select('*').single()
      data = retry.data
      error = retry.error
    }

    if (error) throw error
    workout = data

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single()

    const stats = { ...(profile.stats || {}) }
    stats.totalWorkouts = (stats.totalWorkouts || 0) + 1

    const { data: lastWorkouts } = await supabaseAdmin
      .from('workouts')
      .select('created_at')
      .eq('user_id', req.user.id)
      .neq('id', workout.id)
      .order('created_at', { ascending: false })
      .limit(1)

    const lastWorkout = lastWorkouts?.[0]
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

    if (!lastWorkout || new Date(lastWorkout.created_at) >= yesterday) {
      stats.currentStreak = (stats.currentStreak || 0) + 1
      if (stats.currentStreak > (stats.longestStreak || 0)) {
        stats.longestStreak = stats.currentStreak
      }
    } else {
      stats.currentStreak = 1
    }

    await supabaseAdmin
      .from('profiles')
      .update({ stats, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)

    const { awardXP, checkBadgeUnlocks } = await import('../services/xpService.js')
    let xpResult = null
    let unlockedBadges = []
    try {
      xpResult = await awardXP(req.user.id, 50, `Completaste el entrenamiento: ${name}`, false)
      unlockedBadges = await checkBadgeUnlocks(req.user.id, false)
    } catch (xpError) {
      console.error('Error awarding XP:', xpError)
    }

    const { data: updatedUser } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single()

    res.status(201).json({
      workout: mapWorkout(workout),
      stats: updatedUser.stats,
      xpAwarded: 50,
      leveledUp: xpResult?.leveledUp || false,
      unlockedBadges: unlockedBadges.map((b) => ({ id: b.id, name: b.name, icon: b.icon })),
      message: '¡Entrenamiento registrado!'
    })
  } catch (error) {
    console.error('Workout error:', error)
    res.status(500).json({ message: 'Error al registrar entrenamiento', error: error.message })
  }
})

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workouts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) return res.status(404).json({ message: 'Entrenamiento no encontrado' })
    res.json(mapWorkout(data))
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workouts')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle()

    if (error || !data) return res.status(404).json({ message: 'Entrenamiento no encontrado' })
    res.json({ message: 'Entrenamiento eliminado' })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

export default router
