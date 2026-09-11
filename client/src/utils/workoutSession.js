import { isNativeApp } from './appMode'

const WORKOUT_SESSION_KEY = 'qyntra:workout_session'
const WORKOUT_PREFERENCES_KEY = 'qyntra:workout_preferences'
const WORKOUT_BUBBLE_POS_KEY = 'qyntra:workout_bubble_pos'
const SESSION_EVENT = 'qyntra:workout-session'
/** Legacy LocalNotifications ids. Native WorkoutHud uses 99101. */
const NATIVE_NOTIF_ID = 42001
const WORKOUT_HUD_NOTIF_ID = 99101
const NATIVE_CHANNEL_ID = 'qyntra_workout_live_v17'
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
            { id: 'complete', title: 'Ejercicio completado', foreground: false },
            { id: 'skip_rest', title: 'Saltar descanso', foreground: false },
            { id: 'open', title: 'Abrir', foreground: true },
            { id: 'cancel', title: 'Cancelar', foreground: true }
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
 * Native workout HUD — triple path:
 * 1) window.QyntraNative (JavascriptInterface — bypasses Capacitor)
 * 2) Capacitor WorkoutHud plugin
 * 3) LocalNotifications with isExactNotification:false (no exact-alarm trap)
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
  if (fingerprint === lastNativeBody) {
    return { ok: true, cached: true }
  }

  const content = `${copy.workoutName} · ${copy.body}`
  const bubbleLabel = inRest
    ? `Descanso · ${copy.exerciseLabel}`
    : (copy.exerciseLabel || copy.workoutName || 'Entrenando')
  const progress =
    copy.total > 0 ? Math.max(0.08, Math.min(1, (copy.done || 0) / copy.total)) : 0.08

  const errors = []

  // 0) Ask permission via LocalNotifications (reliable system dialog) + native bridge
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions()
    }
    if (perm.display !== 'granted') {
      try {
        window.QyntraNative?.requestNotificationPermission?.()
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    errors.push(`LN.perm:${e?.message || e}`)
    try {
      window.QyntraNative?.requestNotificationPermission?.()
    } catch {
      /* ignore */
    }
  }

  // 1) Direct JavascriptInterface (does not depend on Capacitor plugin registry)
  try {
    if (typeof window !== 'undefined' && window.QyntraNative?.showWorkout) {
      const raw = window.QyntraNative.showWorkout(
        copy.title,
        content,
        bubbleLabel,
        inRest,
        whenMs,
        progress
      )
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (parsed?.ok) {
        lastNativeBody = fingerprint
        return { ok: true, via: 'QyntraNative', ...parsed }
      }
      errors.push(`bridge:${parsed?.error || 'not-ok'}`)
    } else {
      errors.push('bridge:missing')
    }
  } catch (e) {
    errors.push(`bridge:${e?.message || e}`)
  }

  // 2) Capacitor plugin fallback
  try {
    const WorkoutHud = await getWorkoutHud()
    try {
      await WorkoutHud.requestPermissions()
    } catch {
      /* continue */
    }
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
      return { ok: true, via: 'WorkoutHud', activeCount: active }
    }
    errors.push(`plugin:active=${active}`)
  } catch (e) {
    errors.push(`plugin:${e?.message || e}`)
  }

  // 3) LocalNotifications inexact schedule (Capacitor 8.3+ — avoid exact-alarm settings trap)
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await ensureNativeWorkoutChannel()
    await ensureNativeWorkoutActions()
    await LocalNotifications.schedule({
      notifications: [
        {
          id: WORKOUT_HUD_NOTIF_ID,
          title: copy.title,
          body: content,
          largeBody: content,
          channelId: NATIVE_CHANNEL_ID,
          ongoing: true,
          autoCancel: false,
          smallIcon: 'ic_stat_qyntra_q',
          actionTypeId: ACTION_TYPE_ID,
          extra: { type: 'workout_session' },
          schedule: {
            at: new Date(Date.now() + 800),
            allowWhileIdle: true,
            isExactNotification: false
          }
        }
      ]
    })
    // Still mark HUD prefs so onPause can show the system bubble after overlay grant
    try {
      if (typeof window !== 'undefined' && window.QyntraNative?.showWorkout) {
        window.QyntraNative.showWorkout(
          copy.title,
          content,
          bubbleLabel,
          inRest,
          whenMs,
          progress
        )
      }
    } catch {
      /* bridge optional */
    }
    lastNativeBody = fingerprint
    return { ok: true, via: 'LocalNotifications' }
  } catch (e) {
    errors.push(`LN:${e?.message || e}`)
  }

  return { ok: false, error: errors.join(' | ') || 'No se pudo publicar la notificación' }
}

