import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getWorkoutSession,
  getElapsedSeconds,
  getRestRemaining,
  sendWorkoutNotification,
  clearWorkoutNotification
} from '../utils/workoutSession'
import { isNativeApp } from '../utils/appMode'

const NOTIFY_INTERVAL_MS = 5000

function getExerciseKey(session) {
  if (!session?.activeWorkout) return ''
  const done = session.completedExercises || []
  const next = session.activeWorkout.exercises?.find((e) => !done.includes(e.id))
  return next?.id || 'done'
}

export default function WorkoutSessionManager() {
  const location = useLocation()
  const lastSession = useRef(getWorkoutSession())
  const hasSentBackgroundNotification = useRef(Boolean(lastSession.current?.notificationSentAt))
  const lastNotifyAt = useRef(0)

  useEffect(() => {
    const tick = async () => {
      const session = getWorkoutSession()
      const isWorkoutsRoute = location.pathname === '/workouts'
      const hidden = document.visibilityState !== 'visible'

      if (!session?.activeWorkout) {
        if (lastSession.current?.activeWorkout) {
          await clearWorkoutNotification()
        }
        hasSentBackgroundNotification.current = false
        lastNotifyAt.current = 0
        lastSession.current = session
        return
      }

      const now = Date.now()
      const elapsed = getElapsedSeconds(session, now)
      const restRemaining = getRestRemaining(session, now)
      const restActive = restRemaining > 0
      const restEndsAt = restActive ? session.restEndsAt : null

      const updatedSession = {
        ...session,
        workoutTime: elapsed,
        restRemaining,
        restActive,
        restEndsAt,
        savedAt: new Date().toISOString()
      }

      const shouldNotifyInBackground = hidden || !isWorkoutsRoute
      const exerciseChanged =
        getExerciseKey(lastSession.current) !== getExerciseKey(updatedSession) ||
        lastSession.current?.restEndsAt !== updatedSession.restEndsAt
      const dueForRefresh =
        !lastNotifyAt.current || now - lastNotifyAt.current >= NOTIFY_INTERVAL_MS || exerciseChanged

      if (shouldNotifyInBackground) {
        // Native: keep refreshing so the shade shows live timer + current exercise
        if (!hasSentBackgroundNotification.current || (isNativeApp() && dueForRefresh)) {
          await sendWorkoutNotification(updatedSession)
          updatedSession.notificationSentAt = now
          hasSentBackgroundNotification.current = true
          lastNotifyAt.current = now
        }
      } else {
        if (lastSession.current?.activeWorkout && hasSentBackgroundNotification.current) {
          await clearWorkoutNotification()
        }
        hasSentBackgroundNotification.current = false
        lastNotifyAt.current = 0
        updatedSession.notificationSentAt = null
      }

      const prev = lastSession.current
      const structuralChange =
        prev?.activeWorkout?.id !== updatedSession.activeWorkout?.id ||
        prev?.restEndsAt !== updatedSession.restEndsAt ||
        (prev?.completedExercises?.length || 0) !== (updatedSession.completedExercises?.length || 0) ||
        prev?.notificationSentAt !== updatedSession.notificationSentAt

      try {
        window.localStorage.setItem('qyntra:workout_session', JSON.stringify(updatedSession))
      } catch {
        // ignore
      }
      if (structuralChange) {
        window.dispatchEvent(new CustomEvent('qyntra:workout-session'))
      }
      lastSession.current = updatedSession
    }

    const interval = window.setInterval(tick, 1000)
    tick()
    return () => window.clearInterval(interval)
  }, [location.pathname])

  return null
}
