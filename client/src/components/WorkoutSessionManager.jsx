import { useEffect, useRef } from 'react'
import {
  getWorkoutSession,
  getElapsedSeconds,
  getRestRemaining,
  sendWorkoutNotification,
  clearWorkoutNotification
} from '../utils/workoutSession'
import { isNativeApp } from '../utils/appMode'

/** Soft-update session timers in storage; native HUD is updated only on structural changes */
const TICK_MS = 1000

function getExerciseKey(session) {
  if (!session?.activeWorkout) return ''
  const done = session.completedExercises || []
  const next = session.activeWorkout.exercises?.find((e) => !done.includes(e.id))
  return `${next?.id || 'done'}|${session.restEndsAt || ''}|${done.length}`
}

export default function WorkoutSessionManager() {
  const lastSession = useRef(getWorkoutSession())
  const lastStructureKey = useRef('')
  const nativeHudShown = useRef(false)

  useEffect(() => {
    const tick = async () => {
      const session = getWorkoutSession()

      if (!session?.activeWorkout) {
        if (lastSession.current?.activeWorkout) {
          await clearWorkoutNotification()
        }
        lastSession.current = session
        lastStructureKey.current = ''
        nativeHudShown.current = false
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
        // Never reschedule every second — Android chronometer ticks in place.
        // Refresh HUD only when exercise / rest phase changes (or first show).
        if (structuralChange || !nativeHudShown.current) {
          const ok = await sendWorkoutNotification(updatedSession)
          if (ok) nativeHudShown.current = true
        }
      } else {
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

    const interval = window.setInterval(tick, TICK_MS)
    tick()

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  return null
}
