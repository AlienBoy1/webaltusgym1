import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiCheck, FiPlay, FiX, FiTrash2, FiSkipForward, FiShare2 } from 'react-icons/fi'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import Timer from '../../components/Timer'
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

const WORKOUT_TEMPLATES_KEY = 'qyntra:workout_templates'
const DEFAULT_REST_SECONDS = 60

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
    exercises: [
      { id: 'e-16', name: 'Press Militar', sets: 4, reps: 10 },
      { id: 'e-17', name: 'Elevaciones Laterales', sets: 3, reps: 15 },
      { id: 'e-18', name: 'Pájaros', sets: 3, reps: 15 },
      { id: 'e-19', name: 'Plancha', sets: 3, reps: '60s' },
      { id: 'e-20', name: 'Crunch', sets: 3, reps: 20 }
    ]
  }
]

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-dark-200 p-5 sm:rounded-3xl sm:p-6"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Sesión guardada</p>
        <h3 className="mt-2 font-display text-2xl text-white">{workout.name}</h3>
        <p className="mt-2 text-sm text-gray-400">
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
        <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-white">
          Ahora no
        </button>
      </motion.div>
    </motion.div>
  )
}

export default function Workouts() {
  const location = useLocation()
  const navigate = useNavigate()
  const hydrated = useRef(false)
  const restStartedAt = useRef(null)
  const [restHistory, setRestHistory] = useState([])
  const [lastSavedWorkout, setLastSavedWorkout] = useState(null)
  const [showSharePrompt, setShowSharePrompt] = useState(false)
  const [templates, setTemplates] = useState(() => {
    try {
      const stored = localStorage.getItem(WORKOUT_TEMPLATES_KEY)
      return stored ? JSON.parse(stored) : defaultTemplates
    } catch {
      return defaultTemplates
    }
  })
  const [activeWorkout, setActiveWorkout] = useState(null)
  const [sessionStart, setSessionStart] = useState(null)
  const [restActive, setRestActive] = useState(false)
  const [restRemaining, setRestRemaining] = useState(0)
  const [restEndsAt, setRestEndsAt] = useState(null)
  const [restTotal, setRestTotal] = useState(DEFAULT_REST_SECONDS)
  const [restTimerSource, setRestTimerSource] = useState(null)
  const [completedExercises, setCompletedExercises] = useState([])
  const [workoutTime, setWorkoutTime] = useState(0)
  const [preferences] = useState(() => getWorkoutPreferences() || { restTimerDefault: DEFAULT_REST_SECONDS })
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newRoutine, setNewRoutine] = useState({
    name: '',
    exercises: [{ id: createExerciseId(), name: '', sets: 3, reps: 10 }]
  })
  const { celebration } = useConfetti()

  useEffect(() => {
    localStorage.setItem(WORKOUT_TEMPLATES_KEY, JSON.stringify(templates))
  }, [templates])

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
  const currentExercise = useMemo(
    () => getCurrentExercise({ activeWorkout, completedExercises }),
    [activeWorkout, completedExercises]
  )
  const currentIndex = useMemo(() => {
    if (!activeWorkout || !currentExercise) return 0
    return activeWorkout.exercises.findIndex((e) => e.id === currentExercise.id)
  }, [activeWorkout, currentExercise])

  const startRest = (exerciseId) => {
    const restSeconds = preferences?.restTimerDefault || DEFAULT_REST_SECONDS
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
      setLastSavedWorkout(data?.workout || {
        name: activeWorkout.name,
        exercises: exercisesPayload,
        duration: Math.max(1, Math.floor(workoutTime / 60)),
        metrics
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
      await api.post('/social', {
        content: `Acabo de completar: ${w.name}`,
        postType: 'workout',
        workoutData: {
          workoutId: w._id || w.id,
          name: w.name,
          completedExercises: completed.length,
          totalExercises: (w.exercises || []).length,
          totalSets: completed.reduce((s, e) => s + (Number(e.setsCompleted ?? e.sets) || 0), 0),
          durationSeconds: metrics.durationSeconds || workoutTime,
          bestRestSeconds: metrics.bestRestSeconds || null,
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

  const saveNewRoutine = () => {
    if (!newRoutine.name.trim() || newRoutine.exercises.some((exercise) => !exercise.name.trim())) {
      toast.error('Completa todos los campos antes de guardar la rutina')
      return
    }
    const colors = ['primary', 'cyan', 'purple', 'green']
    setTemplates((current) => [
      ...current,
      {
        ...newRoutine,
        id: createWorkoutId(),
        color: colors[current.length % colors.length]
      }
    ])
    setShowCreateModal(false)
    setNewRoutine({ name: '', exercises: [{ id: createExerciseId(), name: '', sets: 3, reps: 10 }] })
    toast.success('Rutina guardada')
  }

  if (activeWorkout) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-28 sm:space-y-5 sm:pb-8 px-0.5">
        {/* Compact session bar — single source for name / time / progress */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-20 -mx-0.5 rounded-2xl border border-white/10 bg-[#0a0c14]/95 px-3 py-2.5 backdrop-blur-xl sm:px-5 sm:py-3"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative h-10 w-10 shrink-0 sm:h-11 sm:w-11">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="#FF6B35"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 * (1 - progress / 100)}`}
                  className="transition-[stroke-dashoffset] duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                {progress}%
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white sm:text-base">{activeWorkout.name}</p>
              <p className="font-mono text-xs tabular-nums text-primary-300 sm:text-sm">{formatTime(workoutTime)}</p>
            </div>
            <button type="button" onClick={cancelWorkout} className="rounded-xl px-2.5 py-2 text-xs text-gray-400 hover:bg-white/5 hover:text-white sm:px-3 sm:text-sm">
              Salir
            </button>
            <button
              type="button"
              onClick={finishWorkout}
              disabled={saving}
              className="btn-primary px-3 py-2 text-xs sm:px-4 sm:text-sm disabled:opacity-60"
            >
              {saving ? '…' : 'Listo'}
            </button>
          </div>
        </motion.header>

        {/* Focus: rest OR current exercise — never both duplicating the same stats */}
        <AnimatePresence mode="wait">
          {restActive ? (
            <motion.section
              key="rest"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative overflow-hidden rounded-[1.75rem] border border-accent-cyan/20 bg-gradient-to-b from-[#0c1520] to-[#080a10] px-5 py-8 text-center"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,245,255,0.08),transparent_65%)]" />
              <p className="relative text-xs font-semibold uppercase tracking-[0.35em] text-accent-cyan">Descanso</p>
              <div className="relative mt-6 flex justify-center">
                <Timer remaining={restRemaining} total={restTotal} size="lg" />
              </div>
              <p className="relative mt-5 text-sm text-gray-400">
                Siguiente: <span className="text-white">{currentExercise?.name || 'Último ejercicio'}</span>
              </p>
              <button
                type="button"
                onClick={skipRest}
                className="relative mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                <FiSkipForward size={14} /> Saltar descanso
              </button>
            </motion.section>
          ) : (
            <motion.section
              key="focus"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#121622] to-[#090b12] p-6 sm:p-8"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary-500/15 blur-3xl" />
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
                Ejercicio {currentIndex + 1} de {totalExercises}
              </p>
              <h2 className="mt-3 font-display text-3xl text-white sm:text-4xl">
                {currentExercise?.name || 'Sesión completa'}
              </h2>
              {currentExercise && (
                <p className="mt-2 text-lg text-gray-400">
                  {currentExercise.sets} series · {currentExercise.reps} reps
                </p>
              )}
              {currentExercise && !completedExercises.includes(currentExercise.id) && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => toggleExercise(currentExercise.id)}
                  className="btn-primary mt-7 inline-flex w-full items-center justify-center gap-2 py-3.5 sm:w-auto sm:min-w-[220px]"
                >
                  <FiCheck size={18} /> Completar ejercicio
                </motion.button>
              )}
              {completedCount === totalExercises && (
                <p className="mt-6 text-accent-green">Todo listo — finaliza para guardar.</p>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Exercise checklist — progress implied by checks only */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">Lista</p>
          <div className="space-y-2">
            {activeWorkout.exercises.map((exercise, index) => {
              const done = completedExercises.includes(exercise.id)
              const isCurrent = currentExercise?.id === exercise.id && !done
              return (
                <motion.button
                  id={`workout-exercise-${exercise.id}`}
                  key={exercise.id}
                  type="button"
                  layout
                  whileTap={{ scale: 0.985 }}
                  onClick={() => toggleExercise(exercise.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                    done
                      ? 'border-accent-green/30 bg-accent-green/10'
                      : isCurrent
                        ? 'border-primary-500/40 bg-primary-500/10'
                        : 'border-white/8 bg-white/[0.03] hover:border-white/15'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? 'bg-accent-green text-black'
                        : isCurrent
                          ? 'bg-primary-500 text-black'
                          : 'bg-white/10 text-gray-400'
                    }`}
                  >
                    {done ? <FiCheck size={14} /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-medium ${done ? 'text-accent-green line-through opacity-80' : 'text-white'}`}>
                      {exercise.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {exercise.sets}×{exercise.reps}
                    </span>
                  </span>
                  {isCurrent && <FiPlay className="shrink-0 text-primary-400" size={16} />}
                </motion.button>
              )
            })}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="font-display text-3xl text-white sm:text-5xl">Entrenamientos</h1>
          <p className="mt-2 max-w-lg text-sm text-gray-400 sm:text-base">Elige una rutina e inicia. Tu sesión sigue activa si cambias de pantalla.</p>
        </div>
        <button type="button" onClick={() => setShowCreateModal(true)} className="btn-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm sm:w-auto sm:self-start">
          <FiPlus size={18} /> Nueva rutina
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {templates.map((template, i) => (
          <motion.article
            key={template.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            className={`group relative overflow-hidden rounded-[1.75rem] border bg-gradient-to-br p-5 sm:p-6 ${COLOR_MAP[template.color] || COLOR_MAP.primary}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-400">
                  {template.exercises.length} ejercicios
                </p>
                <h2 className="mt-2 font-display text-2xl text-white">{template.name}</h2>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/30 text-lg font-bold text-white/80">
                {template.exercises.length}
              </span>
            </div>
            <ul className="mt-4 space-y-1.5">
              {template.exercises.slice(0, 3).map((ex) => (
                <li key={ex.id} className="truncate text-sm text-gray-400">
                  {ex.name}
                  <span className="text-gray-600"> · {ex.sets}×{ex.reps}</span>
                </li>
              ))}
              {template.exercises.length > 3 && (
                <li className="text-xs text-gray-500">+{template.exercises.length - 3} más</li>
              )}
            </ul>
            <button
              type="button"
              onClick={() => startWorkout(template)}
              className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3"
            >
              <FiPlay size={16} /> Iniciar
            </button>
          </motion.article>
        ))}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 sm:px-6 sm:py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="card max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-y-auto p-5 sm:p-6"
            >
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-400">Nueva rutina</p>
                  <h2 className="font-display text-2xl">Crea tu plan</h2>
                </div>
                <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                  <FiX size={24} />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm text-gray-400">Nombre</label>
                  <input
                    type="text"
                    value={newRoutine.name}
                    onChange={(e) => setNewRoutine((c) => ({ ...c, name: e.target.value }))}
                    placeholder="Ej: Día de fuerza"
                    className="input-field"
                  />
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm text-gray-400">Ejercicios</p>
                    <button type="button" onClick={addExerciseField} className="inline-flex items-center gap-2 text-sm text-primary-500 hover:text-primary-400">
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
                          <button type="button" onClick={() => removeExercise(index)} className="text-red-500 hover:text-red-400">
                            <FiTrash2 size={20} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary w-full py-3">
                    Cancelar
                  </button>
                  <button type="button" onClick={saveNewRoutine} className="btn-primary w-full py-3">
                    Guardar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
