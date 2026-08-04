import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getWorkoutSession,
  setWorkoutSession,
  getElapsedSeconds,
  getRestRemaining,
  sendWorkoutNotification,
  clearWorkoutNotification
} from '../utils/workoutSession'

export default function WorkoutSessionManager() {
  const location = useLocation()
  const lastSession = useRef(getWorkoutSession())
  const hasSentBackgroundNotification = useRef(Boolean(lastSession.current?.notificationSentAt))

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
      if (shouldNotifyInBackground) {
        if (!hasSentBackgroundNotification.current) {
          await sendWorkoutNotification(updatedSession)
          updatedSession.notificationSentAt = now
          hasSentBackgroundNotification.current = true
        }
      } else {
        if (lastSession.current?.activeWorkout && hasSentBackgroundNotification.current) {
          await clearWorkoutNotification()
        }
        hasSentBackgroundNotification.current = false
        updatedSession.notificationSentAt = null
      }

      const prev = lastSession.current
      const structuralChange =
        prev?.activeWorkout?.id !== updatedSession.activeWorkout?.id ||
        prev?.restEndsAt !== updatedSession.restEndsAt ||
        (prev?.completedExercises?.length || 0) !== (updatedSession.completedExercises?.length || 0) ||
        prev?.notificationSentAt !== updatedSession.notificationSentAt

      // Soft-update time in storage; notify UI only on structural changes
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
