import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPlus,
  FiCheck,
  FiPlay,
  FiX,
  FiTrash2,
  FiSkipForward,
  FiShare2,
  FiEdit2,
  FiCompass,
  FiGlobe,
  FiSearch,
  FiUser,
  FiUsers,
  FiEye,
  FiZap
} from 'react-icons/fi'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import Timer from '../../components/Timer'
import ShareComposerModal from '../../components/ShareComposerModal'
import { useConfetti } from '../../components/Confetti'
import {
  getWorkoutPreferences,
  getWorkoutSession,
  setWorkoutSession,
  clearWorkoutSession,
  getElapsedSeconds,
  getRestRemaining,
  getCurrentExercise,
  formatTime,
  clearWorkoutNotification,
  sendWorkoutNotification
} from '../../utils/workoutSession'
import TutorialHelpButton from '../../components/TutorialHelpButton'
import { TUTORIAL_IDS } from '../../tutorials/registry'
import { useAuthStore } from '../../store/authStore'
import { useAppDialog } from '../../components/AppDialog'
import RoutineDetailModal, { isAdoptedFromOther } from '../../components/RoutineDetailModal'
import QySiAssistant from '../../components/QySiAssistant'
import {
  displayQiSiHandle,
  isQiSiProfile,
  isQiSiRoutine,
  qisiPublicBlockMessage,
  qisiEditBlockMessage,
  qisiEditBlockTitle,
  QISI_HANDLE,
  QISI_NAME
} from '../../utils/qisi'

const WORKOUT_TEMPLATES_KEY = 'qyntra:workout_templates'
const DEFAULT_REST_SECONDS = 60

function gymratCreatorLabel(template, meId) {
  const creator = template?.originalCreator
  const creatorId = template?.originalCreatorId || creator?.id || creator?._id
  if (!creatorId || String(creatorId) === String(meId || '')) {
    if (isQiSiRoutine(template)) return `@${QISI_HANDLE}`
    return null
  }
  if (isQiSiProfile(creator) || isQiSiRoutine(template)) return `@${QISI_HANDLE}`
  if (creator?.username) return `@${displayQiSiHandle(creator.username)}`
  if (creator?.name) return creator.name
  return null
}

function QySiBadgeLabel(template) {
  if (!isQiSiRoutine(template) && !isQiSiProfile(template?.originalCreator)) return null
  return `Adoptada de ${QISI_NAME} · Sistema inteligente Qyntra interno`
}

function mergeServerRoutines(prev, data) {
  const pending = []
  const byKey = new Map()
  prev.forEach((t) => {
    byKey.set(String(t.id), t)
    if (t.serverId) byKey.set(`s:${t.serverId}`, t)
  })

  const merged = prev.map((t) => {
    const match = data.find(
      (r) =>
        String(r.id || r._id) === String(t.serverId || '') ||
        (r.localId && String(r.localId) === String(t.id))
    )
    if (!match) {
      if (t.sourceRoutineId && t.isEditedFork && t.serverId) pending.push(t)
      return t
    }

    const serverId = match.id || match._id || t.serverId
    const sourceRoutineId = match.sourceRoutineId || t.sourceRoutineId || null
    const localEdited = Boolean(t.isEditedFork)
    const serverEdited = Boolean(match.isEditedFork)
    const contentDiverged =
      Boolean(sourceRoutineId) &&
      (String(t.name || '') !== String(match.name || '') ||
        JSON.stringify(t.exercises || []) !== JSON.stringify(match.exercises || []))
    const isEditedFork = serverEdited || localEdited || contentDiverged

    const next = {
      ...t,
      serverId,
      isPublic: match.isPublic ?? t.isPublic,
      sourceRoutineId,
      originalCreatorId: match.originalCreatorId || t.originalCreatorId || null,
      originalCreator: match.originalCreator || t.originalCreator || null,
      adoptCount: match.adoptCount ?? t.adoptCount ?? 0,
      isEditedFork,
      isQiSi: Boolean(match.isQiSi || t.isQiSi || match.sourceKind === 'qisi' || t.sourceKind === 'qisi'),
      sourceKind: match.sourceKind || t.sourceKind || null
    }

    if (sourceRoutineId && isEditedFork && serverId && (!serverEdited || contentDiverged)) {
      pending.push(next)
    }
    return next
  })

  for (const r of data) {
    const sid = String(r.id || r._id || '')
    if (!sid) continue
    const already =
      byKey.has(`s:${sid}`) ||
      (r.localId && byKey.has(String(r.localId))) ||
      merged.some((t) => String(t.serverId || '') === sid)
    if (already) continue
    merged.push({
      id: r.localId || sid,
      name: r.name,
      color: r.color || 'primary',
      exercises: r.exercises || [],
      isPublic: Boolean(r.isPublic),
      days: Array.isArray(r.days) ? r.days : [],
      serverId: sid,
      sourceRoutineId: r.sourceRoutineId || null,
      originalCreatorId: r.originalCreatorId || null,
      originalCreator: r.originalCreator || null,
      adoptCount: Number(r.adoptCount) || 0,
      isEditedFork: Boolean(r.isEditedFork),
      isQiSi: Boolean(r.isQiSi || r.sourceKind === 'qisi'),
      sourceKind: r.sourceKind || null
    })
  }

  return { merged, pending }
}

const WEEK_DAYS = [
  { id: 1, short: 'Lun', full: 'Lunes' },
  { id: 2, short: 'Mar', full: 'Martes' },
  { id: 3, short: 'Mié', full: 'Miércoles' },
  { id: 4, short: 'Jue', full: 'Jueves' },
  { id: 5, short: 'Vie', full: 'Viernes' },
  { id: 6, short: 'Sáb', full: 'Sábado' },
  { id: 0, short: 'Dom', full: 'Domingo' }
]

const COLOR_MAP = {
  primary: 'from-primary-500/30 to-primary-700/10 border-primary-500/30',
  cyan: 'from-cyan-400/25 to-cyan-700/10 border-cyan-400/30',
  purple: 'from-violet-400/25 to-violet-700/10 border-violet-400/30',
  green: 'from-emerald-400/25 to-emerald-700/10 border-emerald-400/30'
}

const defaultTemplates = [
  {
    id: 'workout-1',
    name: 'Pecho y Tríceps',
    color: 'primary',
    days: [1],
    exercises: [
      { id: 'e-1', name: 'Press Banca', sets: 4, reps: 10 },
      { id: 'e-2', name: 'Press Inclinado', sets: 3, reps: 12 },
      { id: 'e-3', name: 'Aperturas', sets: 3, reps: 15 },
      { id: 'e-4', name: 'Fondos', sets: 3, reps: 12 },
      { id: 'e-5', name: 'Extensiones Tríceps', sets: 3, reps: 15 }
    ]
  },
  {
    id: 'workout-2',
    name: 'Espalda y Bíceps',
    color: 'cyan',
    days: [2],
    exercises: [
      { id: 'e-6', name: 'Dominadas', sets: 4, reps: 8 },
      { id: 'e-7', name: 'Remo con Barra', sets: 4, reps: 10 },
      { id: 'e-8', name: 'Jalón al Pecho', sets: 3, reps: 12 },
      { id: 'e-9', name: 'Curl con Barra', sets: 3, reps: 12 },
      { id: 'e-10', name: 'Curl Martillo', sets: 3, reps: 12 }
    ]
  },
  {
    id: 'workout-3',
    name: 'Piernas',
    color: 'purple',
    days: [3, 6],
    exercises: [
      { id: 'e-11', name: 'Sentadillas', sets: 4, reps: 10 },
      { id: 'e-12', name: 'Prensa', sets: 4, reps: 12 },
      { id: 'e-13', name: 'Peso Muerto Rumano', sets: 3, reps: 10 },
      { id: 'e-14', name: 'Extensiones', sets: 3, reps: 15 },
      { id: 'e-15', name: 'Curl Femoral', sets: 3, reps: 12 }
    ]
  },
  {
    id: 'workout-4',
    name: 'Hombros y Core',
    color: 'green',
    days: [4],
    exercises: [
      { id: 'e-16', name: 'Press Militar', sets: 4, reps: 10 },
      { id: 'e-17', name: 'Elevaciones Laterales', sets: 3, reps: 15 },
      { id: 'e-18', name: 'Pájaros', sets: 3, reps: 15 },
      { id: 'e-19', name: 'Plancha', sets: 3, reps: '60s' },
      { id: 'e-20', name: 'Crunch', sets: 3, reps: 20 }
    ]
  }
]

