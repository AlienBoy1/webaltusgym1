/**
 * Separate app prefs for workout bubble vs chat bubbles.
 * System overlay permission is shared; these control whether we ask / use each feature.
 */
import { isNativeApp } from './appMode'

const WORKOUT_KEY = 'qyntra:pref.workoutBubble'
const CHAT_KEY = 'qyntra:pref.chatBubbles'

function readBool(key, fallback = false) {
  try {
    const v = localStorage.getItem(key)
    if (v === null || v === undefined) return fallback
    return v === '1' || v === 'true'
  } catch {
    return fallback
  }
}

function writeBool(key, on) {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function isWorkoutBubblePrefOn() {
  return readBool(WORKOUT_KEY, false)
}

export function setWorkoutBubblePref(on) {
  writeBool(WORKOUT_KEY, Boolean(on))
}

export function isChatBubblesPrefOn() {
  return readBool(CHAT_KEY, false)
}

export function setChatBubblesPref(on) {
  writeBool(CHAT_KEY, Boolean(on))
}

/** Prompt copy — workout */
export const WORKOUT_BUBBLE_DIALOG = {
  title: 'Activar burbuja de entrenamiento',
  message:
    'Para ver el cronómetro «entrenando» encima de otras apps, activa “Aparecer encima de otras apps” para Qyntra. Se abrirá Ajustes de Android.',
  confirmLabel: 'Configurar',
  cancelLabel: 'Ahora no'
}

/** Prompt copy — chat */
export const CHAT_BUBBLE_DIALOG = {
  title: 'Activar burbujas de chat',
  message:
    'Para ver cabezas de chat encima de otras apps cuando te escriban, activa “Aparecer encima de otras apps” para Qyntra. Se abrirá Ajustes de Android.',
  confirmLabel: 'Configurar',
  cancelLabel: 'Ahora no'
}

export async function ensureFeatureOverlay(dialog, kind = 'chat') {
  const { ensureOverlayPermission } = await import('./overlayPermission')
  const copy = kind === 'workout' ? WORKOUT_BUBBLE_DIALOG : CHAT_BUBBLE_DIALOG
  const status = await ensureOverlayPermission(dialog, {
    ...copy,
    settleMs: kind === 'workout' ? 200 : 80
  })
  if (status === 'granted' || status === 'prompted') {
    if (kind === 'workout') setWorkoutBubblePref(true)
    else setChatBubblesPref(true)
  }
  return status
}

export function syncBubblePrefsToNative() {
  if (!isNativeApp()) return
  try {
    window.QyntraNative?.syncBubblePrefs?.(
      JSON.stringify({
        workout: isWorkoutBubblePrefOn(),
        chat: isChatBubblesPrefOn()
      })
    )
  } catch {
    /* ignore */
  }
}
