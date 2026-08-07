/** Ensures only one VoiceNotePlayer plays at a time across the app. */

let active = null

/**
 * @param {{ pause: () => void, id: string }} controller
 */
export function claimVoicePlayback(controller) {
  if (active && active !== controller) {
    try {
      active.pause()
    } catch {
      /* ignore */
    }
  }
  active = controller
}

export function releaseVoicePlayback(controller) {
  if (active === controller) active = null
}
