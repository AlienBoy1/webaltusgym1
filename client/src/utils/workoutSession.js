const WORKOUT_SESSION_KEY = 'qyntra:workout_session'
const WORKOUT_PREFERENCES_KEY = 'qyntra:workout_preferences'

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
  } catch {
    // ignore
  }
}

export function clearWorkoutSession() {
  try {
    window.localStorage.removeItem(WORKOUT_SESSION_KEY)
  } catch {
    // ignore
  }
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

export function getCurrentExercise(session) {
  if (!session?.activeWorkout?.exercises?.length) return null
  const next = session.activeWorkout.exercises.find((exercise) => !session.completedExercises.includes(exercise.id))
  return next || session.activeWorkout.exercises[session.activeWorkout.exercises.length - 1]
}

export async function sendWorkoutNotification(session) {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return
  const nextExercise = getCurrentExercise(session)
  const body = `Sesión: ${session.activeWorkout.name} · ${session.completedExercises.length}/${session.activeWorkout.exercises.length} · Tiempo ${formatTime(session.workoutTime)} · Siguiente: ${nextExercise ? nextExercise.name : 'Finalizando'}`
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

export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

export { WORKOUT_SESSION_KEY, WORKOUT_PREFERENCES_KEY }
