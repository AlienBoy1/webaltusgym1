import { useEffect, useRef } from 'react'

/**
 * Push a history entry while `active` is true so Android/browser back
 * calls `onBack` instead of leaving the current route.
 *
 * Pattern:
 * - hardware/browser back → popstate → onBack()
 * - UI close → call the returned `requestClose()` (history.back → onBack)
 * - unmount / active→false without pop → silently discard owned entry
 */
export function useHistoryBackLayer(active, onBack, layerId = 'layer') {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack
  const ownedIdRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined

    const id = `qyntra:${layerId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    ownedIdRef.current = id
    const prev = window.history.state && typeof window.history.state === 'object' ? window.history.state : {}
    window.history.pushState({ ...prev, qyntraBack: id }, '')

    const onPop = () => {
      if (ownedIdRef.current !== id) return
      ownedIdRef.current = null
      onBackRef.current?.()
    }

    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // Closed without popping (e.g. parent setState) — remove our orphan entry
      if (ownedIdRef.current === id && window.history.state?.qyntraBack === id) {
        ownedIdRef.current = null
        window.history.back()
      } else if (ownedIdRef.current === id) {
        ownedIdRef.current = null
      }
    }
  }, [active, layerId])

  const requestClose = () => {
    const id = ownedIdRef.current
    if (id && window.history.state?.qyntraBack === id) {
      window.history.back()
      return
    }
    onBackRef.current?.()
  }

  return requestClose
}
