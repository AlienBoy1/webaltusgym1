const WORKOUT_SESSION_KEY = 'qyntra:workout_session'
const WORKOUT_PREFERENCES_KEY = 'qyntra:workout_preferences'
const WORKOUT_BUBBLE_POS_KEY = 'qyntra:workout_bubble_pos'
const SESSION_EVENT = 'qyntra:workout-session'

export function getWorkoutSession() {
  try {
    const stored = window.localStorage.getItem(WORKOUT_SESSION_KEY)
    if (!stored) return null
    const session = JSON.parse(stored)
    if (!session?.activeWorkout) return null
    return {
      ...session,
      workoutTime: typeof session.workoutTime === 'number' ? session.workoutTime : 0,
      completedExercises: Array.isArray(session.completedExercises) ? session.completedExercises : []
    }
  } catch {
    return null
  }
}

export function setWorkoutSession(session) {
  try {
    window.localStorage.setItem(WORKOUT_SESSION_KEY, JSON.stringify(session))
    window.dispatchEvent(new CustomEvent(SESSION_EVENT))
  } catch {
    // ignore
  }
}

export function clearWorkoutSession() {
  try {
    window.localStorage.removeItem(WORKOUT_SESSION_KEY)
    window.dispatchEvent(new CustomEvent(SESSION_EVENT))
  } catch {
    // ignore
  }
}

export function subscribeWorkoutSession(callback) {
  const notify = () => callback(getWorkoutSession())
  window.addEventListener(SESSION_EVENT, notify)
  window.addEventListener('storage', notify)
  return () => {
    window.removeEventListener(SESSION_EVENT, notify)
    window.removeEventListener('storage', notify)
  }
}

/** Elapsed seconds from absolute sessionStart — source of truth for live display */
export function getElapsedSeconds(session, now = Date.now()) {
  if (!session?.sessionStart) return session?.workoutTime || 0
  const startedAt = new Date(session.sessionStart).getTime()
  if (Number.isNaN(startedAt)) return session?.workoutTime || 0
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

export function getRestRemaining(session, now = Date.now()) {
  if (!session?.restEndsAt) return 0
  const endsAt = new Date(session.restEndsAt).getTime()
  if (Number.isNaN(endsAt)) return 0
  return Math.max(0, Math.ceil((endsAt - now) / 1000))
}

export function getWorkoutPreferences() {
  try {
    const stored = window.localStorage.getItem(WORKOUT_PREFERENCES_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch {
    return null
  }
}

export function setWorkoutPreferences(preferences) {
  try {
    window.localStorage.setItem(WORKOUT_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // ignore
  }
}

export function getBubblePosition(defaults = { x: null, y: null }) {
  try {
    const stored = window.localStorage.getItem(WORKOUT_BUBBLE_POS_KEY)
    if (!stored) return defaults
    const parsed = JSON.parse(stored)
    if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number') return defaults
    return parsed
  } catch {
    return defaults
  }
}

export function setBubblePosition(pos) {
  try {
    window.localStorage.setItem(WORKOUT_BUBBLE_POS_KEY, JSON.stringify(pos))
  } catch {
    // ignore
  }
}

export function getCurrentExercise(session) {
  if (!session?.activeWorkout?.exercises?.length) return null
  const next = session.activeWorkout.exercises.find(
    (exercise) => !session.completedExercises.includes(exercise.id)
  )
  return next || session.activeWorkout.exercises[session.activeWorkout.exercises.length - 1]
}

export function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0))
  const minutes = Math.floor(safe / 60)
  const remaining = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

export async function sendWorkoutNotification(session) {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return
  const nextExercise = getCurrentExercise(session)
  const elapsed = getElapsedSeconds(session)
  const body = `Sesión: ${session.activeWorkout.name} · ${session.completedExercises.length}/${session.activeWorkout.exercises.length} · Tiempo ${formatTime(elapsed)} · Siguiente: ${nextExercise ? nextExercise.name : 'Finalizando'}`
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  if (!registration) return

  const existing = await registration.getNotifications({ tag: 'qyntra-workout-session' }).catch(() => [])
  existing.forEach((notification) => notification.close())

  registration.showNotification('Entrenamiento en curso', {
    body,
    icon: '/pwa-192x192.png',
    badge: '/badge-96x96.png',
    tag: 'qyntra-workout-session',
    renotify: false,
    requireInteraction: true,
    silent: true,
    data: {
      type: 'NOTIFICATION_CLICK',
      url: `/workouts?focus=${nextExercise?.id || ''}`
    }
  })
}

export async function clearWorkoutNotification() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  if (!registration) return
  const notifications = await registration.getNotifications({ tag: 'qyntra-workout-session' })
  notifications.forEach((notification) => notification.close())
}

export {
  WORKOUT_SESSION_KEY,
  WORKOUT_PREFERENCES_KEY,
  WORKOUT_BUBBLE_POS_KEY,
  SESSION_EVENT
}
