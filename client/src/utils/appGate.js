/**
 * Global onboarding gates so update/username never collide with tutorials.
 */

const listeners = new Set()

let updateBlocking = false
let updateSettled = false
let usernameBlocking = false

function emit() {
  listeners.forEach((fn) => {
    try {
      fn(getGateSnapshot())
    } catch {
      /* ignore */
    }
  })
  try {
    window.dispatchEvent(
      new CustomEvent('qyntra:app-gate', { detail: getGateSnapshot() })
    )
  } catch {
    /* ignore */
  }
}

export function getGateSnapshot() {
  return {
    updateBlocking,
    updateSettled,
    usernameBlocking,
    canStartTutorials: !updateBlocking && !usernameBlocking && updateSettled
  }
}

export function setUpdateBlocking(value) {
  const next = Boolean(value)
  if (updateBlocking === next) return
  updateBlocking = next
  emit()
}

/** Call when version check finished (update shown or confirmed up-to-date). */
export function setUpdateSettled(value) {
  const next = Boolean(value)
  if (updateSettled === next) return
  updateSettled = next
  emit()
}

export function setUsernameBlocking(value) {
  const next = Boolean(value)
  if (usernameBlocking === next) return
  usernameBlocking = next
  emit()
}

export function canStartTutorials() {
  return getGateSnapshot().canStartTutorials
}

export function subscribeAppGate(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
