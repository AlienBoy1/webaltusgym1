import { isNativeApp } from './appMode'

const WORKOUT_SESSION_KEY = 'qyntra:workout_session'
const WORKOUT_PREFERENCES_KEY = 'qyntra:workout_preferences'
const WORKOUT_BUBBLE_POS_KEY = 'qyntra:workout_bubble_pos'
const SESSION_EVENT = 'qyntra:workout-session'
/** Legacy LocalNotifications ids. Native WorkoutHud uses 99101. */
const NATIVE_NOTIF_ID = 42001
const WORKOUT_HUD_NOTIF_ID = 99101
const NATIVE_CHANNEL_ID = 'qyntra_workout_live_v11'
const ACTION_TYPE_ID = 'WORKOUT_SESSION_ACTIONS'
const DEFAULT_REST_SECONDS = 60

let nativeChannelReady = false
let nativeActionsReady = false
let lastNativeBody = ''
let workoutHudPlugin = null

async function getWorkoutHud() {
  if (workoutHudPlugin) return workoutHudPlugin
  const { registerPlugin } = await import('@capacitor/core')
  workoutHudPlugin = registerPlugin('WorkoutHud')
  return workoutHudPlugin
}

async function ensureNativeWorkoutChannel() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.createChannel({
      id: NATIVE_CHANNEL_ID,
      name: 'Entreno en vivo',
      description: 'Temporizador de sesión',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: false
    })
    nativeChannelReady = true
  } catch {
    nativeChannelReady = true
  }
}

async function ensureNativeWorkoutActions() {
  if (nativeActionsReady) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: ACTION_TYPE_ID,
          actions: [
            { id: 'complete', title: 'Completar ejercicio', foreground: false },
            { id: 'skip_rest', title: 'Saltar descanso', foreground: false },
            { id: 'open', title: 'Abrir entreno', foreground: true }
          ]
        }
      ]
    })
    nativeActionsReady = true
  } catch {
    nativeActionsReady = true
  }
}

/**
 * Native workout HUD via NotificationManager only (no AlarmManager / LocalNotifications.schedule).
 * Scheduled LN needs SCHEDULE_EXACT_ALARM and often never fires on Android 13+.
 */
async function sendNativeWorkoutNotification(session) {
  const copy = buildWorkoutNotificationCopy(session, Date.now(), { omitLiveTimers: true })
  if (!copy) return { ok: false, error: 'Sesión inválida' }

  const restEndsAtMs = session.restEndsAt ? new Date(session.restEndsAt).getTime() : 0
  const sessionStartMs = session.sessionStart
    ? new Date(session.sessionStart).getTime()
    : Date.now()
  const inRest = copy.restRemaining > 0 && Number.isFinite(restEndsAtMs) && restEndsAtMs > 0
  const whenMs = inRest ? restEndsAtMs : (Number.isFinite(sessionStartMs) ? sessionStartMs : Date.now())

  const fingerprint = `${copy.body}|${copy.actionHint}|${whenMs}|${inRest ? 1 : 0}`

  const WorkoutHud = await getWorkoutHud()

  // If we think we already showed, confirm it's still in the shade
  if (fingerprint === lastNativeBody) {
    try {
      const status = await WorkoutHud.checkPermissions()
      if (Number(status?.activeCount) > 0) return { ok: true }
      lastNativeBody = ''
    } catch {
      lastNativeBody = ''
    }
  }

  const content = `${copy.workoutName} · ${copy.body}`
  const bubbleLabel = inRest
    ? `Descanso · ${copy.exerciseLabel}`
    : (copy.exerciseLabel || copy.workoutName || 'Entreno')

  // Permission
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions()
    }
    if (perm.display !== 'granted') {
      try {
        await WorkoutHud.requestPermissions()
      } catch {
        /* ignore */
      }
      try {
        await WorkoutHud.openNotificationSettings()
      } catch {
        /* ignore */
      }
      return { ok: false, error: 'Activa Notificaciones para Qyntra en Ajustes' }
    }
  } catch (e) {
    console.warn('permission step:', e?.message || e)
  }

  try {
    const result = await WorkoutHud.show({
      title: copy.title,
      content,
      bigText: content,
      bubbleLabel,
      showChronometer: true,
      countDown: inRest,
      whenMs
    })
    const active = Number(result?.activeCount)
    if (result?.ok && (active > 0 || Number.isNaN(active) || active < 0)) {
      lastNativeBody = fingerprint
      // Do not schedule LocalNotifications backup — it races exact alarms and can
      // fight NotificationManager on the same channel after a successful native post.
      return { ok: true, activeCount: active, channelId: result?.channelId, overlay: result?.overlay }
    }
    return {
      ok: false,
      error: `No visible (active=${active})`
    }
  } catch (hudErr) {
    const msg = hudErr?.message || String(hudErr)
    console.warn('WorkoutHud.show:', msg)
    // Last resort: LocalNotifications alone
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await ensureNativeWorkoutChannel()
      await LocalNotifications.schedule({
        notifications: [
          {
            id: NATIVE_NOTIF_ID,
            title: copy.title,
            body: content,
            channelId: NATIVE_CHANNEL_ID,
            ongoing: true,
            autoCancel: false,
            schedule: { at: new Date(Date.now() + 400) }
          }
        ]
      })
      lastNativeBody = fingerprint
      return { ok: true, fallback: 'local-notifications' }
    } catch (lnErr) {
      return { ok: false, error: msg }
    }
  }
}

