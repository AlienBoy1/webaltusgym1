import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getWorkoutSession, setWorkoutSession, sendWorkoutNotification, clearWorkoutNotification } from '../utils/workoutSession'

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
      const startedAt = new Date(session.sessionStart).getTime()
      const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000))
      let restRemaining = 0
      let restActive = false
      let restEndsAt = session.restEndsAt

      if (session.restEndsAt) {
        const endsAt = new Date(session.restEndsAt).getTime()
        restRemaining = Math.max(0, Math.ceil((endsAt - now) / 1000))
        restActive = restRemaining > 0
        if (!restActive) {
          restEndsAt = null
        }
      }

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

      setWorkoutSession(updatedSession)
      lastSession.current = updatedSession
    }

    const interval = window.setInterval(tick, 1000)
    tick()
    return () => window.clearInterval(interval)
  }, [location.pathname])

  return null
}
