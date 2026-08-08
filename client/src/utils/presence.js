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

const ONLINE_RANK = {
  [PRESENCE_STATUS.TRAINING]: 0,
  [PRESENCE_STATUS.CHALLENGE]: 1,
  [PRESENCE_STATUS.STORY]: 2,
  [PRESENCE_STATUS.CHAT]: 3,
  [PRESENCE_STATUS.ONLINE]: 4,
  [PRESENCE_STATUS.AWAY]: 5
}

export function getPresenceMeta(status) {
  return STATUS_META[status] || STATUS_META[PRESENCE_STATUS.OFFLINE]
}

export function isPresenceOnline(status) {
  return Boolean(status && status !== PRESENCE_STATUS.OFFLINE)
}

/**
 * Single active label (Messenger-style): live rich status OR relative last-seen.
 * Minutes while < 1h, then hours (then days as fallback).
 */
export function formatActivePresenceLabel(status, lastSeenAt, now = Date.now()) {
  if (isPresenceOnline(status)) {
    return getPresenceMeta(status).label
  }
  if (!lastSeenAt) return getPresenceMeta(PRESENCE_STATUS.OFFLINE).label
  const ts = typeof lastSeenAt === 'number' ? lastSeenAt : new Date(lastSeenAt).getTime()
  if (!Number.isFinite(ts)) return getPresenceMeta(PRESENCE_STATUS.OFFLINE).label
  const diffMs = Math.max(0, now - ts)
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Hace un momento'
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hace 1 día'
  return `Hace ${days} días`
}

