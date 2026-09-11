import { useEffect, useRef } from 'react'
import {
  getWorkoutSession,
  getElapsedSeconds,
  getRestRemaining,
  sendWorkoutNotification,
  clearWorkoutNotification,
  invalidateNativeWorkoutHudFingerprint,
  WORKOUT_SESSION_KEY
} from '../utils/workoutSession'
import { isNativeApp } from '../utils/appMode'

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
  const emptyTicks = useRef(0)
  const failStreak = useRef(0)

  useEffect(() => {
    let removeAppListener = null

    const tick = async () => {
      const session = getWorkoutSession()

      if (!session?.activeWorkout) {
        emptyTicks.current += 1
        // Immediate cleanup after cancel — do not wait 15s
        if (lastSession.current?.activeWorkout) {
          await clearWorkoutNotification()
          lastSession.current = session
          lastStructureKey.current = ''
          nativeHudShown.current = false
          failStreak.current = 0
        }
        return
      }

      emptyTicks.current = 0

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

      // Never revive a cancelled session: re-check before write
      const stillActive = getWorkoutSession()
      if (
        !stillActive?.activeWorkout ||
        (stillActive.activeWorkout.id || stillActive.activeWorkout.name || stillActive.sessionStart) !==
          (session.activeWorkout.id || session.activeWorkout.name || session.sessionStart)
      ) {
        return
      }

      try {
        window.localStorage.setItem(WORKOUT_SESSION_KEY, JSON.stringify({
          ...stillActive,
          workoutTime: elapsed,
          restRemaining,
          restActive,
          restEndsAt: restActive ? stillActive.restEndsAt : null,
          savedAt: updatedSession.savedAt
        }))
      } catch {
        /* ignore */
      }
      if (structuralChange) {
        window.dispatchEvent(new CustomEvent('qyntra:workout-session'))
        lastStructureKey.current = structureKey
      }

      if (isNativeApp()) {
        if ((structuralChange || !nativeHudShown.current) && failStreak.current < 3) {
          // Bail if cancelled while awaiting permission / notify
          if (!getWorkoutSession()?.activeWorkout) return
          const ok = await sendWorkoutNotification(getWorkoutSession() || updatedSession)
          if (!getWorkoutSession()?.activeWorkout) {
            await clearWorkoutNotification()
            return
          }
          if (ok) {
            nativeHudShown.current = true
            failStreak.current = 0
          } else {
            failStreak.current += 1
          }
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

      if (getWorkoutSession()?.activeWorkout) {
        lastSession.current = updatedSession
      }
    }

    const interval = window.setInterval(tick, TICK_MS)
    tick()

    if (isNativeApp()) {
      ;(async () => {
        try {
          const { App } = await import('@capacitor/app')
          const handle = await App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) return
            if (getWorkoutSession()?.activeWorkout) {
              invalidateNativeWorkoutHudFingerprint()
              nativeHudShown.current = false
              failStreak.current = 0
              tick()
              ;(async () => {
                try {
                  const { hideWorkoutOverlay, maybeShowWorkoutOverlayAfterSettingsReturn } =
                    await import('../utils/workoutSession')
                  await hideWorkoutOverlay()
                  const justGranted = await maybeShowWorkoutOverlayAfterSettingsReturn()
                  if (justGranted) {
                    const { default: toast } = await import('react-hot-toast')
                    toast.success('Burbuja lista. Se verá al salir de Qyntra.', { duration: 4000 })
                  }
                } catch {
                  /* optional */
                }
              })()
            }
          })
          removeAppListener = () => {
            handle?.remove?.()
          }
        } catch {
          /* optional */
        }
      })()
    }

    return () => {
      window.clearInterval(interval)
      removeAppListener?.()
    }
  }, [])

  return null
}
