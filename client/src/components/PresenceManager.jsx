import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getWorkoutSession, subscribeWorkoutSession } from '../utils/workoutSession'
import { trackPresence, onChatEvent, getPresenceSnapshot } from '../utils/socket'
import {
  AWAY_MS,
  CHALLENGE_TIMER_EVENT,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_STATUS,
  STORY_CLOSE_EVENT,
  STORY_OPEN_EVENT,
  getUserStatus,
  isChallengeTimerActive,
  patchUserPresence,
  resolveLocalStatus,
  setPresenceMap,
  startActivityListeners
} from '../utils/presence'

/**
 * Tracks the current user's rich presence and keeps a global presence map in sync.
 * Mount once inside MainLayout (inside Router).
 */
export default function PresenceManager() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const userId = user?.id || user?._id || null

  const statusRef = useRef(null)
  const trainingRef = useRef(Boolean(getWorkoutSession()?.activeWorkout))
  const challengeRef = useRef(isChallengeTimerActive())
  const storyRef = useRef(false)
  const awayRef = useRef(false)
  const lastActivityRef = useRef(Date.now())
  const pathRef = useRef(location.pathname)

  useEffect(() => {
    pathRef.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    if (!userId) return undefined

    const push = (status) => {
      statusRef.current = status
      trackPresence({
        user_id: userId,
        status,
        updated_at: new Date().toISOString()
      })
      patchUserPresence(userId, status)
    }

    const recompute = (force = false) => {
      const next = resolveLocalStatus({
        training: trainingRef.current,
        challenge: challengeRef.current,
        story: storyRef.current,
        chat: String(pathRef.current || '').startsWith('/chat'),
        away: awayRef.current
      })
      if (force || next !== statusRef.current) push(next)
    }

    trainingRef.current = Boolean(getWorkoutSession()?.activeWorkout)
    challengeRef.current = isChallengeTimerActive()
    setPresenceMap(getPresenceSnapshot())
    recompute(true)

    const unsubWorkout = subscribeWorkoutSession((session) => {
      trainingRef.current = Boolean(session?.activeWorkout)
      recompute()
    })

    const onStoryOpen = () => {
      storyRef.current = true
      lastActivityRef.current = Date.now()
      awayRef.current = false
      recompute()
    }
    const onStoryClose = () => {
      storyRef.current = false
      recompute()
    }
    document.addEventListener(STORY_OPEN_EVENT, onStoryOpen)
    document.addEventListener(STORY_CLOSE_EVENT, onStoryClose)

    const onChallengeFlag = () => {
      challengeRef.current = isChallengeTimerActive()
      recompute()
    }
    window.addEventListener(CHALLENGE_TIMER_EVENT, onChallengeFlag)
    window.addEventListener('storage', onChallengeFlag)

    const markActive = () => {
      lastActivityRef.current = Date.now()
      if (awayRef.current) {
        awayRef.current = false
        recompute()
      }
    }
    const stopActivity = startActivityListeners(markActive)

    const awayTimer = window.setInterval(() => {
      const idle = Date.now() - lastActivityRef.current >= AWAY_MS
      if (idle !== awayRef.current) {
        awayRef.current = idle
        recompute()
      }
    }, 15_000)

    const pollChallenge = async () => {
      // Prefer local timer flag — avoid heavy /challenges/my on every minute
      try {
        const active = isChallengeTimerActive()
        if (active !== challengeRef.current) {
          challengeRef.current = active
          recompute()
        }
      } catch {
        /* keep last known */
      }
    }
    pollChallenge()
    const challengePoll = window.setInterval(pollChallenge, 60_000)

    const heartbeat = window.setInterval(() => {
      push(statusRef.current)
    }, PRESENCE_HEARTBEAT_MS)

    const unsubSync = onChatEvent('presenceSync', (map) => {
      setPresenceMap(map)
    })
    const unsubOnline = onChatEvent('userOnline', (id) => {
      if (!id) return
      if (getUserStatus(id) === PRESENCE_STATUS.OFFLINE) {
        patchUserPresence(id, PRESENCE_STATUS.ONLINE)
      }
    })
    const unsubOffline = onChatEvent('userOffline', (id) => {
      if (id) patchUserPresence(id, PRESENCE_STATUS.OFFLINE)
    })

    return () => {
      unsubWorkout()
      document.removeEventListener(STORY_OPEN_EVENT, onStoryOpen)
      document.removeEventListener(STORY_CLOSE_EVENT, onStoryClose)
      window.removeEventListener(CHALLENGE_TIMER_EVENT, onChallengeFlag)
      window.removeEventListener('storage', onChallengeFlag)
      stopActivity()
      window.clearInterval(awayTimer)
      window.clearInterval(challengePoll)
      window.clearInterval(heartbeat)
      unsubSync()
      unsubOnline()
      unsubOffline()
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const next = resolveLocalStatus({
      training: trainingRef.current,
      challenge: challengeRef.current,
      story: storyRef.current,
      chat: location.pathname.startsWith('/chat'),
      away: awayRef.current
    })
    if (next !== statusRef.current) {
      statusRef.current = next
      trackPresence({
        user_id: userId,
        status: next,
        updated_at: new Date().toISOString()
      })
      patchUserPresence(userId, next)
    }
  }, [location.pathname, userId])

  return null
}