/** @username if set; else first two words of name. */
export function presenceDisplayName(user) {
  const handle = String(user?.username || '')
    .replace(/^@+/, '')
    .trim()
  if (handle) return `@${handle}`
  const parts = String(user?.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'Usuario'
  return parts.slice(0, 2).join(' ')
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

/**
 * @typedef {{ status: string, updatedAt: number }} PresenceEntry
 * @type {Map<string, PresenceEntry>}
 */
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

function toTs(value, fallback = Date.now()) {
  if (value == null) return fallback
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = new Date(value).getTime()
  return Number.isFinite(n) ? n : fallback
}

/** Normalize status string or entry → PresenceEntry */
export function normalizePresenceEntry(value, fallbackUpdatedAt = Date.now()) {
  if (value == null) return null
  if (typeof value === 'string') {
    const status = value || PRESENCE_STATUS.OFFLINE
    return { status, updatedAt: fallbackUpdatedAt }
  }
  const status = value.status || PRESENCE_STATUS.OFFLINE
  return { status, updatedAt: toTs(value.updatedAt ?? value.updated_at, fallbackUpdatedAt) }
}

/**
 * Live channel sync: online users replace; anyone who dropped becomes offline with leave time.
 * Known offline timestamps are preserved when still offline.
 */
export function setPresenceMap(next) {
  const now = Date.now()
  const incoming = new Map()
  if (next instanceof Map) {
    next.forEach((v, k) => {
      const entry = normalizePresenceEntry(v, now)
      if (entry) incoming.set(String(k), entry)
    })
  } else if (next && typeof next === 'object') {
    Object.entries(next).forEach(([k, v]) => {
      const entry = normalizePresenceEntry(v, now)
      if (entry) incoming.set(String(k), entry)
    })
  }

  const result = new Map()
  incoming.forEach((entry, id) => {
    if (entry.status === PRESENCE_STATUS.OFFLINE) {
      const prev = presenceMap.get(id)
      result.set(id, {
        status: PRESENCE_STATUS.OFFLINE,
        updatedAt: prev?.status === PRESENCE_STATUS.OFFLINE ? prev.updatedAt : entry.updatedAt
      })
    } else {
      result.set(id, entry)
    }
  })

  presenceMap.forEach((prev, id) => {
    if (result.has(id)) return
    if (isPresenceOnline(prev.status)) {
      result.set(id, { status: PRESENCE_STATUS.OFFLINE, updatedAt: now })
    } else {
      result.set(id, {
        status: PRESENCE_STATUS.OFFLINE,
        updatedAt: prev.updatedAt || now
      })
    }
  })

  presenceMap = result
  notifyMapListeners()
}

export function patchUserPresence(userId, status, updatedAt) {
  if (!userId) return
  const id = String(userId)
  const next = new Map(presenceMap)
  const now = Date.now()
  if (!status || status === PRESENCE_STATUS.OFFLINE) {
    next.set(id, {
      status: PRESENCE_STATUS.OFFLINE,
      updatedAt: toTs(updatedAt, now)
    })
  } else {
    next.set(id, {
      status,
      updatedAt: toTs(updatedAt, now)
    })
  }
  presenceMap = next
  notifyMapListeners()
}

/** Seed last-seen from API without forcing online. */
export function hydrateLastSeen(userId, lastSeenAt) {
  if (!userId || !lastSeenAt) return
  const id = String(userId)
  const ts = toTs(lastSeenAt, NaN)
  if (!Number.isFinite(ts)) return
  const prev = presenceMap.get(id)
  if (prev && isPresenceOnline(prev.status)) return
  if (prev?.status === PRESENCE_STATUS.OFFLINE && prev.updatedAt >= ts) return
  const next = new Map(presenceMap)
  next.set(id, { status: PRESENCE_STATUS.OFFLINE, updatedAt: ts })
  presenceMap = next
  notifyMapListeners()
}

export function hydrateLastSeenBulk(people = []) {
  let changed = false
  const next = new Map(presenceMap)
  for (const person of people) {
    const id = person?._id || person?.id
    const lastSeenAt = person?.lastSeenAt || person?.last_seen_at
    if (!id || !lastSeenAt) continue
    const ts = toTs(lastSeenAt, NaN)
    if (!Number.isFinite(ts)) continue
    const key = String(id)
    const prev = next.get(key)
    if (prev && isPresenceOnline(prev.status)) continue
    if (prev?.status === PRESENCE_STATUS.OFFLINE && prev.updatedAt >= ts) continue
    next.set(key, { status: PRESENCE_STATUS.OFFLINE, updatedAt: ts })
    changed = true
  }
  if (!changed) return
  presenceMap = next
  notifyMapListeners()
}

export function getPresenceMap() {
  return presenceMap
}

export function getUserPresenceEntry(userId) {
  if (!userId) return null
  return presenceMap.get(String(userId)) || null
}

export function getUserStatus(userId) {
  if (!userId) return PRESENCE_STATUS.OFFLINE
  return presenceMap.get(String(userId))?.status || PRESENCE_STATUS.OFFLINE
}

export function getUserLastSeen(userId) {
  if (!userId) return null
  return presenceMap.get(String(userId))?.updatedAt || null
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

export function usePresenceEntry(userId) {
  const id = userId ? String(userId) : null
  return useSyncExternalStore(
    (onStoreChange) => (id ? subscribeStatus(id, onStoreChange) : () => {}),
    () => (id ? getUserPresenceEntry(id) : null),
    () => null
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

/** Sort helpers for presence rails */
export function presenceSortRank(status) {
  if (!isPresenceOnline(status)) return 100
  return ONLINE_RANK[status] ?? 50
}

/**
 * Priority:
 * 1) Online / active statuses first
 * 2) Among online: richer status, then most recently active (updatedAt)
 * 3) Among offline: most recently seen first (least time since last connection)
 *
 * Never prefer “who joined / logged in earliest”.
 */
export function comparePresencePeople(a, b, getStatus, getLastSeen, getUpdatedAt) {
  const aId = a._id || a.id
  const bId = b._id || b.id
  const aStatus = getStatus(aId)
  const bStatus = getStatus(bId)
  const aOnline = isPresenceOnline(aStatus)
  const bOnline = isPresenceOnline(bStatus)
  if (aOnline !== bOnline) return aOnline ? -1 : 1

  if (aOnline && bOnline) {
    const rank = presenceSortRank(aStatus) - presenceSortRank(bStatus)
    if (rank !== 0) return rank
    const aUp =
      (typeof getUpdatedAt === 'function' ? getUpdatedAt(aId) : null) ||
      getLastSeen(aId) ||
      0
    const bUp =
      (typeof getUpdatedAt === 'function' ? getUpdatedAt(bId) : null) ||
      getLastSeen(bId) ||
      0
    // Más reciente primero (NO quién accedió primero / más temprano)
    return bUp - aUp
  }

  const aSeen = getLastSeen(aId) || toTs(a.lastSeenAt, 0)
  const bSeen = getLastSeen(bId) || toTs(b.lastSeenAt, 0)
  // Offline: menos tiempo desde su última conexión → primero
  return bSeen - aSeen
}
