import { isNativeApp } from './appMode'

/**
 * Shared “Aparecer encima” permission flow for workout + chat bubbles.
 * Always shows the in-app dialog when the OS permission is missing.
 */

export async function checkOverlayPermission() {
  try {
    if (typeof window !== 'undefined' && window.QyntraNative?.checkStatus) {
      const statusRaw = window.QyntraNative.checkStatus()
      const status = typeof statusRaw === 'string' ? JSON.parse(statusRaw) : statusRaw
      if (status?.overlay === 'granted') return 'granted'
      if (status?.overlay === 'denied') return 'denied'
    }
  } catch {
    /* fall through */
  }
  try {
    const { registerPlugin } = await import('@capacitor/core')
    const WorkoutHud = registerPlugin('WorkoutHud')
    const perms = await WorkoutHud.checkPermissions()
    return perms?.overlay === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

export async function openOverlaySettings() {
  try {
    if (typeof window !== 'undefined' && window.QyntraNative?.openOverlaySettings) {
      window.QyntraNative.openOverlaySettings()
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const { registerPlugin } = await import('@capacitor/core')
    const WorkoutHud = registerPlugin('WorkoutHud')
    await WorkoutHud.requestOverlayPermission()
    return true
  } catch {
    return false
  }
}

const PENDING_KEY = 'qyntra:pending-overlay-permission'

export function markPendingOverlayPermission() {
  try {
    window.localStorage.setItem(PENDING_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearPendingOverlayPermission() {
  try {
    window.localStorage.removeItem(PENDING_KEY)
    window.sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}

export function hasPendingOverlayPermission() {
  try {
    return (
      window.localStorage.getItem(PENDING_KEY) === '1' ||
      window.sessionStorage.getItem(PENDING_KEY) === '1'
    )
  } catch {
    return false
  }
}

async function waitUntilForeground(maxMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      // Settle after system sheets
      await new Promise((r) => window.setTimeout(r, 450))
      return true
    }
    await new Promise((r) => window.setTimeout(r, 200))
  }
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

/**
 * @returns {'granted'|'prompted'|'denied'|'skipped'}
 */
export async function ensureOverlayPermission(dialog, options = {}) {
  if (!isNativeApp()) return 'skipped'

  const {
    title = 'Activar burbuja',
    message =
      'Se abrirá Ajustes de Android. Activa “Aparecer encima de otras apps” para Qyntra y regresa a la app.',
    confirmLabel = 'Configurar',
    cancelLabel = 'Cancelar',
    settleMs = 600
  } = options

  await waitUntilForeground()
  if (settleMs > 0) await new Promise((r) => window.setTimeout(r, settleMs))

  let status = 'denied'
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      status = await checkOverlayPermission()
    } catch {
      status = 'denied'
    }
    if (status === 'granted') break
    await new Promise((r) => window.setTimeout(r, 250))
  }

  if (status === 'granted') {
    clearPendingOverlayPermission()
    try {
      window.QyntraNative?.hideOverlay?.()
      window.QyntraNative?.hideChatBubble?.('')
    } catch {
      /* ignore */
    }
    return 'granted'
  }

  if (!dialog?.confirm) {
    markPendingOverlayPermission()
    return 'denied'
  }

  // Ensure any previous dialog finished unmounting
  await new Promise((r) => window.setTimeout(r, 120))

  const accepted = await dialog.confirm(message, {
    title,
    confirmLabel,
    cancelLabel,
    tone: 'info',
    dismissible: false
  })

  if (!accepted) {
    markPendingOverlayPermission()
    return 'denied'
  }

  markPendingOverlayPermission()
  // Let dialog exit animation finish so we never freeze on a black scrim
  await new Promise((r) => window.setTimeout(r, 320))
  await openOverlaySettings()
  return 'prompted'
}
