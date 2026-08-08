import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiX, FiUsers, FiInfo, FiPlus, FiChevronLeft } from 'react-icons/fi'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Avatar } from '../utils/avatarUtils'
import toast from 'react-hot-toast'
import api from '../utils/api'

const WORKOUT_TEMPLATES_KEY = 'qyntra:workout_templates'

function hasLocalAdoption(sourceId) {
  if (!sourceId) return false
  try {
    const stored = JSON.parse(localStorage.getItem(WORKOUT_TEMPLATES_KEY) || '[]')
    if (!Array.isArray(stored)) return false
    return stored.some((t) => String(t?.sourceRoutineId || '') === String(sourceId))
  } catch {
    return false
  }
}

/** Prefer local edited copy when viewing your own collaborator bubble (server may lag). */
function findLocalForkTemplate(forkId, sourceRoutineId) {
  try {
    const stored = JSON.parse(localStorage.getItem(WORKOUT_TEMPLATES_KEY) || '[]')
    if (!Array.isArray(stored)) return null
    return (
      stored.find((t) => forkId && String(t.serverId || '') === String(forkId)) ||
      stored.find(
        (t) =>
          sourceRoutineId &&
          String(t.sourceRoutineId || '') === String(sourceRoutineId) &&
          (t.isEditedFork || Array.isArray(t.exercises))
      ) ||
      null
    )
  } catch {
    return null
  }
}

