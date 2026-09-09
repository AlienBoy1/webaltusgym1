import { useCallback, useRef, useState } from 'react'

const THRESHOLD = 72

/**
 * Facebook-style pull-to-refresh for scrollable pages.
 * Wrap page content; pass async onRefresh.
 */
export default function PullToRefresh({ onRefresh, children, className = '', disabled = false }) {
  const startY = useRef(0)
  const pulling = useRef(false)
  const [offset, setOffset] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const atTop = () => {
    const scroller = document.scrollingElement || document.documentElement
    return (scroller?.scrollTop || window.scrollY || 0) <= 2
  }

  const finish = useCallback(async () => {
    if (!onRefresh || refreshing) {
      setOffset(0)
      return
    }
    setRefreshing(true)
    setOffset(THRESHOLD * 0.55)
    try {
      await onRefresh()
    } catch {
      /* caller handles errors */
    } finally {
      setRefreshing(false)
      setOffset(0)
    }
  }, [onRefresh, refreshing])

  const onTouchStart = (e) => {
    if (disabled || refreshing) return
    if (!atTop()) return
    pulling.current = true
    startY.current = e.touches[0].clientY
  }

  const onTouchMove = (e) => {
    if (!pulling.current || disabled || refreshing) return
    if (!atTop()) {
      pulling.current = false
      setOffset(0)
      return
    }
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0) {
      setOffset(0)
      return
    }
    const damped = Math.min(dy * 0.45, THRESHOLD * 1.35)
    setOffset(damped)
    if (damped > 8) e.preventDefault()
  }

  const onTouchEnd = () => {
    if (!pulling.current) return
    pulling.current = false
    if (offset >= THRESHOLD) {
      finish()
    } else {
      setOffset(0)
    }
  }

  return (
    <div
      className={`relative ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden text-xs font-medium text-app-secondary transition-[height] duration-150"
        style={{ height: refreshing || offset > 0 ? Math.max(offset, refreshing ? 40 : 0) : 0 }}
        aria-hidden
      >
        {(refreshing || offset > 24) && (
          <span className="inline-flex items-center gap-2">
            <span
              className={`h-4 w-4 rounded-full border-2 border-primary-500/30 border-t-primary-500 ${
                refreshing || offset >= THRESHOLD ? 'animate-spin' : ''
              }`}
            />
          </span>
        )}
      </div>
      <div style={{ transform: offset && !refreshing ? `translateY(${offset * 0.15}px)` : undefined }}>
        {children}
      </div>
    </div>
  )
}
