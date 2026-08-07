/**
 * Tracks which tutorial IDs the user has already been notified about ("spotlight seen").
 * Distinct from completion ("Visto"): user can dismiss with "Ahora no" and still see Nuevo in the hub.
 */

import { userIdOf } from './completion'
import {
  PRE_SPOTLIGHT_TUTORIAL_IDS,
  TUTORIAL_CATALOG,
  hasCompletedTutorial
} from './registry'

const KNOWN_KEY = 'qyntra_known_tutorials'

function storageKey(userId) {
  return userId ? `${KNOWN_KEY}:${userId}` : null
}

function readRaw(userId) {
  const key = storageKey(userId)
  if (!key) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeIds(userId, ids) {
  const key = storageKey(userId)
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify([...new Set(ids)]))
  } catch {
    /* ignore */
  }
}

/** Ensure first-run seeds legacy catalog so only post-spotlight tutorials get promoted. */
export function ensureKnownTutorialsSeeded(user) {
  const uid = userIdOf(user)
  if (!uid) return []
  const raw = readRaw(uid)
  if (raw != null) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  const seeded = [...PRE_SPOTLIGHT_TUTORIAL_IDS]
  writeIds(uid, seeded)
  return seeded
}

export function getKnownTutorialIds(user) {
  return ensureKnownTutorialsSeeded(user)
}

export function markTutorialsKnown(user, ids = []) {
  const uid = userIdOf(user)
  if (!uid || !ids.length) return
  const current = getKnownTutorialIds(user)
  writeIds(uid, [...current, ...ids])
}

/**
 * Catalog entries the user has not been spotlighted about yet
 * (and has not already completed).
 */
export function getUnnotifiedTutorials(user) {
  if (!user) return []
  const known = new Set(getKnownTutorialIds(user))
  return TUTORIAL_CATALOG.filter(
    (item) => !known.has(item.id) && !hasCompletedTutorial(user, item.id)
  )
}
