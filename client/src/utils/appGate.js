/**
 * Sequential login/onboarding prompts — only one visible at a time.
 *
 * Priority (highest → lowest):
 * 1. update         — UpdateCenter (always first; others wait until settled)
 * 2. username       — UsernameSetupModal
 * 3. welcome        — WelcomeIntroModal
 * 4. qysi           — QySiIntroPresentation
 * 5. tutorial       — AppTutorial spotlight
 * 6. tutorialNotice — NewTutorialPrompt
 * 7. membership     — MembershipExpiryNotice
 * 8. notifications  — NotificationPrompt
 * 9. install        — InstallAppPrompt
 *
 * Components declare *intent* (they want to show). The gate picks at most
 * one active layer. canShowPrompt(layer) is true only for that active layer.
 */

const listeners = new Set()

const PRIORITY = Object.freeze([
  'update',
  'username',
  'welcome',
  'qysi',
  'tutorial',
  'tutorialNotice',
  'membership',
  'notifications',
  'install'
])

/** Brief pause after a prompt closes so the next one does not stack visually. */
const LAYER_COOLDOWN_MS = 480
let layerCooldownUntil = 0
let cooldownTimer = null

let updateSettled = false
let activeLayer = null

const intent = Object.fromEntries(PRIORITY.map((k) => [k, false]))

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

function pickActiveLayer() {
  if (intent.update) return 'update'
  if (!updateSettled) return null
  if (Date.now() < layerCooldownUntil) return null
  for (let i = 0; i < PRIORITY.length; i += 1) {
    const layer = PRIORITY[i]
    if (layer === 'update') continue
    if (intent[layer]) return layer
  }
  return null
}

function reconcile() {
  const next = pickActiveLayer()
  if (activeLayer === next) return false
  activeLayer = next
  return true
}

function scheduleCooldownReconcile() {
  if (cooldownTimer) {
    window.clearTimeout(cooldownTimer)
    cooldownTimer = null
  }
  const wait = Math.max(0, layerCooldownUntil - Date.now())
  cooldownTimer = window.setTimeout(() => {
    cooldownTimer = null
    if (Date.now() < layerCooldownUntil) return
    if (reconcile()) emit()
    else emit()
  }, wait + 16)
}

/**
 * Declare whether a layer wants to show. The gate promotes the highest
 * intent that is currently eligible.
 */
export function setPromptIntent(layer, wants) {
  if (!Object.prototype.hasOwnProperty.call(intent, layer)) return
  const next = Boolean(wants)
  if (intent[layer] === next) return

  const releasingActive = intent[layer] && !next && activeLayer === layer
  intent[layer] = next

  // Claiming a layer cancels the inter-prompt pause so chained tutorials
  // (e.g. quick_start → main_nav) can start without losing the race.
  if (next && Date.now() < layerCooldownUntil) {
    layerCooldownUntil = 0
    if (cooldownTimer) {
      window.clearTimeout(cooldownTimer)
      cooldownTimer = null
    }
  }

  if (releasingActive) {
    layerCooldownUntil = Date.now() + LAYER_COOLDOWN_MS
    activeLayer = null
    scheduleCooldownReconcile()
    emit()
    return
  }

  reconcile()
  emit()
}

export function getGateSnapshot() {
  return {
    updateBlocking: Boolean(intent.update),
    updateSettled,
    usernameBlocking: Boolean(intent.username),
    welcomeBlocking: Boolean(intent.welcome),
    tutorialBlocking: Boolean(intent.tutorial || intent.tutorialNotice),
    qysiBlocking: Boolean(intent.qysi),
    membershipBlocking: Boolean(intent.membership),
    notificationsBlocking: Boolean(intent.notifications),
    installBlocking: Boolean(intent.install),
    activeLayer,
    layerCooldownUntil,
    canStartTutorials: canShowPrompt('tutorial')
  }
}

/**
 * True only when this layer is the single active prompt.
 * Use before rendering / opening UI.
 */
export function canShowPrompt(layer) {
  if (!Object.prototype.hasOwnProperty.call(intent, layer)) return false
  if (layer !== 'update') {
    if (!updateSettled) return false
    if (intent.update) return false
    if (Date.now() < layerCooldownUntil) return false
  }
  return activeLayer === layer
}

/** True while any prompt (or inter-layer cooldown) owns the screen. */
export function isAnyPromptActive() {
  if (activeLayer) return true
  if (Date.now() < layerCooldownUntil) return true
  if (!updateSettled) return true
  return false
}

export function getActivePrompt() {
  return activeLayer
}

export function setUpdateBlocking(value) {
  setPromptIntent('update', value)
}

/** Call when version check finished (update shown or confirmed up-to-date). */
export function setUpdateSettled(value) {
  const next = Boolean(value)
  if (updateSettled === next) return
  updateSettled = next
  reconcile()
  emit()
}

export function setUsernameBlocking(value) {
  setPromptIntent('username', value)
}

export function setWelcomeBlocking(value) {
  setPromptIntent('welcome', value)
}

export function setQysiBlocking(value) {
  setPromptIntent('qysi', value)
}

export function setTutorialBlocking(value) {
  setPromptIntent('tutorial', value)
}

export function setTutorialNoticeBlocking(value) {
  setPromptIntent('tutorialNotice', value)
}

export function setMembershipBlocking(value) {
  setPromptIntent('membership', value)
}

export function setNotificationsBlocking(value) {
  setPromptIntent('notifications', value)
}

export function setInstallBlocking(value) {
  setPromptIntent('install', value)
}

export function canStartTutorials() {
  return canShowPrompt('tutorial')
}

export function subscribeAppGate(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export { PRIORITY as APP_GATE_PRIORITY }