/** Open "display over other apps" settings (bubble outside the app). Call AFTER notif works. */
export async function requestWorkoutOverlayPermission() {
  try {
    const WorkoutHud = await getWorkoutHud()
    const perms = await WorkoutHud.checkPermissions()
    if (perms?.overlay === 'granted') {
      try {
        await WorkoutHud.startOverlay()
      } catch {
        /* optional */
      }
      return 'granted'
    }
    await WorkoutHud.requestOverlayPermission()
    return 'prompt'
  } catch {
    return 'denied'
  }
}

/** Force next sendNativeWorkoutNotification to re-post (e.g. after app resume). */
export function invalidateNativeWorkoutHudFingerprint() {
  lastNativeBody = ''
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
    window.dispatchEvent(new CustomEvent('qyntra:workout-preferences'))
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
  const done = new Set(session.completedExercises || [])
  const next = session.activeWorkout.exercises.find((exercise) => !done.has(exercise.id))
  return next || null
}

export function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0))
  const minutes = Math.floor(safe / 60)
  const remaining = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

/**
 * @param {{ omitLiveTimers?: boolean }} [opts]
 * omitLiveTimers: native HUD uses system chronometer — body must stay stable.
 */
function buildWorkoutNotificationCopy(session, now = Date.now(), opts = {}) {
  const workout = session?.activeWorkout
  if (!workout) return null

  const nextExercise = getCurrentExercise(session)
  const elapsed = getElapsedSeconds(session, now)
  const restRemaining = getRestRemaining(session, now)
  const done = session.completedExercises?.length || 0
  const total = workout.exercises?.length || 0
  const exerciseLabel = nextExercise?.name || 'Sesión completa'
  const omitLiveTimers = Boolean(opts.omitLiveTimers)

  const title = 'Entrenamiento en curso'
  let body
  let actionHint = 'complete'
  if (restRemaining > 0) {
    body = omitLiveTimers
      ? `Descanso · Luego: ${exerciseLabel}`
      : `${formatTime(elapsed)} · Descanso ${formatTime(restRemaining)} · Luego: ${exerciseLabel}`
    actionHint = 'skip_rest'
  } else if (!nextExercise) {
    body = omitLiveTimers
      ? `Completado ${done}/${total} · Listo para finalizar`
      : `${formatTime(elapsed)} · Completado ${done}/${total} · Listo para finalizar`
    actionHint = 'open'
  } else {
    body = omitLiveTimers
      ? `Ahora: ${exerciseLabel} · ${done}/${total}`
      : `${formatTime(elapsed)} · Ahora: ${exerciseLabel} · ${done}/${total}`
    actionHint = 'complete'
  }

  return {
    title,
    body,
    workoutName: workout.name,
    exerciseId: nextExercise?.id || '',
    elapsed,
    restRemaining,
    exerciseLabel,
    done,
    total,
    actionHint
  }
}

/**
 * Mark current exercise complete + start rest (shared by UI + notification action).
 */
export function completeCurrentExerciseInSession() {
  const session = getWorkoutSession()
  if (!session?.activeWorkout) return null
  const current = getCurrentExercise(session)
  if (!current) return session

  const prefs = getWorkoutPreferences() || {}
  const restSeconds = Number(prefs.restTimerDefault) || DEFAULT_REST_SECONDS
  const autoRest = prefs.autoStartTimer !== false
  const completed = [...(session.completedExercises || []), current.id]
  const now = Date.now()

  const next = {
    ...session,
    completedExercises: completed,
    workoutTime: getElapsedSeconds(session, now),
    restActive: autoRest,
    restEndsAt: autoRest ? new Date(now + restSeconds * 1000).toISOString() : null,
    restRemaining: autoRest ? restSeconds : 0,
    restDuration: restSeconds,
    restTimerSource: autoRest ? current.id : null,
    savedAt: new Date().toISOString()
  }
  setWorkoutSession(next)
  return next
}