/** Open "display over other apps" settings (bubble outside the app). Call AFTER notif works. */
export async function checkWorkoutOverlayPermission() {
  try {
    if (typeof window !== 'undefined' && window.QyntraNative?.checkStatus) {
      const statusRaw = window.QyntraNative.checkStatus()
      const status = typeof statusRaw === 'string' ? JSON.parse(statusRaw) : statusRaw
      return status?.overlay === 'granted' ? 'granted' : 'denied'
    }
    const WorkoutHud = await getWorkoutHud()
    const perms = await WorkoutHud.checkPermissions()
    return perms?.overlay === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

const PENDING_OVERLAY_KEY = 'qyntra:pending-workout-overlay'

export function markPendingWorkoutOverlayPrompt() {
  try {
    window.localStorage.setItem(PENDING_OVERLAY_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearPendingWorkoutOverlayPrompt() {
  try {
    window.localStorage.removeItem(PENDING_OVERLAY_KEY)
    window.sessionStorage.removeItem(PENDING_OVERLAY_KEY)
  } catch {
    /* ignore */
  }
}

export function hasPendingWorkoutOverlayPrompt() {
  try {
    return (
      window.localStorage.getItem(PENDING_OVERLAY_KEY) === '1' ||
      window.sessionStorage.getItem(PENDING_OVERLAY_KEY) === '1'
    )
  } catch {
    return false
  }
}

/**
 * After notifications: ALWAYS show “Activar burbuja” if overlay is not granted.
 * Never draws the system overlay while the app is in the foreground.
 */
export async function promptWorkoutBubblePermission(dialog) {
  const { ensureOverlayPermission } = await import('./overlayPermission')
  return ensureOverlayPermission(dialog, {
    title: 'Activar burbuja',
    message:
      'Se abrirá Ajustes de Android. Activa “Aparecer encima de otras apps” para Qyntra y regresa a la app. Así verás el cronómetro flotante al salir de Qyntra.',
    confirmLabel: 'Configurar',
    cancelLabel: 'Cancelar',
    settleMs: 900
  })
}

/**
 * Call on app resume: if user just granted overlay, keep in-app unified (hide native).
 * Native bubble appears automatically on the next onPause (leaving the app).
 */
export async function maybeShowWorkoutOverlayAfterSettingsReturn() {
  try {
    const { hasPendingOverlayPermission, clearPendingOverlayPermission, checkOverlayPermission } =
      await import('./overlayPermission')
    if (!hasPendingOverlayPermission() && !hasPendingWorkoutOverlayPrompt()) return false
    if (!getWorkoutSession()?.activeWorkout) {
      // Still clear pending if chat-only grant
      const status = await checkOverlayPermission()
      if (status === 'granted') {
        clearPendingOverlayPermission()
        clearPendingWorkoutOverlayPrompt()
      }
      return status === 'granted'
    }
    const status = await checkOverlayPermission()
    if (status !== 'granted') return false
    clearPendingOverlayPermission()
    clearPendingWorkoutOverlayPrompt()
    await hideWorkoutOverlay()
    return true
  } catch {
    return false
  }
}

/** Hide system overlay while using the app (React bubble stays). */
export async function hideWorkoutOverlay() {
  try {
    if (typeof window !== 'undefined' && window.QyntraNative?.hideOverlay) {
      window.QyntraNative.hideOverlay()
      return true
    }
    if (typeof window !== 'undefined' && window.QyntraNative?.forceShowOverlay) {
      // forceShowOverlay now only hides + warms cache
      window.QyntraNative.forceShowOverlay()
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export async function forceShowWorkoutOverlay() {
  // Intentionally does NOT draw over the app — only hides native + warms cache.
  return hideWorkoutOverlay()
}

export async function requestWorkoutOverlayPermission() {
  try {
    // Prefer direct bridge
    if (typeof window !== 'undefined' && window.QyntraNative) {
      try {
        const statusRaw = window.QyntraNative.checkStatus?.()
        const status = typeof statusRaw === 'string' ? JSON.parse(statusRaw) : statusRaw
        if (status?.overlay === 'granted') {
          window.QyntraNative.hideOverlay?.()
          return 'granted'
        }
        window.QyntraNative.openOverlaySettings?.()
        return 'prompt'
      } catch {
        /* fall through */
      }
    }
    const WorkoutHud = await getWorkoutHud()
    const perms = await WorkoutHud.checkPermissions()
    if (perms?.overlay === 'granted') {
      await hideWorkoutOverlay()
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

  const title = 'Entrenamiento en vivo'
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

/** Cancel active workout from notification / overlay actions. */
export function cancelWorkoutInSession() {
  clearWorkoutSession()
  return null
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
    window.QyntraNative?.clearWorkout?.()
  } catch {
    /* ignore */
  }
  try {
    const WorkoutHud = await getWorkoutHud()
    await WorkoutHud.clear()
  } catch {
    /* ignore */
  }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: WORKOUT_HUD_NOTIF_ID }, { id: NATIVE_NOTIF_ID }] })
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
      if (notifId !== NATIVE_NOTIF_ID && notifId !== WORKOUT_HUD_NOTIF_ID && extra.type !== 'workout_session') return

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
      if (actionId === 'cancel') {
        try {
          window.sessionStorage.setItem('qyntra:pending_cancel', '1')
        } catch {
          /* ignore */
        }
        window.dispatchEvent(new CustomEvent('qyntra:workout-cancel-request'))
        const url = extra.url || '/workouts'
        if (window.location.pathname !== '/workouts') {
          window.location.assign(url.startsWith('/') ? url : `/${url}`)
        }
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
        return
      }
      if (action === 'cancel') {
        try {
          window.sessionStorage.setItem('qyntra:pending_cancel', '1')
        } catch {
          /* ignore */
        }
        // Open workouts UI and ask for confirmation — never cancel silently
        window.dispatchEvent(new CustomEvent('qyntra:workout-cancel-request'))
        return
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
