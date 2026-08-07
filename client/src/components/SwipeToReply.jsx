import { useRef, useState } from 'react'
import { FiCornerUpLeft } from 'react-icons/fi'

const THRESHOLD = 56
const MAX_DRAG = 96
const MOVE_TOLERANCE = 12
const SWIPE_CANCEL_LONG = 18

/**
 * Swipe-to-reply + long-press (reaction / actions sheet).
 * Allows small finger jitter so long-press still fires on mobile.
 */
export default function SwipeToReply({ children, enabled = true, onReply, onLongPress }) {
  const startX = useRef(0)
  const startY = useRef(0)
  const dragging = useRef(false)
  const locked = useRef(null)
  const longTimer = useRef(0)
  const longFired = useRef(false)
  const offsetRef = useRef(0)
  const [offset, setOffset] = useState(0)
  const [replyReady, setReplyReady] = useState(false)

  const clearLong = () => {
    if (longTimer.current) {
      window.clearTimeout(longTimer.current)
      longTimer.current = 0
    }
  }

  const shouldIgnoreTarget = (target) => {
    if (!target?.closest) return false
    // Allow gestures on the bubble; only skip real controls / media chrome
    return Boolean(
      target.closest(
        'a, input, textarea, select, audio, video, [data-no-swipe], [contenteditable="true"]'
      )
    )
  }

  const onPointerDown = (e) => {
    if (!enabled || e.button === 2) return
    if (shouldIgnoreTarget(e.target)) return

    startX.current = e.clientX
    startY.current = e.clientY
    dragging.current = true
    locked.current = null
    longFired.current = false
    offsetRef.current = 0
    setOffset(0)
    setReplyReady(false)

    clearLong()
    longTimer.current = window.setTimeout(() => {
      if (!dragging.current || Math.abs(offsetRef.current) > MOVE_TOLERANCE) return
      longFired.current = true
      clearLong()
      try {
        navigator.vibrate?.(12)
      } catch {
        /* ignore */
      }
      onLongPress?.()
    }, 420)

    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onPointerMove = (e) => {
    if (!dragging.current || !enabled || longFired.current) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    if (!locked.current) {
      if (adx < MOVE_TOLERANCE && ady < MOVE_TOLERANCE) return
      locked.current = adx > ady ? 'h' : 'v'
      if (locked.current === 'v') {
        clearLong()
        return
      }
      if (adx >= SWIPE_CANCEL_LONG) clearLong()
    }

    if (locked.current !== 'h') return
    if (adx >= SWIPE_CANCEL_LONG) clearLong()

    // Prefer swipe-right (WhatsApp-like); still allow left
    const raw = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx))
    offsetRef.current = raw
    setOffset(raw)
    setReplyReady(Math.abs(raw) >= THRESHOLD)

    // Avoid the list stealing the gesture once we know it's horizontal
    if (e.cancelable) e.preventDefault()
  }

  const finish = (e) => {
    if (!dragging.current) return
    dragging.current = false
    clearLong()
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }

    const shouldReply = !longFired.current && Math.abs(offsetRef.current) >= THRESHOLD
    offsetRef.current = 0
    setOffset(0)
    setReplyReady(false)
    locked.current = null
    if (shouldReply) onReply?.()
  }

  return (
    <div
      className="relative select-none"
      style={{
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        // Vertical scroll OK; horizontal handled here for reply swipe
        touchAction: 'pan-y'
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onContextMenu={(e) => {
        // Desktop / long-press: open message actions instead of browser menu
        e.preventDefault()
        if (!enabled) return
        longFired.current = true
        clearLong()
        dragging.current = false
        offsetRef.current = 0
        setOffset(0)
        setReplyReady(false)
        onLongPress?.()
      }}
    >
      <div
        className={`pointer-events-none absolute inset-y-0 z-0 flex items-center ${
          offset >= 0 ? 'left-1' : 'right-1'
        }`}
        style={{ opacity: Math.min(1, Math.abs(offset) / THRESHOLD) }}
        aria-hidden
      >
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition-transform ${
            replyReady ? 'scale-110 bg-[color:var(--color-primary)]' : 'scale-95 bg-[color:var(--text-muted)]'
          }`}
        >
          <FiCornerUpLeft size={16} />
        </span>
      </div>
      <div
        className="relative z-[1]"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging.current ? 'none' : 'transform 180ms cubic-bezier(.2,.8,.2,1)'
        }}
      >
        {children}
      </div>
    </div>
  )
}