export function skipRestInSession() {
  const session = getWorkoutSession()
  if (!session?.activeWorkout) return null
  const next = {
    ...session,
    restActive: false,
    restEndsAt: null,
    restRemaining: 0,
    restTimerSource: null,
    workoutTime: getElapsedSeconds(session),
    savedAt: new Date().toISOString()
  }
  setWorkoutSession(next)
  return next
}

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

async function clearNativeWorkoutNotification() {
  lastNativeBody = ''
  try {
    const WorkoutHud = await getWorkoutHud()
    await WorkoutHud.clear()
  } catch {
    /* ignore */
  }
}

async function sendWebWorkoutNotification(session) {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return false
  const copy = buildWorkoutNotificationCopy(session)
  if (!copy) return false

  const registration = await navigator.serviceWorker.ready.catch(() => null)
  if (!registration) return false

  // Same tag replaces in place (no close+reopen)
  registration.showNotification(copy.title, {
    body: `${copy.workoutName} · ${copy.body}`,
    icon: '/pwa-192x192.png',
    badge: '/badge-96x96.png',
    tag: 'qyntra-workout-session',
    renotify: false,
    requireInteraction: true,
    silent: true,
    data: {
      type: 'NOTIFICATION_CLICK',
      url: `/workouts?focus=${copy.exerciseId || ''}`
    }
  })
  return true
}

export async function sendWorkoutNotification(session) {
  if (!session?.activeWorkout) return false
  const hasCapacitor =
    isNativeApp() ||
    (typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.() || window.Capacitor?.getPlatform?.()))

  if (hasCapacitor) {
    try {
      const result = await sendNativeWorkoutNotification(session)
      if (result && typeof result === 'object') {
        if (!result.ok && result.error) {
          console.warn('workout HUD:', result.error)
          // Stash last error for UI toasts
          try {
            window.__qyntraLastHudError = result.error
          } catch {
            /* ignore */
          }
        }
        return Boolean(result.ok)
      }
      return Boolean(result)
    } catch (err) {
      console.warn('native workout notification:', err?.message || err)
      try {
        window.__qyntraLastHudError = err?.message || String(err)
      } catch {
        /* ignore */
      }
      return false
    }
  }
  try {
    return await sendWebWorkoutNotification(session)
  } catch {
    return false
  }
}

export async function clearWorkoutNotification() {
  if (isNativeApp()) {
    await clearNativeWorkoutNotification()
    return
  }
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  if (!registration) return
  const notifications = await registration.getNotifications({ tag: 'qyntra-workout-session' })
  notifications.forEach((notification) => notification.close())
}

/** Wire notification action buttons + native workout notification actions. */
export async function bindNativeWorkoutNotificationActions() {
  if (!isNativeApp()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await ensureNativeWorkoutActions()
    await LocalNotifications.addListener('localNotificationActionPerformed', async (event) => {
      const actionId = event?.actionId
      const notifId = Number(event?.notification?.id)
      const extra = event?.notification?.extra || {}
      if (notifId !== NATIVE_NOTIF_ID && extra.type !== 'workout_session') return

      if (actionId === 'complete') {
        const next = completeCurrentExerciseInSession()
        if (next) await sendWorkoutNotification(next)
        return
      }
      if (actionId === 'skip_rest') {
        const next = skipRestInSession()
        if (next) await sendWorkoutNotification(next)
        return
      }
      const url = extra.url || '/workouts'
      window.location.assign(url.startsWith('/') ? url : `/${url}`)
    })
  } catch (err) {
    console.warn('bindNativeWorkoutNotificationActions:', err?.message || err)
  }

  // Native WorkoutHud action buttons (MainActivity → custom event)
  try {
    window.addEventListener('qyntra:workout-action', async (event) => {
      const action = event?.detail?.action
      if (action === 'complete') {
        const next = completeCurrentExerciseInSession()
        if (next) await sendWorkoutNotification(next)
        return
      }
      if (action === 'skip_rest') {
        const next = skipRestInSession()
        if (next) await sendWorkoutNotification(next)
      }
    })
  } catch {
    /* ignore */
  }
}

export {
  WORKOUT_SESSION_KEY,
  WORKOUT_PREFERENCES_KEY,
  WORKOUT_BUBBLE_POS_KEY,
  SESSION_EVENT,
  NATIVE_NOTIF_ID,
  DEFAULT_REST_SECONDS
}
