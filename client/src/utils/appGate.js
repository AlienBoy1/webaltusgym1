/**
 * Sequential login/onboarding prompts — only one visible at a time.
 *
 * Priority (highest → lowest):
 * 1. update        — UpdateCenter
 * 2. username      — UsernameSetupModal
 * 3. welcome       — WelcomeIntroModal
 * 4. tutorial      — AppTutorial spotlight OR NewTutorialPrompt
 * 5. membership    — MembershipExpiryNotice
 * 6. notifications — NotificationPrompt
 */

const listeners = new Set()

const PRIORITY = Object.freeze([
  'update',
  'username',
  'welcome',
  'tutorial',
  'membership',
  'notifications'
])

let updateBlocking = false
let updateSettled = false
let usernameBlocking = false
let welcomeBlocking = false
let tutorialBlocking = false
let membershipBlocking = false
let notificationsBlocking = false

function claimsOf(layer) {
  switch (layer) {
    case 'update':
      return updateBlocking
    case 'username':
      return usernameBlocking
    case 'welcome':
      return welcomeBlocking
    case 'tutorial':
      return tutorialBlocking
    case 'membership':
      return membershipBlocking
    case 'notifications':
      return notificationsBlocking
    default:
      return false
  }
}

function emit() {
  const snap = getGateSnapshot()
  listeners.forEach((fn) => {
    try {
      fn(snap)
    } catch {
      /* ignore */
    }
  })
  try {
    window.dispatchEvent(new CustomEvent('qyntra:app-gate', { detail: snap }))
  } catch {
    /* ignore */
  }
}

export function getGateSnapshot() {
  return {
    updateBlocking,
    updateSettled,
    usernameBlocking,
    welcomeBlocking,
    tutorialBlocking,
    membershipBlocking,
    notificationsBlocking,
    canStartTutorials: canShowPrompt('tutorial')
  }
}

/**
 * Returns true when no higher-priority prompt is active and (for layers
 * below update) the version check has settled.
 */
export function canShowPrompt(layer) {
  const idx = PRIORITY.indexOf(layer)
  if (idx < 0) return false

  if (layer !== 'update') {
    if (!updateSettled) return false
    if (updateBlocking) return false
  }

  for (let i = 0; i < idx; i += 1) {
    if (claimsOf(PRIORITY[i])) return false
  }
  return true
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

export function setWelcomeBlocking(value) {
  const next = Boolean(value)
  if (welcomeBlocking === next) return
  welcomeBlocking = next
  emit()
}

export function setTutorialBlocking(value) {
  const next = Boolean(value)
  if (tutorialBlocking === next) return
  tutorialBlocking = next
  emit()
}

export function setMembershipBlocking(value) {
  const next = Boolean(value)
  if (membershipBlocking === next) return
  membershipBlocking = next
  emit()
}

export function setNotificationsBlocking(value) {
  const next = Boolean(value)
  if (notificationsBlocking === next) return
  notificationsBlocking = next
  emit()
}

export function canStartTutorials() {
  return canShowPrompt('tutorial')
}

export function subscribeAppGate(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export { PRIORITY as APP_GATE_PRIORITY }
