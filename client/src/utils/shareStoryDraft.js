/**
 * Story compose drafts — IndexedDB (sessionStorage cannot hold multi‑MB PNGs).
 */

import { openDB } from 'idb'

const DB_NAME = 'qyntra-share'
const STORE = 'drafts'
const KEY = 'story'
const LEGACY_KEY = 'qyntra:storyDraft'
const PENDING_KEY = 'qyntra:storyDraftPending'

function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
  })
}

export async function saveStoryDraft(draft) {
  if (!draft?.mediaUrl) throw new Error('Draft sin media')
  const db = await getDb()
  await db.put(STORE, { ...draft, savedAt: Date.now() }, KEY)
  try {
    sessionStorage.setItem(PENDING_KEY, '1')
    sessionStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore quota on flag */
  }
}

export async function takeStoryDraft() {
  let draft = null
  try {
    const db = await getDb()
    draft = (await db.get(STORE, KEY)) || null
    if (draft) await db.delete(STORE, KEY)
  } catch {
    draft = null
  }

  try {
    sessionStorage.removeItem(PENDING_KEY)
    const raw = sessionStorage.getItem(LEGACY_KEY)
    if (raw) {
      sessionStorage.removeItem(LEGACY_KEY)
      if (!draft) {
        try {
          draft = JSON.parse(raw)
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }

  return draft?.mediaUrl ? draft : null
}

export function hasStoryDraftPending() {
  try {
    return sessionStorage.getItem(PENDING_KEY) === '1' || Boolean(sessionStorage.getItem(LEGACY_KEY))
  } catch {
    return false
  }
}
