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
 * 7. install       — InstallAppPrompt
 */

const listeners = new Set()

const PRIORITY = Object.freeze([
  'update',
  'username',
  'welcome',
  'tutorial',
  'membership',
  'notifications',
  'install'
])

/** Brief pause after a prompt closes so the next one does not stack visually. */
const LAYER_COOLDOWN_MS = 420
let layerCooldownUntil = 0

let updateBlocking = false
let updateSettled = false
let usernameBlocking = false
let welcomeBlocking = false
let tutorialBlocking = false
let membershipBlocking = false
let notificationsBlocking = false
let installBlocking = false

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
    case 'install':
      return installBlocking
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

function scheduleCooldownEmit() {
  const wait = Math.max(0, layerCooldownUntil - Date.now())
  if (wait <= 0) {
    emit()
    return
  }
  window.setTimeout(() => {
    if (Date.now() >= layerCooldownUntil) emit()
  }, wait + 16)
}

function setLayerFlag(current, nextValue, assign) {
  const next = Boolean(nextValue)
  if (current === next) return false
  // When a prompt releases, cool down before the next layer may open
  if (current && !next) {
    layerCooldownUntil = Date.now() + LAYER_COOLDOWN_MS
    assign(next)
    scheduleCooldownEmit()
    return true
  }
  assign(next)
  emit()
  return true
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
    installBlocking,
    layerCooldownUntil,
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
    if (Date.now() < layerCooldownUntil) return false
  }

  for (let i = 0; i < idx; i += 1) {
    if (claimsOf(PRIORITY[i])) return false
  }
  return true
}

export function setUpdateBlocking(value) {
  setLayerFlag(updateBlocking, value, (v) => {
    updateBlocking = v
  })
}

/** Call when version check finished (update shown or confirmed up-to-date). */
export function setUpdateSettled(value) {
  const next = Boolean(value)
  if (updateSettled === next) return
  updateSettled = next
  emit()
}

export function setUsernameBlocking(value) {
  setLayerFlag(usernameBlocking, value, (v) => {
    usernameBlocking = v
  })
}

export function setWelcomeBlocking(value) {
  setLayerFlag(welcomeBlocking, value, (v) => {
    welcomeBlocking = v
  })
}

export function setTutorialBlocking(value) {
  setLayerFlag(tutorialBlocking, value, (v) => {
    tutorialBlocking = v
  })
}

export function setMembershipBlocking(value) {
  setLayerFlag(membershipBlocking, value, (v) => {
    membershipBlocking = v
  })
}

export function setNotificationsBlocking(value) {
  setLayerFlag(notificationsBlocking, value, (v) => {
    notificationsBlocking = v
  })
}

export function setInstallBlocking(value) {
  setLayerFlag(installBlocking, value, (v) => {
    installBlocking = v
  })
}

export function canStartTutorials() {
  return canShowPrompt('tutorial')
}

export function subscribeAppGate(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export { PRIORITY as APP_GATE_PRIORITY }