function creatorDisplayName(user) {
  if (!user) return 'Usuario'
  if (user.username) return `@${user.username}`
  return user.name || 'Usuario'
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function exerciseChanged(a, b) {
  if (!a || !b) return true
  return (
    String(a.name || '').trim() !== String(b.name || '').trim() ||
    Number(a.sets ?? a.setsCompleted) !== Number(b.sets ?? b.setsCompleted) ||
    String(a.reps ?? '') !== String(b.reps ?? '')
  )
}

/** Tag exercises vs author original (client-side fallback). */
function annotateExercises(forkExercises, sourceExercises = []) {
  const sourceList = Array.isArray(sourceExercises) ? sourceExercises : []
  const byId = new Map()
  const byName = new Map()
  for (const ex of sourceList) {
    if (ex?.id) byId.set(String(ex.id), ex)
    if (ex?.originExerciseId) byId.set(String(ex.originExerciseId), ex)
    const key = normalizeName(ex?.name)
    if (key && !byName.has(key)) byName.set(key, ex)
  }
  const used = new Set()

  return (Array.isArray(forkExercises) ? forkExercises : []).map((ex, index) => {
    if (ex?.provenance && ex?.provenanceLabel) return ex

    let baseline = null
    if (ex?.originSnapshot) {
      baseline = ex.originSnapshot
    } else {
      const oid = ex?.originExerciseId || ex?.id
      if (oid && byId.has(String(oid))) {
        baseline = byId.get(String(oid))
        used.add(String(oid))
      } else {
        const key = normalizeName(ex?.name)
        const match = key ? byName.get(key) : null
        if (match) {
          const mid = String(match.id || match.originExerciseId || key)
          if (!used.has(mid)) {
            baseline = match
            used.add(mid)
          }
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
      id: ex?.id || `ex-${index}`,
      provenance,
      provenanceLabel
    }
  })
}

function provenanceBadgeClass(provenance) {
  if (provenance === 'collaborator') {
    return 'border-[rgba(var(--color-primary-rgb),0.45)] bg-[rgba(var(--color-primary-rgb),0.14)] text-[color:var(--color-primary)]'
  }
  if (provenance === 'edited') {
    return 'border-amber-400/50 bg-amber-400/15 text-amber-700 dark:text-amber-300'
  }
  return 'border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]'
}

function ExerciseList({ exercises, showProvenance }) {
  return (
    <ul className="space-y-2">
      {(exercises || []).map((ex, i) => {
        const provenance = showProvenance ? ex.provenance || null : null
        const label = showProvenance
          ? ex.provenanceLabel ||
            (provenance === 'collaborator'
              ? 'Colaborador'
              : provenance === 'edited'
                ? 'Editada'
                : provenance === 'author'
                  ? 'Autor'
                  : null)
          : null
        return (
          <li
            key={`${ex.id || 'ex'}-${i}`}
            className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/50 px-4 py-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.15)] text-sm font-bold text-[color:var(--color-primary)]">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 break-words font-medium">{ex.name}</p>
                {label ? (
                  <span
                    className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${provenanceBadgeClass(provenance || 'author')}`}
                  >
                    {label}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[color:var(--text-muted)]">
                {ex.sets ?? ex.setsCompleted ?? '—'} series · {ex.reps ?? '—'} reps
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Modal to inspect a shared/public routine, with GymRat explain + adopt action.
 * Scroll uses plain DOM (no framer transform on the sheet) so touch scrolling works.
 */
export default function RoutineDetailModal({
  open,
  onClose,
  routine,
  author,
  onAdopt,
  adopting = false,
  canAdopt: canAdoptProp,
  collaborators: collaboratorsProp = null,
  subtitle = null
}) {
  const [showGymRatInfo, setShowGymRatInfo] = useState(false)
  const [collaborators, setCollaborators] = useState([])
  const [loadingCollabs, setLoadingCollabs] = useState(false)
  const [viewingFork, setViewingFork] = useState(null)
  const [loadingFork, setLoadingFork] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setShowGymRatInfo(false)
      setViewingFork(null)
      setCollaborators([])
      setLoadingFork(false)
    }
  }, [open])

  // Scroll active list to top when switching original ↔ fork
  useEffect(() => {
    if (!open) return
    const el = scrollRef.current
    if (el) el.scrollTop = 0
  }, [open, viewingFork?.id, viewingFork?._id])

  useEffect(() => {
    if (!open) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open || !routine || viewingFork) return undefined
    if (Array.isArray(collaboratorsProp)) {
      setCollaborators(collaboratorsProp)
      return undefined
    }
    const id = routine.id || routine._id
    if (!id || routine.sourceRoutineId || routine.isEditedFork || routine.isCollaboratorVersion) {
      setCollaborators([])
      return undefined
    }

    let cancelled = false
    setLoadingCollabs(true)
    ;(async () => {
      try {
        const { data } = await api.get(`/workouts/routines/${id}/collaborators`)
        if (!cancelled) setCollaborators(Array.isArray(data?.collaborators) ? data.collaborators : [])
      } catch {
        if (!cancelled) setCollaborators([])
      } finally {
        if (!cancelled) setLoadingCollabs(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    open,
    routine?.id,
    routine?._id,
    routine?.sourceRoutineId,
    routine?.isEditedFork,
    routine?.isCollaboratorVersion,
    collaboratorsProp,
    viewingFork
  ])

  const openCollaborator = async (item) => {
    const forkId = item?.forkId || item?.routineId
    if (!forkId) {
      toast.error('No se encontró la versión del colaborador')
      return
    }

    const sourceRoutineId = routine?.id || routine?._id || null
    const originalCreator = author || routine?.user || routine?.originalCreator || null
    const localTpl = item.isMe ? findLocalForkTemplate(forkId, sourceRoutineId) : null

    const listExercises = Array.isArray(item.exercises) ? item.exercises : []
    const localExercises = Array.isArray(localTpl?.exercises) ? localTpl.exercises : []
    // Prefer the richest available set (local edits often outpace server)
    const preferred =
      localExercises.length >= listExercises.length && localExercises.length > 0
        ? localExercises
        : listExercises

    const immediate = {
      id: forkId,
      _id: forkId,
      name: localTpl?.name || item.name || 'Versión de colaborador',
      exercises: annotateExercises(preferred, routine?.exercises || []),
      isCollaboratorVersion: true,
      isEditedFork: true,
      forkView: true,
      canAdopt: false,
      sourceRoutineId,
      originalCreator,
      editor: item.user || null,
      user: item.user || null,
      fromLocal: Boolean(localTpl && localExercises.length)
    }

    setViewingFork(immediate)
    setLoadingFork(true)

    try {
      const { data } = await api.get(`/workouts/routines/fork/${encodeURIComponent(forkId)}`)
      const serverExercises = Array.isArray(data?.exercises) ? data.exercises : []

      // If this is my bubble and local has more / different content, keep local truth and push server later
      let finalExercises = serverExercises
      if (item.isMe && localExercises.length) {
        const localBigger = localExercises.length > serverExercises.length
        const localDiffers =
          JSON.stringify(localExercises.map((e) => [e.name, e.sets, e.reps])) !==
          JSON.stringify(serverExercises.map((e) => [e.name, e.sets, e.reps]))
        if (localBigger || localDiffers) {
          finalExercises = localExercises
          // Best-effort sync so next viewers see the real fork
          api
            .post('/workouts/routines', {
              id: forkId,
              localId: localTpl?.id,
              name: localTpl?.name || data?.name || item.name,
              exercises: localExercises,
              color: localTpl?.color || 'primary',
              isPublic: false,
              days: localTpl?.days || [],
              sourceRoutineId,
              originalCreatorId:
                localTpl?.originalCreatorId ||
                originalCreator?.id ||
                originalCreator?._id,
              markCollaborator: true
            })
            .catch(() => {})
        }
      }

      if (!finalExercises.length && preferred.length) finalExercises = preferred

      setViewingFork({
        id: data?.id || data?._id || forkId,
        _id: data?._id || data?.id || forkId,
        name: (item.isMe && localTpl?.name) || data?.name || immediate.name,
        exercises: annotateExercises(finalExercises, routine?.exercises || []),
        isCollaboratorVersion: true,
        isEditedFork: true,
        forkView: true,
        canAdopt: false,
        sourceRoutineId: data?.sourceRoutineId || sourceRoutineId,
        originalCreator: data?.originalCreator || originalCreator,
        editor: data?.editor || item.user || null,
        user: data?.editor || item.user || null,
        stats: data?.stats || null
      })
    } catch (error) {
      if (!immediate.exercises.length) {
        toast.error(error.response?.data?.message || 'No se pudo abrir esta versión')
        setViewingFork(null)
      }
    } finally {
      setLoadingFork(false)
    }
  }

  if (!open || !routine) return null

  const isForkView = Boolean(viewingFork)
  const display = isForkView ? viewingFork : routine
  const exercises = Array.isArray(display?.exercises) ? display.exercises : []
  const creator = isForkView
    ? viewingFork.originalCreator || author || routine.user
    : author || routine.user || routine.author
  const editor = viewingFork?.editor || viewingFork?.user
  const createdLabel = display?.createdAt
    ? formatDistanceToNow(new Date(display.createdAt), { addSuffix: true, locale: es })
    : null
  const showCollaboratorsBlock =
    !isForkView &&
    !routine.sourceRoutineId &&
    !routine.isEditedFork &&
    !routine.isCollaboratorVersion

  const sourceId = routine?.routineId || routine?.id || routine?._id || null
  const alreadyAdopted =
    Boolean(sourceId && hasLocalAdoption(sourceId)) || collaborators.some((c) => c.isMe)

  const canAdopt =
    canAdoptProp !== undefined
      ? canAdoptProp && !alreadyAdopted && !isForkView
      : Boolean(onAdopt) &&
        !alreadyAdopted &&
        !isForkView &&
        !routine?.isEditedFork &&
        !routine?.isCollaboratorVersion &&
        !routine?.sourceRoutineId

  const headerTitle = isForkView ? 'Versión de colaborador' : subtitle || 'Rutina compartida'

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={headerTitle}
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-lg flex-col rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] shadow-2xl sm:rounded-3xl"
        style={{
          height: 'min(92dvh, 720px)',
          maxHeight: 'min(92dvh, 720px)',
          overflow: 'hidden'
        }}
      >
        {/* Header — never scrolls */}
        <div className="shrink-0 border-b border-[color:var(--border-subtle)] px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {isForkView && (
                <button
                  type="button"
                  onClick={() => setViewingFork(null)}
                  className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-primary)]"
                >
                  <FiChevronLeft size={14} /> Volver al original
                </button>
              )}
              <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--color-primary)]">
                {headerTitle}
              </p>
              <h2 className="mt-1 truncate font-display text-2xl tracking-wide sm:text-3xl">
                {display?.name}
              </h2>
              {creator && (
                <div className="mt-2 flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                  <Avatar
                    avatar={creator.avatar}
                    name={creator.name || creator.username}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate">
                      Creada por{' '}
                      <strong className="text-[color:var(--text-primary)]">
                        {creatorDisplayName(creator)}
                      </strong>
                    </p>
                    {(creator.username && creator.name) || createdLabel ? (
                      <p className="truncate text-xs text-[color:var(--text-muted)]">
                        {creator.username && creator.name ? creator.name : null}
                        {creator.username && creator.name && createdLabel ? ' · ' : null}
                        {createdLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
              {isForkView && editor && (
                <p className="mt-1.5 text-xs text-[color:var(--text-muted)]">
                  Editada por{' '}
                  <strong className="text-[color:var(--text-primary)]">
                    {creatorDisplayName(editor)}
                  </strong>
                  {' · '}
                  no se puede adoptar
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]"
            >
              <FiX size={22} />
            </button>
          </div>
        </div>

        {/* Scroll body — plain div, touchAction pan-y */}
        <div
          ref={scrollRef}
          className="px-5 py-4"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain'
          }}
        >
          {loadingFork && (
            <div className="mb-3 flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-[color:var(--color-primary)]" />
              Cargando versión del colaborador…
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--text-muted)]">
              {exercises.length} ejercicios
              {isForkView ? ' · colaborador' : ''}
            </p>
          </div>

          <ExerciseList exercises={exercises} showProvenance={isForkView} />

          {showCollaboratorsBlock && (
            <div className="mt-6 border-t border-[color:var(--border-subtle)] pb-4 pt-5">
              <div className="mb-3 flex items-center gap-2">
                <FiUsers className="text-[color:var(--color-primary)]" size={16} />
                <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
                  Colaboradores GymRat
                </h3>
              </div>
              <p className="mb-3 text-xs text-[color:var(--text-muted)]">
                GymRats que adoptaron y editaron esta rutina. Toca una burbuja para ver su versión.
              </p>
              {loadingCollabs ? (
                <div className="flex justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-[color:var(--color-primary)]" />
                </div>
              ) : collaborators.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[color:var(--border-subtle)] px-3 py-4 text-center text-xs text-[color:var(--text-muted)]">
                  Aún no hay colaboradores que hayan editado esta rutina.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {collaborators.map((item) => {
                    const u = item.user
                    const label = item.isMe ? 'Tú' : creatorDisplayName(u)
                    return (
                      <button
                        key={item.forkId || item.routineId}
                        type="button"
                        disabled={loadingFork}
                        onClick={() => openCollaborator(item)}
                        className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center transition hover:bg-[color:var(--bg-muted)] disabled:opacity-60"
                      >
                        <div className="relative">
                          <Avatar
                            avatar={u?.avatar}
                            name={u?.name || u?.username}
                            size="md"
                          />
                          {item.isMe ? (
                            <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[color:var(--color-primary)] px-1 py-px text-[9px] font-bold text-white">
                              Tú
                            </span>
                          ) : null}
                        </div>
                        <span className="w-full truncate text-[11px] font-semibold text-[color:var(--text-primary)]">
                          {label}
                        </span>
                        <span className="text-[10px] text-[color:var(--text-muted)]">Ver edición</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 space-y-2 border-t border-[color:var(--border-subtle)] px-4 pt-3"
          style={{ paddingBottom: 'max(0.85rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={() => setShowGymRatInfo(true)}
            className="btn-secondary flex w-full items-center justify-center gap-2 py-3"
          >
            <FiUsers /> Rutina GymRat
          </button>
          {canAdopt && onAdopt && (
            <button
              type="button"
              disabled={adopting}
              onClick={onAdopt}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3"
            >
              <FiPlus /> {adopting ? 'Guardando…' : 'Adoptar rutina'}
            </button>
          )}
          {!isForkView && alreadyAdopted && onAdopt && (
            <p className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/60 px-3 py-2.5 text-center text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
              Ya adoptaste esta rutina. Para volver a adoptarla, elimínala primero en Entrenos.
            </p>
          )}
          {isForkView && (
            <p className="text-center text-[11px] text-[color:var(--text-muted)]">
              Las versiones editadas no se pueden adoptar.
            </p>
          )}
        </div>

        {showGymRatInfo && (
          <div
            className="absolute inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
            onClick={() => setShowGymRatInfo(false)}
            role="presentation"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-h-[min(80dvh,520px)] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] p-6 sm:rounded-3xl"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            >
              <div className="mb-3 flex items-center gap-2 text-[color:var(--color-primary)]">
                <FiInfo size={20} />
                <h3 className="font-display text-2xl tracking-wide">¿Qué es GymRat?</h3>
              </div>
              <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">
                GymRat permite compartir rutinas. Si adoptas y editas la de otro, eres colaborador: tu
                versión aparece en la original con etiquetas Autor / Editada / Colaborador. No se puede
                adoptar dos veces la misma rutina.
              </p>
              <button
                type="button"
                className="btn-primary mt-5 w-full"
                onClick={() => {
                  setShowGymRatInfo(false)
                  toast.success('¡Ahora ya sabes qué es GymRat!')
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export function canStartRoutine(routine) {
  return Boolean(routine?.exercises?.length)
}

export function isAdoptedFromOther(routine, meId) {
  if (!routine || !meId) return false
  const creatorId =
    routine.originalCreatorId || routine.originalCreator?.id || routine.originalCreator?._id
  if (!routine.sourceRoutineId || !creatorId) return false
  return String(creatorId) !== String(meId)
}

export function toStartableTemplate(routine) {
  const creator = routine.originalCreator || routine.user || null
  const creatorId =
    routine.originalCreatorId ||
    creator?._id ||
    creator?.id ||
    routine.userId ||
    null
  return {
    id: routine.localId || `adopted-${Date.now()}`,
    name: routine.name,
    color: routine.color || 'primary',
    exercises: (routine.exercises || []).map((ex, i) => {
      const id = ex.id || `ex-${i}-${Date.now()}`
      const sets = Number(ex.sets ?? ex.setsCompleted) || 3
      const reps = ex.reps ?? 10
      return {
        id,
        name: ex.name,
        sets,
        reps,
        originExerciseId: ex.originExerciseId || id,
        originSnapshot: ex.originSnapshot || {
          name: String(ex.name || '').trim(),
          sets,
          reps: String(reps)
        }
      }
    }),
    isPublic: false,
    sourceRoutineId: routine.sourceRoutineId || routine.id || routine._id || null,
    originalCreatorId: creatorId,
    originalCreator: creator
      ? {
          _id: creator._id || creator.id,
          id: creator.id || creator._id,
          name: creator.name || null,
          username: creator.username || null,
          avatar: creator.avatar || null
        }
      : null,
    adoptCount: Number(routine.adoptCount) || 0,
    isEditedFork: Boolean(routine.isEditedFork)
  }
}
