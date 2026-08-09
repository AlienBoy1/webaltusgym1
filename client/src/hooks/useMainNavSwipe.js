import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { prefetchRoute } from '../utils/routePrefetch'

/** Primary bottom-nav tabs (swipe left = next, swipe right = previous). */
export const MAIN_NAV_PATHS = [
  '/dashboard',
  '/social',
  '/workouts',
  '/progress',
  '/profile'
]

const MIN_DX = 72
const MAX_ANGLE_RATIO = 0.75 // |dy| / |dx| must be below this
const IGNORE_SELECTOR =
  'input, textarea, select, audio, video, [contenteditable="true"], [data-no-swipe]'

function isHorizontallyScrollable(el) {
  let node = el
  while (node && node !== document.body) {
    if (node.nodeType === 1) {
      if (node.matches?.('[data-no-swipe]')) return true
      const style = window.getComputedStyle(node)
      const ox = style.overflowX
      if (
        (ox === 'auto' || ox === 'scroll' || ox === 'overlay') &&
        node.scrollWidth > node.clientWidth + 6
      ) {
        return true
      }
    }
    node = node.parentElement
  }
  return false
}

function shouldIgnoreTarget(target) {
  if (!target?.closest) return true
  if (target.closest(IGNORE_SELECTOR)) return true
  if (isHorizontallyScrollable(target)) return true
  // Don't steal gestures while overlays / tutorials own the screen
  if (document.body.dataset.qyntraTutorial === '1') return true
  if (document.querySelector('[aria-modal="true"]')) return true
  return false
}

/**
 * Facebook-like horizontal swipe between main bottom-nav screens.
 * Attach via ref on the main content element.
 */
export function useMainNavSwipe(enabled = true) {
  const navigate = useNavigate()
  const location = useLocation()
  const startRef = useRef(null)
  const armedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return undefined

    const onTouchStart = (e) => {
      if (!e.touches?.[0]) return
      if (!MAIN_NAV_PATHS.includes(location.pathname)) {
        startRef.current = null
        return
      }
      if (shouldIgnoreTarget(e.target)) {
        startRef.current = null
        return
      }
      const t = e.touches[0]
      startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }
      armedRef.current = false
    }

    const onTouchMove = (e) => {
      const start = startRef.current
      if (!start || !e.touches?.[0]) return
      const t = e.touches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (!armedRef.current) {
        if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return
        // Vertical scroll wins → abort
        if (Math.abs(dy) >= Math.abs(dx) * 0.9) {
          startRef.current = null
          return
        }
        armedRef.current = true
        const idx = MAIN_NAV_PATHS.indexOf(location.pathname)
        const next =
          dx < 0
            ? MAIN_NAV_PATHS[idx + 1]
            : MAIN_NAV_PATHS[idx - 1]
        if (next) prefetchRoute(next)
      }
    }

    const onTouchEnd = (e) => {
      const start = startRef.current
      startRef.current = null
      if (!start || !armedRef.current) return
      const touch = e.changedTouches?.[0]
      if (!touch) return

      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      if (absX < MIN_DX) return
      if (absY / absX > MAX_ANGLE_RATIO) return
      if (Date.now() - start.t > 900) return

      const idx = MAIN_NAV_PATHS.indexOf(location.pathname)
      if (idx < 0) return

      // Finger moves left → next tab; right → previous (Facebook-like)
      const nextIdx = dx < 0 ? idx + 1 : idx - 1
      if (nextIdx < 0 || nextIdx >= MAIN_NAV_PATHS.length) return
      navigate(MAIN_NAV_PATHS[nextIdx])
    }

    const onTouchCancel = () => {
      startRef.current = null
      armedRef.current = false
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [enabled, location.pathname, navigate])
}
