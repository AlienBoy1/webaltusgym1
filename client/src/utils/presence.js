import { useSyncExternalStore } from 'react'

export const PRESENCE_STATUS = {
  TRAINING: 'training',
  CHALLENGE: 'challenge',
  STORY: 'story',
  CHAT: 'chat',
  AWAY: 'away',
  ONLINE: 'online',
  OFFLINE: 'offline'
}

export const CHALLENGE_TIMER_ACTIVE_KEY = 'qyntra:challenge_timer_active'
export const CHALLENGE_TIMER_EVENT = 'qyntra:challenge-timer'
export const STORY_OPEN_EVENT = 'qyntra:story-open'
export const STORY_CLOSE_EVENT = 'qyntra:story-close'

export const AWAY_MS = 5 * 60 * 1000
export const PRESENCE_HEARTBEAT_MS = 30 * 1000

const STATUS_META = {
  [PRESENCE_STATUS.TRAINING]: {
    color: '#f97316',
    label: 'Entrenando',
    ringClass: 'bg-orange-500',
    textClass: 'text-orange-400'
  },
  [PRESENCE_STATUS.CHALLENGE]: {
    color: '#eab308',
    label: 'En reto',
    ringClass: 'bg-yellow-400',
    textClass: 'text-yellow-400'
  },
  [PRESENCE_STATUS.STORY]: {
    color: '#7dd3fc',
    label: 'Viendo historia',
    ringClass: 'bg-sky-300',
    textClass: 'text-sky-300'
  },
  [PRESENCE_STATUS.CHAT]: {
    color: '#3b82f6',
    label: 'En chat',
    ringClass: 'bg-blue-500',
    textClass: 'text-blue-400'
  },
  [PRESENCE_STATUS.AWAY]: {
    color: '#a8a29e',
    label: 'Ausente',
    ringClass: 'bg-amber-700/80',
    textClass: 'text-amber-600'
  },
  [PRESENCE_STATUS.ONLINE]: {
    color: '#22c55e',
    label: 'En línea',
    ringClass: 'bg-accent-green',
    textClass: 'text-accent-green'
  },
  [PRESENCE_STATUS.OFFLINE]: {
    color: '#6b7280',
    label: 'Desconectado',
    ringClass: 'bg-gray-500',
    textClass: 'text-gray-500'
  }
}

export function getPresenceMeta(status) {
  return STATUS_META[status] || STATUS_META[PRESENCE_STATUS.OFFLINE]
}

export function setChallengeTimerActive(active) {
  try {
    if (active) window.localStorage.setItem(CHALLENGE_TIMER_ACTIVE_KEY, '1')
    else window.localStorage.removeItem(CHALLENGE_TIMER_ACTIVE_KEY)
    window.dispatchEvent(new CustomEvent(CHALLENGE_TIMER_EVENT, { detail: { active: Boolean(active) } }))
  } catch {
    /* ignore */
  }
}

export function isChallengeTimerActive() {
  try {
    return window.localStorage.getItem(CHALLENGE_TIMER_ACTIVE_KEY) === '1'
  } catch {
    return false
  }
}

export function dispatchStoryOpen(detail = {}) {
  window.dispatchEvent(new CustomEvent(STORY_OPEN_EVENT, { detail }))
}

export function dispatchStoryClose(detail = {}) {
  window.dispatchEvent(new CustomEvent(STORY_CLOSE_EVENT, { detail }))
}

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click', 'pointerdown']

export function startActivityListeners(onActivity, { passive = true } = {}) {
  const handler = () => onActivity()
  ACTIVITY_EVENTS.forEach((event) => {
    window.addEventListener(event, handler, { passive })
  })
  return () => {
    ACTIVITY_EVENTS.forEach((event) => {
      window.removeEventListener(event, handler)
    })
  }
}

/** @type {Map<string, string>} */
let presenceMap = new Map()
const mapListeners = new Set()

function notifyMapListeners() {
  mapListeners.forEach((cb) => {
    try {
      cb(presenceMap)
    } catch (e) {
      console.error(e)
    }
  })
}

export function setPresenceMap(next) {
  presenceMap = next instanceof Map ? new Map(next) : new Map(Object.entries(next || {}))
  notifyMapListeners()
}

export function patchUserPresence(userId, status) {
  if (!userId) return
  const next = new Map(presenceMap)
  if (!status || status === PRESENCE_STATUS.OFFLINE) next.delete(String(userId))
  else next.set(String(userId), status)
  presenceMap = next
  notifyMapListeners()
}

export function getPresenceMap() {
  return presenceMap
}

export function getUserStatus(userId) {
  if (!userId) return PRESENCE_STATUS.OFFLINE
  return presenceMap.get(String(userId)) || PRESENCE_STATUS.OFFLINE
}

export function subscribePresenceMap(callback) {
  mapListeners.add(callback)
  callback(presenceMap)
  return () => mapListeners.delete(callback)
}

function subscribeStatus(userId, onStoreChange) {
  return subscribePresenceMap(() => onStoreChange())
}

export function usePresenceStatus(userId) {
  const id = userId ? String(userId) : null
  return useSyncExternalStore(
    (onStoreChange) => (id ? subscribeStatus(id, onStoreChange) : () => {}),
    () => (id ? getUserStatus(id) : PRESENCE_STATUS.OFFLINE),
    () => PRESENCE_STATUS.OFFLINE
  )
}

/**
 * Resolve local presence status by priority (training → … → online).
 */
export function resolveLocalStatus({
  training = false,
  challenge = false,
  story = false,
  chat = false,
  away = false
} = {}) {
  if (training) return PRESENCE_STATUS.TRAINING
  if (challenge) return PRESENCE_STATUS.CHALLENGE
  if (story) return PRESENCE_STATUS.STORY
  if (chat) return PRESENCE_STATUS.CHAT
  if (away) return PRESENCE_STATUS.AWAY
  return PRESENCE_STATUS.ONLINE
}

export function hasActiveChallengeParticipant(challenges, userId) {
  if (!userId || !Array.isArray(challenges)) return false
  const uid = String(userId)
  return challenges.some((c) => {
    const participant = c.participants?.find((p) => {
      const pid = p.user?._id || p.user?.id || p.user
      return pid && String(pid) === uid
    })
    return participant?.status === 'active' && Boolean(participant?.startedAt)
  })
}
