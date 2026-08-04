import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPlus,
  FiPlay,
  FiCheck,
  FiClock,
  FiZap,
  FiChevronDown,
  FiSave,
  FiX,
  FiTrash2
} from 'react-icons/fi'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import Timer from '../../components/Timer'
import { useConfetti } from '../../components/Confetti'
import { getWorkoutPreferences, getCurrentExercise } from '../../utils/workoutSession'

const WORKOUT_TEMPLATES_KEY = 'qyntra:workout_templates'
const WORKOUT_SESSION_KEY = 'qyntra:workout_session'
const DEFAULT_REST_SECONDS = 60

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

export default function Workouts() {
  const location = useLocation()
  const exerciseScrollRef = useRef(null)
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
  const [restTimerSource, setRestTimerSource] = useState(null)
  const [completedExercises, setCompletedExercises] = useState([])
  const [showTimer, setShowTimer] = useState(false)
  const [workoutTime, setWorkoutTime] = useState(0)
  const [preferences, setPreferences] = useState(() => getWorkoutPreferences() || { restTimerDefault: DEFAULT_REST_SECONDS })
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

  useEffect(() => {
    try {
      const stored = localStorage.getItem(WORKOUT_SESSION_KEY)
      if (!stored) return
      const saved = JSON.parse(stored)
      if (!saved?.activeWorkout || !saved?.sessionStart) return

      const startedAt = new Date(saved.sessionStart).getTime()
      const now = Date.now()
      const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000))
      const restEndsAt = saved.restEndsAt ? new Date(saved.restEndsAt).getTime() : null
      const restRemaining = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0

      setActiveWorkout(saved.activeWorkout)
      setSessionStart(saved.sessionStart)
      setCompletedExercises(saved.completedExercises || [])
      setWorkoutTime(elapsed)
      setRestActive(restRemaining > 0)
      setRestEndsAt(saved.restEndsAt || null)
      setRestRemaining(restRemaining)
      setRestTimerSource(saved.restTimerSource || null)
      setShowTimer(restRemaining > 0)
    } catch {
      localStorage.removeItem(WORKOUT_SESSION_KEY)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const focusExercise = params.get('focus')
    if (activeWorkout && focusExercise) {
      const target = document.getElementById(`workout-exercise-${focusExercise}`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeWorkout, location.search])

  useEffect(() => {
    if (!activeWorkout) {
      localStorage.removeItem(WORKOUT_SESSION_KEY)
      return
    }

    const payload = {
      activeWorkout,
      sessionStart,
      completedExercises,
      restActive,
      restRemaining,
      restEndsAt,
      restTimerSource,
      workoutTime,
      savedAt: new Date().toISOString()
    }

    localStorage.setItem(WORKOUT_SESSION_KEY, JSON.stringify(payload))
  }, [activeWorkout, sessionStart, completedExercises, restActive, restRemaining, restEndsAt, restTimerSource, workoutTime])

  useEffect(() => {
    let interval
    if (activeWorkout) {
      interval = window.setInterval(() => {
        const now = Date.now()
        if (sessionStart) {
          const elapsed = Math.max(0, Math.floor((now - new Date(sessionStart).getTime()) / 1000))
          setWorkoutTime(elapsed)
        }

        if (restActive && restEndsAt) {
          const remaining = Math.max(0, Math.ceil((new Date(restEndsAt).getTime() - now) / 1000))
          setRestRemaining(remaining)
          if (remaining <= 0) {
            setRestActive(false)
            setShowTimer(false)
            setRestEndsAt(null)
          }
        }
      }, 1000)
    }
    return () => window.clearInterval(interval)
  }, [activeWorkout, restActive, restEndsAt, sessionStart])

  // Notification updates are handled globally by WorkoutSessionManager.
  // Keep this hook only for explicit actions like start / cancel / finish.

  const completedCount = completedExercises.length
  const progress = activeWorkout ? Math.round((completedCount / activeWorkout.exercises.length) * 100) : 0

  const toggleExercise = (exerciseId) => {
    const isNowCompleted = !completedExercises.includes(exerciseId)
    setCompletedExercises((prev) => {
      const nextCompleted = isNowCompleted ? [...prev, exerciseId] : prev.filter((id) => id !== exerciseId)

      if (isNowCompleted) {
        const restSeconds = preferences?.restTimerDefault || DEFAULT_REST_SECONDS
        const endsAt = new Date(Date.now() + restSeconds * 1000).toISOString()
        setRestActive(true)
        setRestEndsAt(endsAt)
        setRestRemaining(restSeconds)
        setRestTimerSource(exerciseId)
        setShowTimer(true)
      } else {
        if (restTimerSource === exerciseId || nextCompleted.length === 0) {
          setRestActive(false)
          setRestEndsAt(null)
          setRestRemaining(0)
          setRestTimerSource(null)
          setShowTimer(false)
        }
      }

      return nextCompleted
    })
  }

  const startWorkout = (workout) => {
    setActiveWorkout(workout)
    setSessionStart(new Date().toISOString())
    setCompletedExercises([])
    setWorkoutTime(0)
    setRestActive(false)
    setRestRemaining(0)
    setRestEndsAt(null)
    setRestTimerSource(null)
    setShowTimer(false)
    setWorkoutNotification(workout, 0, [])
  }

  const cancelWorkout = () => {
    setActiveWorkout(null)
    setSessionStart(null)
    setCompletedExercises([])
    setShowTimer(false)
    setWorkoutTime(0)
    setRestActive(false)
    setRestRemaining(0)
    setRestEndsAt(null)
    setRestTimerSource(null)
    clearWorkoutNotification()
  }

  const finishWorkout = async () => {
    if (!activeWorkout) return
    setSaving(true)
    try {
      await api.post('/workouts', {
        name: activeWorkout.name,
        exercises: activeWorkout.exercises.map((exercise) => ({
          ...exercise,
          completed: completedExercises.includes(exercise.id)
        })),
        duration: Math.floor(workoutTime / 60),
        completedAt: new Date().toISOString()
      })
      celebration()
      toast.success('¡Entrenamiento registrado con éxito! 💪')
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo guardar el entrenamiento')
    } finally {
      setSaving(false)
      setActiveWorkout(null)
      setSessionStart(null)
      setCompletedExercises([])
      setShowTimer(false)
      setWorkoutTime(0)
      setRestActive(false)
      setRestRemaining(0)
      setRestEndsAt(null)
      setRestTimerSource(null)
      clearWorkoutNotification()
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
    toast.success('Rutina guardada correctamente')
  }

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const remaining = seconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
  }

  const clearWorkoutNotification = async () => {
    if (!('serviceWorker' in navigator)) return
    const registration = await navigator.serviceWorker.ready.catch(() => null)
    if (!registration) return
    const notifications = await registration.getNotifications({ tag: 'qyntra-workout-session' })
    notifications.forEach((notification) => notification.close())
  }

  const setWorkoutNotification = async (workout, totalSeconds, completed = []) => {
    if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return
    const nextExercise = workout.exercises.find((exercise) => !completed.includes(exercise.id))
    const body = `Sesión: ${workout.name} · ${completed.length}/${workout.exercises.length} · Tiempo ${formatTime(totalSeconds)} · Siguiente: ${nextExercise ? nextExercise.name : 'Finalizando'}`
    const registration = await navigator.serviceWorker.ready.catch(() => null)
    if (!registration) return

    registration.showNotification('Entrenamiento en curso', {
      body,
      icon: '/pwa-192x192.png',
      badge: '/badge-96x96.png',
      tag: 'qyntra-workout-session',
      renotify: true,
      requireInteraction: false,
      data: {
        type: 'NOTIFICATION_CLICK',
        url: `/workouts?focus=${nextExercise?.id || ''}`
      }
    })
  }

  const timerLabel = restActive
    ? 'Descanso en curso'
    : completedCount === 0
      ? 'Marca tu primer ejercicio'
      : 'Marca el siguiente ejercicio para activar el descanso'

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Rutinas premium</p>
          <h1 className="font-display text-5xl text-white">Entrenamientos premium</h1>
          <p className="mt-3 max-w-2xl text-gray-400">Diseñado para que tu sesión se mantenga activa en todo momento, con descansos sincronizados, seguimiento continuo y un diseño avanzado.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm">
          <FiPlus size={18} /> Crear nueva rutina
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_0.95fr]">
        <div className="space-y-6">
          {activeWorkout ? (
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#07080E]/95 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-6"
            >
              <div className="pointer-events-none absolute -right-28 top-0 h-72 w-72 rounded-full bg-primary-500/12 blur-3xl" />
              <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

              <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm uppercase tracking-[0.35em] text-primary-300">Rutina activa</p>
                  <h2 className="font-display text-4xl sm:text-5xl text-white mt-4 leading-tight">{activeWorkout.name}</h2>
                  <p className="mt-4 max-w-xl text-gray-400">El temporizador general y el descanso se sincronizan juntos para mantenerte en ritmo incluso si cambias de pantalla.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.75rem] border border-white/10 bg-black/40 p-5 text-center">
                    <p className="text-sm text-gray-400 uppercase tracking-[0.2em]">Tiempo total</p>
                    <p className="mt-3 text-3xl sm:text-4xl font-semibold text-white">{formatTime(workoutTime)}</p>
                  </div>
                  <div className="rounded-[1.75rem] border border-white/10 bg-black/40 p-5 text-center">
                    <p className="text-sm text-gray-400 uppercase tracking-[0.2em]">Progreso</p>
                    <p className="mt-3 text-3xl sm:text-4xl font-semibold text-white">{progress}%</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-5 xl:grid-cols-[1.45fr_0.95fr]">
                <div className="space-y-5">
                  <div className="rounded-[1.75rem] border border-white/10 bg-[#0E1119]/85 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-gray-400">{timerLabel}</p>
                        <p className="mt-2 text-lg font-semibold text-white">{restActive ? `Descanso: ${formatTime(restRemaining)}` : 'Sigue marcando ejercicios para mantener el ritmo'}</p>
                      </div>
                      <button
                        onClick={() => setShowTimer(true)}
                        className="inline-flex w-full justify-center rounded-3xl border border-primary-500/20 bg-primary-500/10 px-4 py-3 text-sm text-primary-200 transition hover:bg-primary-500/15 sm:w-auto"
                      >
                        {restActive ? 'Ver descanso' : 'Abrir temporizador'}
                      </button>
                    </div>

                    {restActive && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-3xl bg-white/5 p-4">
                          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Descanso restante</p>
                          <p className="mt-2 text-2xl font-semibold text-white">{formatTime(restRemaining)}</p>
                        </div>
                        <div className="rounded-3xl bg-white/5 p-4">
                          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Siguiente meta</p>
                          <p className="mt-2 text-lg text-white">Recupera para la próxima serie</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3">
                    {activeWorkout.exercises.map((exercise) => {
                      const completed = completedExercises.includes(exercise.id)
                      return (
                        <motion.button
                          id={`workout-exercise-${exercise.id}`}
                          key={exercise.id}
                          layout
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleExercise(exercise.id)}
                          className={`group rounded-[2rem] border p-5 text-left transition-all duration-200 ${
                            completed
                              ? 'border-accent-green bg-accent-green/10 text-accent-green shadow-[0_20px_60px_rgba(34,197,94,0.12)]'
                              : 'border-white/10 bg-[#10131D] hover:border-primary-500/40 hover:bg-[#13172A]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xl font-semibold">{exercise.name}</p>
                              <p className="mt-1 text-sm text-gray-400">{exercise.sets} sets · {exercise.reps} reps</p>
                            </div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${completed ? 'border-accent-green bg-accent-green text-black' : 'border-gray-500 text-gray-400'}`}>
                              {completed ? <FiCheck size={18} /> : <FiPlay size={16} />}
                            </div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                <aside className="space-y-5">
                  <div className="rounded-[2rem] border border-white/10 bg-[#08101F]/90 p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Sesión activa</p>
                        <p className="mt-2 text-lg font-semibold text-white">{activeWorkout.exercises.length} ejercicios</p>
                      </div>
                      <div className="rounded-3xl bg-gradient-to-br from-primary-500 to-accent-400 px-4 py-3 text-sm font-semibold text-black">
                        LIVE
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div className="rounded-3xl bg-black/30 p-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Rutina en curso</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{formatTime(workoutTime)}</p>
                      </div>
                      <div className="rounded-3xl bg-black/30 p-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Ejercicios completados</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{completedCount}/{activeWorkout.exercises.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-[#0D1320]/90 p-6">
                    <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Ritmo de entrenamiento</p>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-4 text-sm text-gray-300">El temporizador de descanso se sincroniza con la sesión completa para mantener el ritmo en segundo plano.</p>
                  </div>

                  <div className="grid gap-3">
                    <button onClick={cancelWorkout} className="btn-secondary w-full py-3">Cancelar rutina</button>
                    <button onClick={finishWorkout} disabled={saving} className="btn-primary w-full py-3">
                      {saving ? 'Guardando...' : `Finalizar (${completedCount}/${activeWorkout.exercises.length})`}
                    </button>
                  </div>
                </aside>
              </div>

              <AnimatePresence>
                {showTimer && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-6 rounded-[1.75rem] border border-white/10 bg-[#0B0F18]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-6">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Descanso</p>
                        <p className="text-lg font-semibold text-white">Temporizador en segundo plano</p>
                      </div>
                      <button onClick={() => setShowTimer(false)} className="text-gray-400 hover:text-white self-start sm:self-auto">Cerrar</button>
                    </div>
                    <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
                      <div className="w-full max-w-[280px] mx-auto">
                        <Timer initialTime={restRemaining || DEFAULT_REST_SECONDS} autoStart={restActive} size="lg" onComplete={() => setShowTimer(false)} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Tu descanso continúa si cambias de pantalla. Vuelve cuando quieras y retoma donde quedaste.</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Descanso restante</p>
                            <p className="mt-2 text-xl font-semibold text-white">{formatTime(restRemaining)}</p>
                          </div>
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Tiempo total</p>
                            <p className="mt-2 text-xl font-semibold text-white">{formatTime(workoutTime)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          ) : (
            <section className="space-y-3">
              <p className="text-sm text-gray-400">Selecciona una rutina para comenzar y mejora la experiencia con un panel más limpio y fluido.</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                {templates.slice(0, 2).map((template) => (
                  <motion.article
                    key={template.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card rounded-[2rem] border-white/10 bg-gradient-to-br from-dark-300 to-dark-200 p-6"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-gray-400">{template.color} training</p>
                        <h2 className="mt-3 text-2xl font-semibold">{template.name}</h2>
                      </div>
                      <div className="text-primary-500 text-5xl">{template.exercises.length}</div>
                    </div>
                    <p className="mt-4 text-sm text-gray-400">Perfecta para entrenar con estructura y ritmo.</p>
                    <button onClick={() => startWorkout(template)} className="btn-primary mt-6 w-full py-3">Iniciar ahora</button>
                  </motion.article>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card rounded-[2rem] p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Resumen</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-dark-400/70 p-4 text-center">
                <p className="text-sm text-gray-400">Rutinas guardadas</p>
                <p className="mt-2 text-3xl font-semibold">{templates.length}</p>
              </div>
              <div className="rounded-3xl bg-dark-400/70 p-4 text-center">
                <p className="text-sm text-gray-400">Ejercicios totales</p>
                <p className="mt-2 text-3xl font-semibold">{templates.reduce((sum, item) => sum + item.exercises.length, 0)}</p>
              </div>
            </div>
          </div>

          <div className="card rounded-[2rem] p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Guía rápida</p>
            <ul className="mt-4 space-y-3 text-sm text-gray-300">
              <li className="rounded-3xl bg-dark-400/60 p-4">Marca cada ejercicio al completar para mantener orden y progreso.</li>
              <li className="rounded-3xl bg-dark-400/60 p-4">Usa el botón de descanso para recuperar energía entre series.</li>
              <li className="rounded-3xl bg-dark-400/60 p-4">Finaliza la rutina para registrar el entrenamiento y obtener feedback.</li>
            </ul>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 sm:px-6 sm:py-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="card w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                  <p className="text-sm text-gray-400">Nueva rutina</p>
                  <h2 className="font-display text-2xl">Crea tu plan perfecto</h2>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white"><FiX size={24} /></button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Nombre de la rutina</label>
                  <input
                    type="text"
                    value={newRoutine.name}
                    onChange={(e) => setNewRoutine((current) => ({ ...current, name: e.target.value }))}
                    placeholder="Ej: Día de fuerza"
                    className="input-field"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-400">Ejercicios</p>
                    <button onClick={addExerciseField} className="text-primary-500 hover:text-primary-400 text-sm inline-flex items-center gap-2">
                      <FiPlus /> Agregar ejercicio
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newRoutine.exercises.map((exercise, index) => (
                      <div key={exercise.id} className="grid gap-2 lg:grid-cols-[1.6fr_0.7fr_0.7fr_40px] items-center">
                        <input
                          type="text"
                          value={exercise.name}
                          onChange={(e) => updateExercise(index, 'name', e.target.value)}
                          placeholder="Nombre del ejercicio"
                          className="input-field w-full"
                        />
                        <input
                          type="number"
                          value={exercise.sets}
                          onChange={(e) => updateExercise(index, 'sets', Number(e.target.value) || 1)}
                          min="1"
                          className="input-field w-full"
                        />
                        <input
                          type="text"
                          value={exercise.reps}
                          onChange={(e) => updateExercise(index, 'reps', e.target.value)}
                          className="input-field w-full"
                        />
                        {newRoutine.exercises.length > 1 ? (
                          <button onClick={() => removeExercise(index)} className="text-red-500 hover:text-red-400">
                            <FiTrash2 size={20} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button onClick={() => setShowCreateModal(false)} className="btn-secondary w-full py-3">Cancelar</button>
                  <button onClick={saveNewRoutine} className="btn-primary w-full py-3">Guardar rutina</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
