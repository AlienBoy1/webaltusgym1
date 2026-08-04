import { useEffect, useRef } from 'react'
import { getWorkoutSession, setWorkoutSession, sendWorkoutNotification, clearWorkoutNotification } from '../utils/workoutSession'

export default function WorkoutSessionManager() {
  const lastSession = useRef(getWorkoutSession())

  useEffect(() => {
    const tick = async () => {
      const session = getWorkoutSession()
      if (!session?.activeWorkout) {
        if (lastSession.current?.activeWorkout) {
          await clearWorkoutNotification()
        }
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

      setWorkoutSession(updatedSession)

      if (document.visibilityState !== 'visible') {
        const previous = lastSession.current || {}
        const nowNotification = previous.notificationSentAt || 0
        const elapsedSinceNotification = now - nowNotification
        const progressChanged =
          previous?.completedExercises?.length !== updatedSession.completedExercises.length ||
          previous?.activeWorkout?.id !== updatedSession.activeWorkout.id

        const shouldSendNotification =
          !previous?.activeWorkout ||
          progressChanged ||
          elapsedSinceNotification >= 15000

        if (shouldSendNotification) {
          await sendWorkoutNotification(updatedSession)
          updatedSession.notificationSentAt = now
        }
      }

      lastSession.current = updatedSession
    }

    const interval = window.setInterval(tick, 1000)
    tick()
    return () => window.clearInterval(interval)
  }, [])

  return null
}
