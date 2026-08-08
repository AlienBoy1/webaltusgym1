import { useEffect, useRef } from 'react'

/**
 * Push a history entry while `active` is true so Android/browser back
 * calls `onBack` instead of leaving the current route.
 *
 * Nested layers (e.g. story viewer + share sheet) are supported:
 * popping back *onto* this layer must not close it — only leaving this
 * layer's history entry should call `onBack`.
 *
 * Pattern:
 * - hardware/browser back → popstate → onBack() when this entry is left
 * - UI close → call the returned `requestClose()` (history.back → onBack)
 * - unmount / active→false without pop → silently discard owned entry
 */
export function useHistoryBackLayer(active, onBack, layerId = 'layer') {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack
  const ownedIdRef = useRef(null)
  const closingViaBackRef = useRef(false)

  useEffect(() => {
    if (!active) return undefined

    const id = `qyntra:${layerId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    ownedIdRef.current = id
    closingViaBackRef.current = false

    // Defer push until after React Router finishes any pending navigations
    // so our entry sits on top of the current route reliably.
    let cancelled = false
    let pushed = false
    const pushTimer = window.setTimeout(() => {
      if (cancelled || ownedIdRef.current !== id) return
      const prev =
        window.history.state && typeof window.history.state === 'object'
          ? window.history.state
          : {}
      window.history.pushState({ ...prev, qyntraBack: id }, '')
      pushed = true
    }, 0)

    const onPop = () => {
      if (ownedIdRef.current !== id) return
      // Navigated back onto this layer (child overlay closed) — keep open
      if (window.history.state?.qyntraBack === id) return
      // This layer's entry was left — close
      ownedIdRef.current = null
      closingViaBackRef.current = true
      try {
        onBackRef.current?.()
      } finally {
        closingViaBackRef.current = false
      }
    }

    window.addEventListener('popstate', onPop)
    return () => {
      cancelled = true
      window.clearTimeout(pushTimer)
      window.removeEventListener('popstate', onPop)

      // Closed without popping (UI setState / unmount) — remove orphan entry
      if (ownedIdRef.current === id) {
        ownedIdRef.current = null
        if (pushed && window.history.state?.qyntraBack === id && !closingViaBackRef.current) {
          window.history.back()
        }
      }
    }
  }, [active, layerId])

  const requestClose = () => {
    const id = ownedIdRef.current
    if (id && window.history.state?.qyntraBack === id) {
      window.history.back()
      return
    }
    // Entry not pushed yet or already popped — close directly
    onBackRef.current?.()
  }

  return requestClose
}
