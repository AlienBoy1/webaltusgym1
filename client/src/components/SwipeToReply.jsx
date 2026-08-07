import { useRef, useState } from 'react'
import { FiCornerUpLeft } from 'react-icons/fi'

const THRESHOLD = 64
const MAX_DRAG = 96

/**
 * WhatsApp-like swipe-to-reply + long-press hook.
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

  const onPointerDown = (e) => {
    if (!enabled || e.button === 2) return
    if (e.target?.closest?.('button, a, input, textarea, audio, video, [data-no-swipe]')) return

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
      if (!dragging.current || Math.abs(offsetRef.current) > 8) return
      longFired.current = true
      try {
        navigator.vibrate?.(12)
      } catch {
        /* ignore */
      }
      onLongPress?.()
    }, 420)

    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!dragging.current || !enabled) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current

    if (!locked.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      locked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (locked.current === 'v') {
        clearLong()
        return
      }
      clearLong()
    }
    if (locked.current !== 'h') return

    const raw = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx))
    offsetRef.current = raw
    setOffset(raw)
    setReplyReady(Math.abs(raw) >= THRESHOLD)
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
      className="relative touch-pan-y"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
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
