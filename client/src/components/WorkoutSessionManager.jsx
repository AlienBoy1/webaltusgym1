import { useEffect, useRef } from 'react'
import {
  getWorkoutSession,
  getElapsedSeconds,
  getRestRemaining,
  sendWorkoutNotification,
  clearWorkoutNotification
} from '../utils/workoutSession'
import { isNativeApp } from '../utils/appMode'

/** Live timer refresh — same notification id + quiet channel = silent in-place update */
const NATIVE_TICK_MS = 1000
/** If user dismisses ongoing notif, bring it back after this delay */
const REDISPLAY_AFTER_DISMISS_MS = 3000

function getExerciseKey(session) {
  if (!session?.activeWorkout) return ''
  const done = session.completedExercises || []
  const next = session.activeWorkout.exercises?.find((e) => !done.includes(e.id))
  return `${next?.id || 'done'}|${session.restEndsAt || ''}|${done.length}`
}

export default function WorkoutSessionManager() {
  const lastSession = useRef(getWorkoutSession())
  const lastStructureKey = useRef('')
  const dismissedAt = useRef(0)

  useEffect(() => {
    const tick = async () => {
      const session = getWorkoutSession()

      if (!session?.activeWorkout) {
        if (lastSession.current?.activeWorkout) {
          await clearWorkoutNotification()
        }
        lastSession.current = session
        lastStructureKey.current = ''
        dismissedAt.current = 0
        return
      }

      const now = Date.now()
      const elapsed = getElapsedSeconds(session, now)
      const restRemaining = getRestRemaining(session, now)
      const restActive = restRemaining > 0

      const updatedSession = {
        ...session,
        workoutTime: elapsed,
        restRemaining,
        restActive,
        restEndsAt: restActive ? session.restEndsAt : null,
        savedAt: new Date().toISOString()
      }

      const structureKey = getExerciseKey(updatedSession)
      const structuralChange = structureKey !== lastStructureKey.current

      // Soft-update time in storage
      try {
        window.localStorage.setItem('qyntra:workout_session', JSON.stringify(updatedSession))
      } catch {
        /* ignore */
      }
      if (structuralChange) {
        window.dispatchEvent(new CustomEvent('qyntra:workout-session'))
        lastStructureKey.current = structureKey
      }

      if (isNativeApp()) {
        // Keep ONE ongoing notification for the whole session (foreground or background).
        // Capacitor uses setOnlyAlertOnce + quiet channel → no sound spam.
        const waitDismiss =
          dismissedAt.current && now - dismissedAt.current < REDISPLAY_AFTER_DISMISS_MS
        if (!waitDismiss) {
          await sendWorkoutNotification(updatedSession)
          dismissedAt.current = 0
        }
      } else {
        // Web: only when tab hidden
        const hidden = document.visibilityState !== 'visible'
        if (hidden) {
          await sendWorkoutNotification(updatedSession)
        } else if (lastSession.current?.notificationSentAt) {
          await clearWorkoutNotification()
          updatedSession.notificationSentAt = null
        }
      }

      lastSession.current = updatedSession
    }

    const interval = window.setInterval(tick, isNativeApp() ? NATIVE_TICK_MS : 1000)
    tick()

    const onVisibility = () => {
      // no clear on native when returning to app — notification stays as mini HUD
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
