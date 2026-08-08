/**
 * Tracks which tutorial IDs the user has already been notified about ("spotlight seen"),
 * plus per-tutorial contentVersion acknowledgements for "actualización de tutorial".
 *
 * Distinct from completion ("Visto"): user can dismiss with "Ahora no" and still see Nuevo/Actualizado in the hub.
 */

import { userIdOf } from './completion'
import {
  PRE_SPOTLIGHT_TUTORIAL_IDS,
  TUTORIAL_CATALOG,
  getTutorialMeta,
  hasCompletedTutorial
} from './registry'

const KNOWN_KEY = 'qyntra_known_tutorials'
const VERSIONS_KEY = 'qyntra_tutorial_versions'

function storageKey(base, userId) {
  return userId ? `${base}:${userId}` : null
}

function readJson(key, fallback) {
  if (!key) return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

function catalogVersion(itemOrId) {
  const meta = typeof itemOrId === 'string' ? getTutorialMeta(itemOrId) : itemOrId
  return Number(meta?.contentVersion) > 0 ? Number(meta.contentVersion) : 1
}

/** Ensure first-run seeds legacy catalog so only post-spotlight tutorials get promoted. */
export function ensureKnownTutorialsSeeded(user) {
  const uid = userIdOf(user)
  if (!uid) return []
  const key = storageKey(KNOWN_KEY, uid)
  const raw = key ? localStorage.getItem(key) : null
  if (raw != null) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  const seeded = [...PRE_SPOTLIGHT_TUTORIAL_IDS]
  writeJson(key, seeded)
  // Seed versions at current catalog so legacy users aren't flooded as "updates" on first deploy of this system —
  // EXCEPT we intentionally leave room for bumps: migration below handles first versions file.
  ensureVersionStateSeeded(user, { freshKnown: seeded, isFirstKnownSeed: true })
  return seeded
}

/**
 * Version state shape: { [tutorialId]: { ack: number, done: number } }
 * - ack: last contentVersion for which the update/new prompt was acknowledged
 * - done: last contentVersion completed (hub "Visto")
 */
export function ensureVersionStateSeeded(user, { freshKnown = null, isFirstKnownSeed = false } = {}) {
  const uid = userIdOf(user)
  if (!uid) return {}
  const key = storageKey(VERSIONS_KEY, uid)
  const existing = readJson(key, null)
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return existing
  }

  const known = freshKnown || getKnownTutorialIdsUnsafe(uid)
  const state = {}

  for (const item of TUTORIAL_CATALOG) {
    const ver = catalogVersion(item)
    const isKnown = known.includes(item.id)
    const completed = hasCompletedTutorial(user, item.id)

    if (isFirstKnownSeed && isKnown) {
      // Brand-new local profile seeding PRE_SPOTLIGHT: treat current catalog as already ack'd
      // so only future contentVersion bumps trigger "actualización".
      state[item.id] = { ack: ver, done: completed ? ver : 0 }
    } else if (isKnown || completed) {
      // Existing users upgrading to versioning: assume they knew v1 content.
      // A bump to contentVersion >= 2 will show as actualización.
      state[item.id] = {
        ack: 1,
        done: completed ? 1 : 0
      }
    }
  }

  writeJson(key, state)
  return state
}

function getKnownTutorialIdsUnsafe(uid) {
  const key = storageKey(KNOWN_KEY, uid)
  const parsed = readJson(key, [])
  return Array.isArray(parsed) ? parsed : []
}

export function getKnownTutorialIds(user) {
  return ensureKnownTutorialsSeeded(user)
}

function getVersionState(user) {
  ensureKnownTutorialsSeeded(user)
  return ensureVersionStateSeeded(user)
}

export function getTutorialAckVersion(user, tutorialId) {
  const state = getVersionState(user)
  return Number(state[tutorialId]?.ack) || 0
}

export function getTutorialDoneVersion(user, tutorialId) {
  const state = getVersionState(user)
  return Number(state[tutorialId]?.done) || 0
}

export function markTutorialsKnown(user, ids = []) {
  const uid = userIdOf(user)
  if (!uid || !ids.length) return
  const current = getKnownTutorialIds(user)
  writeJson(storageKey(KNOWN_KEY, uid), [...current, ...ids])
}

/** Acknowledge prompt for given tutorials at their current catalog contentVersion. */
export function acknowledgeTutorialVersions(user, ids = []) {
  const uid = userIdOf(user)
  if (!uid || !ids.length) return
  const state = { ...getVersionState(user) }
  for (const id of ids) {
    const ver = catalogVersion(id)
    const prev = state[id] || { ack: 0, done: 0 }
    state[id] = { ...prev, ack: Math.max(Number(prev.ack) || 0, ver) }
  }
  writeJson(storageKey(VERSIONS_KEY, uid), state)
  markTutorialsKnown(user, ids)
}

/** After finishing a tutorial, lock both ack + done to the current contentVersion. */
export function markTutorialCompletedVersion(user, tutorialId) {
  const uid = userIdOf(user)
  if (!uid || !tutorialId) return
  const ver = catalogVersion(tutorialId)
  const state = { ...getVersionState(user) }
  const prev = state[tutorialId] || { ack: 0, done: 0 }
  state[tutorialId] = {
    ack: Math.max(Number(prev.ack) || 0, ver),
    done: Math.max(Number(prev.done) || 0, ver)
  }
  writeJson(storageKey(VERSIONS_KEY, uid), state)
  markTutorialsKnown(user, [tutorialId])
}

/**
 * Brand-new catalog entries the user hasn't been spotlighted about
 * (and hasn't completed).
 */
export function getUnnotifiedTutorials(user) {
  return getPendingTutorialNotices(user)
    .filter((n) => n.kind === 'new')
    .map(({ kind: _k, ...item }) => item)
}

/**
 * Tutorials with a newer contentVersion than the user last acknowledged.
 * Includes users who already completed the previous version.
 */
export function getUpdatedTutorials(user) {
  return getPendingTutorialNotices(user)
    .filter((n) => n.kind === 'update')
    .map(({ kind: _k, ...item }) => item)
}

/**
 * Unified pending notices for NewTutorialPrompt.
 * @returns {Array<catalogItem & { kind: 'new' | 'update' }>}
 */
export function getPendingTutorialNotices(user) {
  if (!user) return []
  const known = new Set(getKnownTutorialIds(user))
  const state = getVersionState(user)
  const notices = []

  for (const item of TUTORIAL_CATALOG) {
    const ver = catalogVersion(item)
    const ack = Number(state[item.id]?.ack) || 0
    const completed = hasCompletedTutorial(user, item.id)
    const isKnown = known.has(item.id)

    if (ack < ver && (isKnown || completed)) {
      notices.push({ ...item, kind: 'update' })
      continue
    }

    if (!isKnown && !completed) {
      notices.push({ ...item, kind: 'new' })
    }
  }

  return notices
}

/** Hub badge helper: 'seen' | 'new' | 'updated' */
export function getTutorialBadge(user, tutorialId) {
  const ver = catalogVersion(tutorialId)
  const doneVer = getTutorialDoneVersion(user, tutorialId)
  const completed = hasCompletedTutorial(user, tutorialId)

  if (completed && doneVer >= ver) return 'seen'
  if (doneVer > 0 && doneVer < ver) return 'updated'
  if (completed && doneVer < ver) return 'updated'
  if (!completed) return 'new'
  return 'seen'
}