function normalizeDays(days) {
  if (!Array.isArray(days)) return []
  return [...new Set(days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
}

function loadTemplatesFromStorage() {
  try {
    const stored = localStorage.getItem(WORKOUT_TEMPLATES_KEY)
    const source = stored ? JSON.parse(stored) : defaultTemplates
    return source.map((template) => ({
      ...template,
      days: normalizeDays(template.days ?? [])
    }))
  } catch {
    return defaultTemplates.map((template) => ({
      ...template,
      days: normalizeDays(template.days)
    }))
  }
}

function getDayLabel(dayId) {
  return WEEK_DAYS.find((d) => d.id === dayId)?.short || ''
}

function createExerciseId() {
  return `ex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function createWorkoutId() {
  return `wk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function ShareWorkoutPrompt({ workout, onShare, onClose, onViewHistory }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="app-overlay-sheet fixed inset-0 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className="w-full max-w-md rounded-t-3xl border border-app bg-elevated p-5 sm:rounded-3xl sm:p-6"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-app-secondary">Sesión guardada</p>
        <h3 className="mt-2 font-display text-2xl text-app">{workout.name}</h3>
        <p className="mt-2 text-sm text-app-secondary">
          ¿Quieres compartir este entrenamiento en Comunidad para que lo vean quienes te siguen?
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onShare} className="btn-primary flex flex-1 items-center justify-center gap-2 py-3">
            <FiShare2 size={16} /> Compartir
          </button>
          <button type="button" onClick={onViewHistory} className="btn-secondary flex-1 py-3">
            Ver historial
          </button>
        </div>
        <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-sm text-app-secondary hover:text-app">
          Ahora no
        </button>
      </motion.div>
    </motion.div>
  )
}

export default function Workouts() {
  const location = useLocation()
  const navigate = useNavigate()
  const dialog = useAppDialog()
  const me = useAuthStore((s) => s.user)
  const meId = me?._id || me?.id
  const hydrated = useRef(false)
  const restStartedAt = useRef(null)
  const [restHistory, setRestHistory] = useState([])
  const [lastSavedWorkout, setLastSavedWorkout] = useState(null)
  const [showSharePrompt, setShowSharePrompt] = useState(false)
  const [shareTarget, setShareTarget] = useState(null)
  const [previewRoutine, setPreviewRoutine] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [dayFilter, setDayFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  /** During active session: which exercises to show in the checklist */
  const [exerciseListFilter, setExerciseListFilter] = useState('pending') // 'pending' | 'completed'
  const [templates, setTemplates] = useState(loadTemplatesFromStorage)
  const [activeWorkout, setActiveWorkout] = useState(null)

  // Merge GymRat / creator metadata from server into local templates
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/workouts/routines')
        if (cancelled || !Array.isArray(data)) return

        let pendingCollabSync = []
        setTemplates((prev) => {
          const { merged, pending } = mergeServerRoutines(prev, data)
          pendingCollabSync = pending
          return merged
        })

        for (const routine of pendingCollabSync) {
          if (cancelled) break
          try {
            await api.post('/workouts/routines', {
              id: routine.serverId,
              localId: routine.id,
              name: routine.name,
              exercises: routine.exercises,
              color: routine.color || 'primary',
              isPublic: Boolean(routine.isPublic),
              days: Array.isArray(routine.days) ? routine.days : [],
              sourceRoutineId: routine.sourceRoutineId,
              originalCreatorId: routine.originalCreatorId,
              markCollaborator: true
            })
          } catch {
            /* keep local; next visit retries */
          }
        }
      } catch {
        /* offline / schema pending — local list still works */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const [sessionStart, setSessionStart] = useState(null)
  const [restActive, setRestActive] = useState(false)
  const [restRemaining, setRestRemaining] = useState(0)
  const [restEndsAt, setRestEndsAt] = useState(null)
  const [restTotal, setRestTotal] = useState(DEFAULT_REST_SECONDS)
  const [restTimerSource, setRestTimerSource] = useState(null)
  const [completedExercises, setCompletedExercises] = useState([])
  const [workoutTime, setWorkoutTime] = useState(0)
  const [preferences, setPreferences] = useState(
    () =>
      getWorkoutPreferences() || {
        restTimerDefault: DEFAULT_REST_SECONDS,
        autoStartTimer: true
      }
  )

  const todayId = new Date().getDay()

  useEffect(() => {
    const sync = () => {
      const next =
        getWorkoutPreferences() || {
          restTimerDefault: DEFAULT_REST_SECONDS,
          autoStartTimer: true
        }
      setPreferences(next)
    }
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('qyntra:workout-preferences', sync)
    const id = setInterval(sync, 5000)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('qyntra:workout-preferences', sync)
      clearInterval(id)
    }
  }, [])
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [newRoutine, setNewRoutine] = useState({
    name: '',
    exercises: [{ id: createExerciseId(), name: '', sets: 3, reps: 10 }],
    isPublic: false,
    days: []
  })
  const { celebration } = useConfetti()

  useEffect(() => {
    localStorage.setItem(WORKOUT_TEMPLATES_KEY, JSON.stringify(templates))
  }, [templates])

  const dayCounts = useMemo(() => {
    const counts = { all: templates.length }
    WEEK_DAYS.forEach(({ id }) => {
      counts[id] = templates.filter((t) => normalizeDays(t.days).includes(id)).length
    })
    return counts
  }, [templates])

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return templates.filter((template) => {
      const matchesSearch = !query || template.name.toLowerCase().includes(query)
      const matchesDay =
        dayFilter === 'all' || normalizeDays(template.days).includes(Number(dayFilter))
      return matchesSearch && matchesDay
    })
  }, [templates, searchQuery, dayFilter])

  const syncRoutineToServer = async (routine, { remove = false } = {}) => {
    try {
      if (remove && routine.serverId) {
        await api.delete(`/workouts/routines/${routine.serverId}`)
        return null
      }
      const payload = {
        id: routine.serverId || undefined,
        localId: routine.id,
        name: routine.name,
        exercises: routine.exercises,
        color: routine.color || 'primary',
        isPublic: Boolean(routine.isPublic),
        days: normalizeDays(routine.days),
        sourceRoutineId: routine.sourceRoutineId || undefined,
        originalCreatorId: routine.originalCreatorId || undefined,
        markCollaborator: Boolean(routine.isEditedFork),
        sourceKind: routine.sourceKind || undefined,
        isQiSi: Boolean(routine.isQiSi)
      }
      const { data } = await api.post('/workouts/routines', payload)
      return data
    } catch (error) {
      if (error?.response?.data?.code === 'QISI_NOT_PUBLIC') throw error
      console.warn('Routine sync skipped:', error?.response?.data?.message || error.message)
      return null
    }
  }

  // Restore session once — never clear before hydration
  useEffect(() => {
    const saved = getWorkoutSession()
    if (saved?.activeWorkout && saved?.sessionStart) {
      const now = Date.now()
      const restLeft = getRestRemaining(saved, now)
      setActiveWorkout(saved.activeWorkout)
      setSessionStart(saved.sessionStart)
      setCompletedExercises(saved.completedExercises || [])
      setWorkoutTime(getElapsedSeconds(saved, now))
      setRestActive(restLeft > 0)
      setRestEndsAt(restLeft > 0 ? saved.restEndsAt : null)
      setRestRemaining(restLeft)
      setRestTimerSource(saved.restTimerSource || null)
      setRestTotal(saved.restDuration || preferences?.restTimerDefault || DEFAULT_REST_SECONDS)
    }
    hydrated.current = true
  }, [preferences?.restTimerDefault])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const focusExercise = params.get('focus')
    if (activeWorkout && focusExercise) {
      const target = document.getElementById(`workout-exercise-${focusExercise}`)
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeWorkout, location.search])

  // Persist structural session changes only (time/rest derived from absolute clocks)
  useEffect(() => {
    if (!hydrated.current) return
    if (!activeWorkout) {
      clearWorkoutSession()
      return
    }

    const now = Date.now()
    setWorkoutSession({
      activeWorkout,
      sessionStart,
      completedExercises,
      restActive: Boolean(restEndsAt && getRestRemaining({ restEndsAt }, now) > 0),
      restRemaining: restEndsAt ? getRestRemaining({ restEndsAt }, now) : 0,
      restEndsAt,
      restDuration: restTotal,
      restTimerSource,
      workoutTime: getElapsedSeconds({ sessionStart }, now),
      savedAt: new Date().toISOString()
    })
  }, [activeWorkout, sessionStart, completedExercises, restEndsAt, restTimerSource, restTotal])

  // Local clock — derived from absolute timestamps
  useEffect(() => {
    if (!activeWorkout || !sessionStart) return undefined
    const tick = () => {
      const now = Date.now()
      setWorkoutTime(Math.max(0, Math.floor((now - new Date(sessionStart).getTime()) / 1000)))
      if (restEndsAt) {
        const remaining = Math.max(0, Math.ceil((new Date(restEndsAt).getTime() - now) / 1000))
        setRestRemaining(remaining)
        if (remaining <= 0) {
          if (restStartedAt.current && restTimerSource) {
            const elapsed = Math.max(1, Math.round((now - restStartedAt.current) / 1000))
            const planned = restTotal || preferences?.restTimerDefault || DEFAULT_REST_SECONDS
            setRestHistory((prev) => [
              ...prev,
              { afterExerciseId: restTimerSource, seconds: Math.min(elapsed, planned) }
            ])
            restStartedAt.current = null
          }
          setRestActive(false)
          setRestEndsAt(null)
          setRestTimerSource(null)
        }
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [activeWorkout, sessionStart, restEndsAt, restTimerSource, restTotal, preferences?.restTimerDefault])

  const completedCount = completedExercises.length
  const totalExercises = activeWorkout?.exercises?.length || 0
  const progress = totalExercises ? Math.round((completedCount / totalExercises) * 100) : 0
  const pendingCount = Math.max(0, totalExercises - completedCount)
  const currentExercise = useMemo(
    () => getCurrentExercise({ activeWorkout, completedExercises }),
    [activeWorkout, completedExercises]
  )
  const currentIndex = useMemo(() => {
    if (!activeWorkout || !currentExercise) return 0
    return activeWorkout.exercises.findIndex((e) => e.id === currentExercise.id)
  }, [activeWorkout, currentExercise])

  const listedExercises = useMemo(() => {
    if (!activeWorkout?.exercises) return []
    return activeWorkout.exercises
      .map((exercise, index) => ({ exercise, index }))
      .filter(({ exercise }) => {
        const done = completedExercises.includes(exercise.id)
        return exerciseListFilter === 'completed' ? done : !done
      })
  }, [activeWorkout, completedExercises, exerciseListFilter])

  // If pending list empties while filter is pending, keep showing empty pending (user can switch)
  useEffect(() => {
    if (!activeWorkout) {
      setExerciseListFilter('pending')
    }
  }, [activeWorkout])

  const startRest = (exerciseId) => {
    const prefs = getWorkoutPreferences() || preferences
    if (prefs.autoStartTimer === false) return
    const restSeconds = Number(prefs.restTimerDefault) || DEFAULT_REST_SECONDS
    const endsAt = new Date(Date.now() + restSeconds * 1000).toISOString()
    restStartedAt.current = Date.now()
    setRestTotal(restSeconds)
    setRestActive(true)
    setRestEndsAt(endsAt)
    setRestRemaining(restSeconds)
    setRestTimerSource(exerciseId)
  }

  const recordRestIfAny = () => {
    if (restStartedAt.current && restTimerSource) {
      const elapsed = Math.max(1, Math.round((Date.now() - restStartedAt.current) / 1000))
      const planned = restTotal || preferences?.restTimerDefault || DEFAULT_REST_SECONDS
      const actual = Math.min(elapsed, planned)
      setRestHistory((prev) => [
        ...prev,
        { afterExerciseId: restTimerSource, seconds: actual }
      ])
    }
    restStartedAt.current = null
  }

  const clearRestState = () => {
    restStartedAt.current = null
    setRestActive(false)
    setRestEndsAt(null)
    setRestRemaining(0)
    setRestTimerSource(null)
  }

  const skipRest = () => {
    recordRestIfAny()
    clearRestState()
  }

  const toggleExercise = (exerciseId) => {
    const isNowCompleted = !completedExercises.includes(exerciseId)
    setCompletedExercises((prev) => {
      const nextCompleted = isNowCompleted ? [...prev, exerciseId] : prev.filter((id) => id !== exerciseId)
      if (isNowCompleted) {
        startRest(exerciseId)
      } else if (restTimerSource === exerciseId || nextCompleted.length === 0) {
        clearRestState()
      }
      return nextCompleted
    })
  }

  const startWorkout = async (workout) => {
    const start = new Date().toISOString()
    setActiveWorkout(workout)
    setSessionStart(start)
    setCompletedExercises([])
    setWorkoutTime(0)
    setRestHistory([])
    setExerciseListFilter('pending')
    clearRestState()
    await sendWorkoutNotification({
      activeWorkout: workout,
      sessionStart: start,
      completedExercises: [],
      workoutTime: 0
    })
  }

  const cancelWorkout = async () => {
    setActiveWorkout(null)
    setSessionStart(null)
    setCompletedExercises([])
    setWorkoutTime(0)
    setRestHistory([])
    clearRestState()
    await clearWorkoutNotification()
  }

  const finishWorkout = async () => {
    if (!activeWorkout) return
    setSaving(true)
    if (restActive) recordRestIfAny()

    const restSecs = [...restHistory]
    if (restStartedAt.current && restTimerSource) {
      const elapsed = Math.max(1, Math.round((Date.now() - restStartedAt.current) / 1000))
      restSecs.push({ afterExerciseId: restTimerSource, seconds: Math.min(elapsed, restTotal || 60) })
    }

    const bestRestSeconds =
      restSecs.length > 0 ? Math.min(...restSecs.map((r) => r.seconds).filter((n) => n > 0)) : null
    const avgRestSeconds =
      restSecs.length > 0
        ? Math.round(restSecs.reduce((s, r) => s + r.seconds, 0) / restSecs.length)
        : null

    const exercisesPayload = activeWorkout.exercises.map((exercise) => ({
      ...exercise,
      completed: completedExercises.includes(exercise.id),
      setsCompleted: completedExercises.includes(exercise.id) ? exercise.sets : 0
    }))

    const metrics = {
      durationSeconds: workoutTime,
      bestRestSeconds,
      avgRestSeconds,
      restHistory: restSecs,
      completedCount: completedExercises.length
    }

    try {
      const { data } = await api.post('/workouts', {
        name: activeWorkout.name,
        exercises: exercisesPayload,
        duration: Math.max(1, Math.floor(workoutTime / 60)),
        durationSeconds: workoutTime,
        metrics
      })
      celebration()
      toast.success('¡Entrenamiento registrado!')
      const saved = data?.workout || {
        name: activeWorkout.name,
        exercises: exercisesPayload,
        duration: Math.max(1, Math.floor(workoutTime / 60)),
        metrics
      }
      setLastSavedWorkout({
        ...saved,
        isQiSi: Boolean(activeWorkout.isQiSi || activeWorkout.sourceKind === 'qisi'),
        sourceKind: activeWorkout.sourceKind || (activeWorkout.isQiSi ? 'qisi' : undefined)
      })
      setShowSharePrompt(true)
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo guardar el entrenamiento')
    } finally {
      setSaving(false)
      setActiveWorkout(null)
      setSessionStart(null)
      setCompletedExercises([])
      setWorkoutTime(0)
      setRestHistory([])
      skipRest()
      await clearWorkoutNotification()
    }
  }

  const shareLastWorkout = async () => {
    if (!lastSavedWorkout) return
    try {
      const w = lastSavedWorkout
      const metrics = w.metrics || {}
      const completed = (w.exercises || []).filter((e) => e.completed !== false)
      const fromQySi = Boolean(w.isQiSi || w.sourceKind === 'qisi')
      await api.post('/social', {
        content: fromQySi
          ? `Acabo de completar: ${w.name} · Adoptada de ${QISI_NAME} (@${QISI_HANDLE})`
          : `Acabo de completar: ${w.name}`,
        postType: 'workout',
        workoutData: {
          workoutId: w._id || w.id,
          name: w.name,
          completedExercises: completed.length,
          totalExercises: (w.exercises || []).length,
          totalSets: completed.reduce((s, e) => s + (Number(e.setsCompleted ?? e.sets) || 0), 0),
          durationSeconds: metrics.durationSeconds || workoutTime,
          bestRestSeconds: metrics.bestRestSeconds || null,
          isQiSi: fromQySi,
          sourceKind: fromQySi ? 'qisi' : undefined,
          QySiLabel: fromQySi
            ? `Adoptada de ${QISI_NAME} · Sistema inteligente Qyntra interno`
            : undefined,
          exercises: completed.map((e) => ({
            name: e.name,
            sets: e.setsCompleted ?? e.sets,
            reps: e.reps
          }))
        }
      })
      toast.success('Compartido en Comunidad')
      setShowSharePrompt(false)
      navigate('/social')
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo compartir')
    }
  }

  const addExerciseField = () => {
    setNewRoutine((current) => ({
      ...current,
      exercises: [...current.exercises, { id: createExerciseId(), name: '', sets: 3, reps: 10 }]
    }))
  }

  const updateExercise = (index, field, value) => {
    setNewRoutine((current) => {
      const updated = [...current.exercises]
      updated[index] = { ...updated[index], [field]: value }
      return { ...current, exercises: updated }
    })
  }

  const removeExercise = (index) => {
    setNewRoutine((current) => ({
      ...current,
      exercises: current.exercises.filter((_, i) => i !== index)
    }))
  }

  const toggleRoutineDay = (dayId) => {
    setNewRoutine((current) => {
      const days = normalizeDays(current.days)
      const next = days.includes(dayId) ? days.filter((d) => d !== dayId) : [...days, dayId]
      return { ...current, days: next }
    })
  }

  const resetNewRoutine = () => ({
    name: '',
    exercises: [{ id: createExerciseId(), name: '', sets: 3, reps: 10 }],
    isPublic: false,
    days: []
  })

  const saveNewRoutine = async () => {
    if (!newRoutine.name.trim() || newRoutine.exercises.some((exercise) => !exercise.name.trim())) {
      toast.error('Completa todos los campos antes de guardar la rutina')
      return
    }

    if (editingId) {
      const previous = templates.find((t) => t.id === editingId)
      if (previous && (isQiSiRoutine(previous) || isQiSiProfile(previous?.originalCreator))) {
        await dialog.alert(qisiEditBlockMessage(), {
          title: qisiEditBlockTitle(),
          confirmLabel: 'Entendido',
          tone: 'info'
        })
        return
      }
    }

    const colors = ['primary', 'cyan', 'purple', 'green']

    if (editingId) {
      const previous = templates.find((t) => t.id === editingId)
      const becomesCollaborator = previous ? isAdoptedFromOther(previous, meId) : false
      let updatedRoutine = null
      setTemplates((current) =>
        current.map((t) => {
          if (t.id !== editingId) return t
          updatedRoutine = {
            ...t,
            name: newRoutine.name.trim(),
            exercises: newRoutine.exercises,
            isPublic: Boolean(newRoutine.isPublic),
            days: normalizeDays(newRoutine.days),
            isEditedFork: becomesCollaborator ? true : Boolean(t.isEditedFork)
          }
          return updatedRoutine
        })
      )
      if (updatedRoutine) {
        const synced = await syncRoutineToServer(updatedRoutine)
        if (synced?.id || synced?._id) {
          setTemplates((current) =>
            current.map((t) =>
              t.id === editingId
                ? {
                    ...t,
                    serverId: synced.id || synced._id,
                    isPublic: synced.isPublic,
                    days: normalizeDays(synced.days ?? t.days),
                    isEditedFork: Boolean(synced.isEditedFork || t.isEditedFork),
                    originalCreator: synced.originalCreator || t.originalCreator,
                    originalCreatorId: synced.originalCreatorId || t.originalCreatorId,
                    sourceRoutineId: synced.sourceRoutineId || t.sourceRoutineId
                  }
                : t
            )
          )
        } else if (becomesCollaborator || updatedRoutine.isEditedFork) {
          toast.error(
            'No se pudo sincronizar tu edición de colaborador. Revisa la conexión y vuelve a guardar.'
          )
        }
      }
      toast.success(
        becomesCollaborator
          ? 'Rutina actualizada · ahora eres colaborador GymRat'
          : 'Rutina actualizada'
      )
    } else {
      const created = {
        ...newRoutine,
        name: newRoutine.name.trim(),
        id: createWorkoutId(),
        color: colors[templates.length % colors.length],
        isPublic: Boolean(newRoutine.isPublic),
        days: normalizeDays(newRoutine.days)
      }
      setTemplates((current) => [...current, created])
      const synced = await syncRoutineToServer(created)
      if (synced?.id || synced?._id) {
        setTemplates((current) =>
          current.map((t) =>
            t.id === created.id
              ? {
                  ...t,
                  serverId: synced.id || synced._id,
                  days: normalizeDays(synced.days ?? t.days)
                }
              : t
          )
        )
      }
      toast.success(created.isPublic ? 'Rutina pública guardada' : 'Rutina guardada')
    }

    setShowCreateModal(false)
    setEditingId(null)
    setNewRoutine(resetNewRoutine())
  }

  const openEditRoutine = async (template) => {
    if (isQiSiRoutine(template) || isQiSiProfile(template?.originalCreator)) {
      await dialog.alert(qisiEditBlockMessage(), {
        title: qisiEditBlockTitle(),
        confirmLabel: 'Entendido',
        tone: 'info'
      })
      return
    }
    if (isAdoptedFromOther(template, meId)) {
      const creator =
        template.originalCreator?.username
          ? `@${String(template.originalCreator.username).replace(/^@+/, '')}`
          : template.originalCreator?.name || 'otro GymRat'
      const ok = await dialog.confirm(
        `Esta rutina fue creada por ${creator}. Si la editas, el crédito del creador se mantiene y tú te conviertes en colaborador GymRat de esta rutina. Las versiones editadas no se pueden volver a adoptar por terceros.`,
        {
          title: 'Editar rutina de otro GymRat',
          confirmLabel: 'Editar como colaborador',
          cancelLabel: 'Cancelar',
          tone: 'info'
        }
      )
      if (!ok) return
    }
    setEditingId(template.id)
    setNewRoutine({
      name: template.name,
      exercises: template.exercises.map((ex) => ({ ...ex })),
      isPublic: Boolean(template.isPublic),
      days: normalizeDays(template.days)
    })
    setShowCreateModal(true)
  }

  const openPreviewRoutine = (template) => {
    setPreviewRoutine(template)
  }

  const deleteRoutine = async (template) => {
    const adopted = isAdoptedFromOther(template, meId) || Boolean(template.sourceRoutineId)
    const edited = Boolean(template.isEditedFork)

    let message = `¿Eliminar la rutina "${template.name}"?`
    let title = 'Eliminar rutina'
    let confirmLabel = 'Eliminar'

    if (adopted && edited) {
      title = 'Eliminar adopción editada'
      confirmLabel = 'Eliminar todo'
      message =
        `Al eliminar "${template.name}" se quitará tu adopción como GymRat del creador y de esa rutina, ` +
        `se borrará tu variante editada de la app y dejarás de ser colaborador de esa rutina. Esta acción no se puede deshacer.`
    } else if (adopted) {
      title = 'Eliminar rutina adoptada'
      confirmLabel = 'Eliminar adopción'
      message =
        `Al eliminar "${template.name}" dejarás de ser GymRat de esa rutina. ` +
        `Podrás volver a adoptarla después desde Explorar o la comunidad.`
    }

    const ok = await dialog.confirm(message, {
      title,
      confirmLabel,
      cancelLabel: 'Cancelar',
      tone: 'danger'
    })
    if (!ok) return

    setTemplates((current) => current.filter((t) => t.id !== template.id))
    await syncRoutineToServer(template, { remove: true })
    toast.success(
      adopted && edited
        ? 'Adopción, colaboración y variante eliminadas'
        : adopted
          ? 'Adopción eliminada'
          : 'Rutina eliminada'
    )
  }

  const togglePublic = async (template) => {
    if (isQiSiRoutine(template) || isQiSiProfile(template?.originalCreator)) {
      await dialog.alert(qisiEditBlockMessage(), {
        title: qisiEditBlockTitle(),
        confirmLabel: 'Entendido',
        tone: 'info'
      })
      return
    }
    const next = !template.isPublic
    const updated = { ...template, isPublic: next }
    setTemplates((current) => current.map((t) => (t.id === template.id ? updated : t)))
    try {
      const synced = await syncRoutineToServer(updated)
      if (synced?.id || synced?._id) {
        setTemplates((current) =>
          current.map((t) =>
            t.id === template.id
              ? {
                  ...t,
                  serverId: synced.id || synced._id,
                  isPublic: synced.isPublic,
                  days: normalizeDays(synced.days ?? t.days)
                }
              : t
          )
        )
      }
      toast.success(next ? 'Rutina marcada como pública' : 'Rutina ahora es privada')
    } catch (error) {
      setTemplates((current) => current.map((t) => (t.id === template.id ? template : t)))
      const code = error?.response?.data?.code
      const message = error?.response?.data?.message
      if (code === 'QISI_NOT_PUBLIC') {
        await dialog.alert(message || qisiPublicBlockMessage(), {
          title: `Rutinas de ${QISI_NAME}`,
          confirmLabel: 'Entendido',
          tone: 'info'
        })
      } else {
        toast.error(message || 'No se pudo actualizar la visibilidad')
      }
    }
  }

  const submitShareRoutine = async (payload) => {
    if (!shareTarget) return
    if (isQiSiRoutine(shareTarget) || isQiSiProfile(shareTarget?.originalCreator)) {
      await dialog.alert(qisiPublicBlockMessage(), {
        title: `Rutinas de ${QISI_NAME}`,
        confirmLabel: 'Entendido',
        tone: 'info'
      })
      setShareTarget(null)
      return
    }
    setSharing(true)
    const template = shareTarget
    try {
      let currentTemplate = template
      if (!template.isPublic) {
        const updated = { ...template, isPublic: true }
        setTemplates((current) => current.map((t) => (t.id === template.id ? updated : t)))
        const synced = await syncRoutineToServer(updated)
        if (synced?.id || synced?._id) {
          currentTemplate = {
            ...updated,
            serverId: synced.id || synced._id,
            isPublic: synced.isPublic ?? true,
            days: normalizeDays(synced.days ?? updated.days)
          }
          setTemplates((current) =>
            current.map((t) => (t.id === template.id ? currentTemplate : t))
          )
        } else {
          currentTemplate = updated
        }
      }

      await api.post('/social', {
        content: payload.content || `Comparto mi rutina: ${template.name}`,
        postType: 'routine',
        mood: payload.mood,
        poll: payload.poll,
        workoutData: {
          name: template.name,
          shareKind: 'routine',
          isRoutine: true,
          completedExercises: template.exercises.length,
          totalExercises: template.exercises.length,
          totalSets: template.exercises.reduce((s, e) => s + (Number(e.sets) || 0), 0),
          durationSeconds: 0,
          routineId: currentTemplate.serverId || currentTemplate.id,
          isPublicRoutine: true,
          days: normalizeDays(template.days),
          exercises: template.exercises.map((e) => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps
          }))
        }
      })
      toast.success('Rutina compartida en Comunidad')
      setShareTarget(null)
      navigate('/social')
    } catch (error) {
      const code = error?.response?.data?.code
      const message = error?.response?.data?.message
      if (code === 'QISI_NOT_PUBLIC') {
        await dialog.alert(message || qisiPublicBlockMessage(), {
          title: `Rutinas de ${QISI_NAME}`,
          confirmLabel: 'Entendido',
          tone: 'info'
        })
      } else {
        toast.error(message || 'No se pudo compartir')
      }
    } finally {
      setSharing(false)
    }
  }

  if (activeWorkout) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-1 pb-28 sm:space-y-5 sm:pb-8">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-20 -mx-1 rounded-2xl border border-app bg-elevated/95 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
            <div className="relative h-11 w-11 shrink-0 sm:h-12 sm:w-12">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 44 44" aria-hidden>
                <circle cx="22" cy="22" r="18" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 * (1 - progress / 100)}`}
                  className="transition-[stroke-dashoffset] duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-app sm:text-[11px]">
                {progress}%
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-app sm:text-base">
                {activeWorkout.name}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-primary-500 sm:text-sm">
                {formatTime(workoutTime)}
              </p>
            </div>
            <button
              type="button"
              onClick={cancelWorkout}
              className="shrink-0 rounded-xl px-2.5 py-2 text-xs text-app-secondary transition-colors hover:bg-[color:var(--bg-muted)] hover:text-app sm:px-3 sm:text-sm"
            >
              Salir
            </button>
            <button
              type="button"
              onClick={finishWorkout}
              disabled={saving}
              className="btn-primary shrink-0 px-3 py-2 text-xs sm:px-4 sm:text-sm disabled:opacity-60"
            >
              {saving ? '…' : 'Finalizar'}
            </button>
          </div>

          <div
            className="flex gap-0.5 px-3 pb-2.5 sm:gap-1 sm:px-5 sm:pb-3"
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={totalExercises}
            aria-label={`${completedCount} de ${totalExercises} ejercicios completados`}
          >
            {activeWorkout.exercises.map((exercise, index) => {
              const done = completedExercises.includes(exercise.id)
              const isCurrent = currentExercise?.id === exercise.id && !done
              return (
                <div
                  key={exercise.id}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 sm:h-1.5 ${
                    done
                      ? 'bg-accent-green'
                      : isCurrent
                        ? 'bg-primary-500 shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.55)]'
                        : 'bg-[color:var(--bg-muted)]'
                  }`}
                  title={`${index + 1}. ${exercise.name}${done ? ' ✓' : isCurrent ? ' (actual)' : ''}`}
                />
              )
            })}
          </div>
        </motion.header>

        <AnimatePresence mode="wait">
          {restActive ? (
            <motion.section
              key="rest"
              data-tour="tour-workout-rest-timer"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="relative overflow-hidden rounded-[1.75rem] border border-app bg-elevated px-4 py-10 text-center sm:px-8 sm:py-14"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,245,255,0.07),transparent_70%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-cyan/40 to-transparent" />
              <div className="relative flex items-center justify-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent-cyan sm:text-xs">
                  Descanso
                </p>
                <TutorialHelpButton
                  tutorialId={TUTORIAL_IDS.REST_TIMES}
                  size="sm"
                  className="pointer-events-auto"
                  message="El temporizador de descanso tiene un tutorial para configurar y entender los tiempos entre ejercicios."
                />
              </div>
              <div className="relative mx-auto mt-8 flex max-w-xs justify-center sm:mt-10">
                <Timer remaining={restRemaining} total={restTotal} size="lg" />
              </div>
              <div className="relative mt-8 space-y-1 sm:mt-10">
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-app-secondary">Siguiente</p>
                <p className="font-display text-xl text-app sm:text-2xl">
                  {currentExercise?.name || 'Último ejercicio'}
                </p>
              </div>
              <button
                type="button"
                onClick={skipRest}
                className="relative mt-8 inline-flex items-center gap-2 rounded-full border border-app bg-[color:var(--bg-muted)] px-5 py-2.5 text-sm text-app transition-colors hover:border-accent-cyan/30 hover:bg-elevated sm:mt-10"
              >
                <FiSkipForward size={15} /> Saltar descanso
              </button>
            </motion.section>
          ) : (
            <motion.section
              key="focus"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="relative overflow-hidden rounded-[1.75rem] border border-app bg-elevated px-5 py-7 sm:px-8 sm:py-10"
            >
              <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary-500/12 blur-3xl" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-primary)]/35 to-transparent" />
              <p className="relative text-[11px] font-semibold uppercase tracking-[0.35em] text-app-secondary sm:text-xs">
                Ejercicio {currentIndex + 1} de {totalExercises}
              </p>
              <h2 className="relative mt-3 font-display text-[1.75rem] leading-tight text-app sm:mt-4 sm:text-4xl">
                {currentExercise?.name || 'Sesión completa'}
              </h2>
              {currentExercise && (
                <div className="relative mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-app bg-[color:var(--bg-muted)] px-3 py-1 text-sm font-medium text-app">
                    {currentExercise.sets} series
                  </span>
                  <span className="inline-flex items-center rounded-full border border-app bg-[color:var(--bg-muted)] px-3 py-1 text-sm font-medium text-app">
                    {currentExercise.reps} reps
                  </span>
                </div>
              )}
              {currentExercise && !completedExercises.includes(currentExercise.id) && (
                <motion.button
                  type="button"
                  data-tour="tour-workout-complete-exercise"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => toggleExercise(currentExercise.id)}
                  className="btn-primary relative mt-8 inline-flex w-full items-center justify-center gap-2 py-4 text-base shadow-[0_0_24px_rgba(var(--color-primary-rgb),0.28)] sm:mt-10 sm:w-auto sm:min-w-[240px]"
                >
                  <FiCheck size={20} /> Completar
                </motion.button>
              )}
              {completedCount === totalExercises && (
                <p className="relative mt-8 text-center text-sm text-accent-green sm:mt-10">
                  Todo listo — pulsa Finalizar para guardar.
                </p>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        <section>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-baseline justify-between gap-2 sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-app-secondary sm:text-xs">
                Ejercicios
              </p>
              <p className="text-xs tabular-nums text-app-secondary sm:mt-1">
                {completedCount}/{totalExercises} hechos
              </p>
            </div>
            <div
              className="grid grid-cols-2 rounded-xl border border-app bg-elevated p-0.5"
              role="tablist"
              aria-label="Filtrar ejercicios"
            >
              <button
                type="button"
                role="tab"
                aria-selected={exerciseListFilter === 'pending'}
                onClick={() => setExerciseListFilter('pending')}
                className={`rounded-[10px] px-3 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
                  exerciseListFilter === 'pending'
                    ? 'bg-primary-500 text-black shadow-sm'
                    : 'text-app-secondary hover:text-app'
                }`}
              >
                Pendientes
                <span
                  className={`ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full px-1 py-0.5 text-[10px] tabular-nums ${
                    exerciseListFilter === 'pending' ? 'bg-black/15' : 'bg-[color:var(--bg-muted)]'
                  }`}
                >
                  {pendingCount}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={exerciseListFilter === 'completed'}
                onClick={() => setExerciseListFilter('completed')}
                className={`rounded-[10px] px-3 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
                  exerciseListFilter === 'completed'
                    ? 'bg-accent-green text-black shadow-sm'
                    : 'text-app-secondary hover:text-app'
                }`}
              >
                Completados
                <span
                  className={`ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full px-1 py-0.5 text-[10px] tabular-nums ${
                    exerciseListFilter === 'completed' ? 'bg-black/15' : 'bg-[color:var(--bg-muted)]'
                  }`}
                >
                  {completedCount}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {listedExercises.map(({ exercise, index }) => {
                const done = completedExercises.includes(exercise.id)
                const isCurrent = currentExercise?.id === exercise.id && !done
                return (
                  <motion.button
                    id={`workout-exercise-${exercise.id}`}
                    key={exercise.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: exerciseListFilter === 'pending' ? 24 : -24, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => toggleExercise(exercise.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all sm:px-4 sm:py-3.5 ${
                      done
                        ? 'border-accent-green/25 bg-accent-green/8'
                        : isCurrent
                          ? 'border-primary-500/45 bg-primary-500/10 shadow-[0_0_0_1px_rgba(var(--color-primary-rgb),0.12)]'
                          : 'border-app bg-elevated hover:border-[color:var(--color-primary)]/25'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8 ${
                        done
                          ? 'bg-accent-green text-black'
                          : isCurrent
                            ? 'bg-primary-500 text-black'
                            : 'border border-app bg-[color:var(--bg-muted)] text-app-secondary'
                      }`}
                    >
                      {done ? <FiCheck size={14} /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={`block truncate font-medium ${
                            done ? 'text-accent-green' : isCurrent ? 'text-app' : 'text-app-secondary'
                          }`}
                        >
                          {exercise.name}
                        </span>
                        {isCurrent && (
                          <span className="shrink-0 rounded-md bg-primary-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-500">
                            En curso
                          </span>
                        )}
                      </span>
                      <span
                        className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] ${
                          done
                            ? 'bg-accent-green/10 text-accent-green'
                            : isCurrent
                              ? 'bg-[color:var(--bg-muted)] text-app-secondary'
                              : 'text-app-secondary opacity-70'
                        }`}
                      >
                        {exercise.sets}×{exercise.reps}
                      </span>
                    </span>
                    {isCurrent && (
                      <FiPlay className="shrink-0 text-primary-500" size={16} aria-hidden />
                    )}
                    {done && (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-accent-green">
                        Hecho
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </AnimatePresence>

            {listedExercises.length === 0 && (
              <div className="rounded-2xl border border-dashed border-app bg-elevated/60 px-4 py-8 text-center">
                {exerciseListFilter === 'pending' ? (
                  <>
                    <p className="text-sm font-medium text-app">
                      {completedCount === totalExercises
                        ? 'Todos los ejercicios estánados'
                        : 'No hay pendientes'}
                    </p>
                    <p className="mt-1 text-xs text-app-secondary">
                      {completedCount === totalExercises
                        ? 'Pulsa Finalizar para guardar la sesión.'
                        : 'Cambia al filtro Completados para revisarlos.'}
                    </p>
                    {completedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setExerciseListFilter('completed')}
                        className="btn-secondary mt-4 px-4 py-2 text-sm"
                      >
                        Ver completados ({completedCount})
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-app">Aún no hay completados</p>
                    <p className="mt-1 text-xs text-app-secondary">
                      Al marcar un ejercicio, aparecerá aquí.
                    </p>
                    <button
                      type="button"
                      onClick={() => setExerciseListFilter('pending')}
                      className="btn-secondary mt-4 px-4 py-2 text-sm"
                    >
                      Ver pendientes ({pendingCount})
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 sm:space-y-8 sm:pb-8">
      <AnimatePresence>
        {showSharePrompt && lastSavedWorkout && (
          <ShareWorkoutPrompt
            workout={lastSavedWorkout}
            onShare={shareLastWorkout}
            onClose={() => setShowSharePrompt(false)}
            onViewHistory={() => {
              setShowSharePrompt(false)
              navigate('/my-workouts')
            }}
          />
        )}
      </AnimatePresence>

      <ShareComposerModal
        open={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        onSubmit={submitShareRoutine}
        title="Compartir rutina"
        subtitle={shareTarget ? shareTarget.name : ''}
        initialContent={shareTarget ? `Comparto mi rutina: ${shareTarget.name}` : ''}
        submitLabel="Publicar rutina"
        loading={sharing}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-3xl text-app sm:text-5xl">Entrenamientos</h1>
            <TutorialHelpButton
              tutorialId={TUTORIAL_IDS.WORKOUTS}
              message="Esta pantalla tiene un tutorial para crear rutinas, iniciar sesiones y completar ejercicios."
            />
            <TutorialHelpButton
              tutorialId={TUTORIAL_IDS.QYSI_TRAINING}
              message="Aprende a abrir QySi, elegir variante y nivel, adoptar la rutina e iniciar. Las de QySi no se editan."
            />
          </div>
          <p className="mt-2 max-w-lg text-sm text-app-secondary sm:text-base">
            Elige una rutina e inicia. Tu sesión sigue activa si cambias de pantalla.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:self-start">
          <button
            type="button"
            onClick={() => navigate('/explore-routines')}
            data-tour="tour-workouts-explore"
            className="btn-secondary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm sm:w-auto"
          >
            <FiCompass size={18} /> Explorar rutinas
          </button>
          <button
            type="button"
            data-tour="tour-workouts-create"
            onClick={() => {
              setEditingId(null)
              setNewRoutine(resetNewRoutine())
              setShowCreateModal(true)
            }}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm sm:w-auto"
          >
            <FiPlus size={18} /> Nueva rutina
          </button>
        </div>
      </div>

      <div data-tour="tour-workouts-list" className="space-y-3">
        <div className="relative">
          <FiSearch
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-app-secondary"
            size={16}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar rutina por nombre…"
            className="input-field w-full pl-10"
          />
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setDayFilter('all')}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              dayFilter === 'all'
                ? 'border-primary-500 bg-primary-500/15 text-primary-500'
                : 'border-app bg-elevated text-app-secondary hover:text-app'
            }`}
          >
            Todos
            <span className="ml-1.5 text-xs opacity-70">{dayCounts.all}</span>
          </button>
          {WEEK_DAYS.map((day) => {
            const isToday = day.id === todayId
            const active = dayFilter === day.id
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => setDayFilter(day.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'border-primary-500 bg-primary-500/15 text-primary-500'
                    : isToday
                      ? 'border-accent-cyan/40 bg-accent-cyan/10 text-app'
                      : 'border-app bg-elevated text-app-secondary hover:text-app'
                }`}
              >
                {day.short}
                {isToday && !active && <span className="ml-1 text-[10px] uppercase text-accent-cyan">Hoy</span>}
                <span className="ml-1.5 text-xs opacity-70">{dayCounts[day.id]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="rounded-[1.75rem] border border-app bg-elevated px-6 py-12 text-center">
          <p className="font-display text-xl text-app">Sin rutinas</p>
          <p className="mt-2 text-sm text-app-secondary">
            {searchQuery.trim() || dayFilter !== 'all'
              ? 'No hay rutinas que coincidan con tu búsqueda o filtro.'
              : 'Crea tu primera rutina para empezar a entrenar.'}
          </p>
          {(searchQuery.trim() || dayFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setDayFilter('all')
              }}
              className="btn-secondary mt-4 px-4 py-2 text-sm"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {filteredTemplates.map((template, i) => {
            const templateDays = normalizeDays(template.days)
            return (
              <motion.article
                key={template.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ y: -3 }}
                className={`group relative overflow-hidden rounded-[1.75rem] border bg-gradient-to-br p-5 sm:p-6 ${
                  COLOR_MAP[template.color] || COLOR_MAP.primary
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-app-secondary">
                      {template.exercises.length} ejercicios
                      {template.isPublic ? ' · Pública' : ''}
                    </p>
                    <h2 className="mt-2 font-display text-2xl text-app">{template.name}</h2>
                    {(() => {
                      const creatorLabel = gymratCreatorLabel(template, meId)
                      const QySiLabel = QySiBadgeLabel(template)
                      return (
                        <>
                          {QySiLabel && (
                            <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary-500/40 bg-primary-500/12 px-2.5 py-1 text-[11px] font-semibold text-primary-500">
                              <FiZap size={12} className="shrink-0" />
                              <span className="truncate">{QySiLabel}</span>
                            </span>
                          )}
                          {creatorLabel && !QySiLabel && (
                            <span
                              data-tour={i === 0 ? 'tour-workout-gymrat-creator' : undefined}
                              className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[rgba(var(--color-primary-rgb),0.35)] bg-[rgba(var(--color-primary-rgb),0.12)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-primary)]"
                              title="Creador original de la rutina"
                            >
                              <FiUser size={12} className="shrink-0" />
                              <span className="truncate">
                                {template.isEditedFork ? 'Colaborador · ' : ''}
                                GymRat de {creatorLabel}
                              </span>
                            </span>
                          )}
                          {creatorLabel && QySiLabel && (
                            <span className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-app-secondary">
                              <FiUser size={11} />
                              Crédito · {creatorLabel}
                            </span>
                          )}
                        </>
                      )
                    })()}
                    {template.isPublic && Number(template.adoptCount) > 0 && (
                      <span className="mt-2 ml-0 inline-flex items-center gap-1 rounded-full bg-[color:var(--bg-muted)] px-2 py-0.5 text-[11px] font-medium text-app-secondary sm:ml-2">
                        <FiUsers size={11} />
                        {template.adoptCount} GymRats
                      </span>
                    )}
                    {templateDays.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {templateDays.map((dayId) => {
                          const isToday = dayId === todayId
                          return (
                            <span
                              key={dayId}
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                isToday
                                  ? 'bg-accent-cyan/20 text-accent-cyan'
                                  : 'bg-[color:var(--bg-muted)] text-app-secondary'
                              }`}
                            >
                              {getDayLabel(dayId)}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--bg-muted)] text-lg font-bold text-app">
                    {template.exercises.length}
                  </span>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {template.exercises.slice(0, 3).map((ex) => (
                    <li key={ex.id} className="truncate text-sm text-app-secondary">
                      {ex.name}
                      <span className="opacity-60"> · {ex.sets}×{ex.reps}</span>
                    </li>
                  ))}
                  {template.exercises.length > 3 && (
                    <li className="text-xs text-app-secondary opacity-70">
                      +{template.exercises.length - 3} más
                    </li>
                  )}
                </ul>
                <div className="mt-4 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openPreviewRoutine(template)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--bg-muted)] px-2 py-1.5 text-xs text-app hover:opacity-80"
                    title="Ver rutina"
                    aria-label="Ver rutina"
                  >
                    <FiEye size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditRoutine(template)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--bg-muted)] px-2 py-1.5 text-xs text-app hover:opacity-80"
                    title={
                      isQiSiRoutine(template)
                        ? `Las rutinas de ${QISI_NAME} no se pueden editar`
                        : 'Editar'
                    }
                    aria-label={
                      isQiSiRoutine(template)
                        ? `Las rutinas de ${QISI_NAME} no se pueden editar`
                        : 'Editar'
                    }
                  >
                    <FiEdit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePublic(template)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--bg-muted)] px-2 py-1.5 text-xs text-app hover:opacity-80"
                    title={
                      isQiSiRoutine(template)
                        ? `Las rutinas de ${QISI_NAME} no pueden ser públicas`
                        : template.isPublic
                          ? 'Hacer privada'
                          : 'Hacer pública'
                    }
                  >
                    <FiGlobe size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (isQiSiRoutine(template) || isQiSiProfile(template?.originalCreator)) {
                        await dialog.alert(qisiPublicBlockMessage(), {
                          title: `Rutinas de ${QISI_NAME}`,
                          confirmLabel: 'Entendido',
                          tone: 'info'
                        })
                        return
                      }
                      setShareTarget(template)
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--bg-muted)] px-2 py-1.5 text-xs text-app hover:opacity-80"
                    title="Compartir"
                  >
                    <FiShare2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRoutine(template)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--bg-muted)] px-2 py-1.5 text-xs text-red-400 hover:opacity-80"
                    title="Eliminar"
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
                <button
                  type="button"
                  data-tour={i === 0 ? 'tour-workout-start' : undefined}
                  onClick={() => startWorkout(template)}
                  className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-3"
                >
                  <FiPlay size={16} /> Iniciar
                </button>
              </motion.article>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 sm:px-6 sm:py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="app-modal-panel card w-full max-w-3xl p-5 sm:p-6"
            >
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-app-secondary">{editingId ? 'Editar rutina' : 'Nueva rutina'}</p>
                  <h2 className="font-display text-2xl text-app">
                    {editingId ? 'Actualiza tu plan' : 'Crea tu plan'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingId(null)
                  }}
                  className="text-app-secondary hover:text-app"
                >
                  <FiX size={24} />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm text-app-secondary">Nombre</label>
                  <input
                    type="text"
                    value={newRoutine.name}
                    onChange={(e) => setNewRoutine((c) => ({ ...c, name: e.target.value }))}
                    placeholder="Ej: Día de fuerza"
                    className="input-field"
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm text-app-secondary">Días de la semana</p>
                  <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map((day) => {
                      const selected = normalizeDays(newRoutine.days).includes(day.id)
                      const isToday = day.id === todayId
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleRoutineDay(day.id)}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                            selected
                              ? 'border-primary-500 bg-primary-500/15 text-primary-500'
                              : isToday
                                ? 'border-accent-cyan/40 bg-accent-cyan/10 text-app'
                                : 'border-app bg-elevated text-app-secondary hover:text-app'
                          }`}
                        >
                          {day.full}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-xl border border-app bg-[color:var(--bg-muted)] px-4 py-3">
                  <span>
                    <span className="block font-medium text-app">Rutina pública</span>
                    <span className="text-xs text-app-secondary">Visible para tu comunidad GymRat</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewRoutine((c) => ({ ...c, isPublic: !c.isPublic }))}
                    className={`h-6 w-12 rounded-full transition-colors ${newRoutine.isPublic ? 'bg-primary-500' : 'bg-[color:var(--bg-muted)]'}`}
                  >
                    <span
                      className={`block h-5 w-5 rounded-full bg-white transition-transform ${newRoutine.isPublic ? 'translate-x-6' : 'translate-x-0.5'}`}
                    />
                  </button>
                </label>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm text-app-secondary">Ejercicios</p>
                    <button
                      type="button"
                      onClick={addExerciseField}
                      className="inline-flex items-center gap-2 text-sm text-primary-500 hover:text-primary-400"
                    >
                      <FiPlus /> Agregar
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newRoutine.exercises.map((exercise, index) => (
                      <div key={exercise.id} className="grid items-center gap-2 lg:grid-cols-[1.6fr_0.7fr_0.7fr_40px]">
                        <input
                          type="text"
                          value={exercise.name}
                          onChange={(e) => updateExercise(index, 'name', e.target.value)}
                          placeholder="Ejercicio"
                          className="input-field w-full"
                        />
                        <input
                          type="number"
                          value={exercise.sets}
                          onChange={(e) => updateExercise(index, 'sets', Number(e.target.value) || 1)}
                          min="1"
                          className="input-field w-full"
                          placeholder="Series"
                        />
                        <input
                          type="text"
                          value={exercise.reps}
                          onChange={(e) => updateExercise(index, 'reps', e.target.value)}
                          className="input-field w-full"
                          placeholder="Reps"
                        />
                        {newRoutine.exercises.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeExercise(index)}
                            className="text-red-500 hover:text-red-400"
                          >
                            <FiTrash2 size={20} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setEditingId(null)
                    }}
                    className="btn-secondary w-full py-3"
                  >
                    Cancelar
                  </button>
                  <button type="button" onClick={saveNewRoutine} className="btn-primary w-full py-3">
                    {editingId ? 'Guardar cambios' : 'Guardar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <RoutineDetailModal
        open={Boolean(previewRoutine)}
        onClose={() => setPreviewRoutine(null)}
        routine={previewRoutine}
        author={previewRoutine?.originalCreator || null}
        canAdopt={false}
        subtitle="Vista previa"
      />

      <QySiAssistant
        templates={templates}
        onAdopted={(local) => {
          setTemplates((current) => {
            const sourceId = local?.sourceRoutineId
            const filtered = sourceId
              ? current.filter((t) => String(t?.sourceRoutineId || '') !== String(sourceId))
              : current
            return [...filtered, local]
          })
        }}
      />
    </div>
  )
}
