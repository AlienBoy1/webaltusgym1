import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export const POST_REACTIONS = [
  { emoji: '❤️', id: 'heart', label: 'Me gusta' },
  { emoji: '💪', id: 'muscle', label: 'Fuerza' },
  { emoji: '🧴', id: 'protein', label: 'Merece un scoop' },
  { emoji: '🔥', id: 'fire', label: 'Intensidad' },
  { emoji: '⚡', id: 'zap', label: 'Energía' },
  { emoji: '🏆', id: 'trophy', label: 'Leyenda' }
]

/**
 * Facebook-style: click = ❤️ like toggle, long-press = reaction picker.
 * Stacked distinct reaction emojis nest beside the heart/count.
 */
export default function PostReactionButton({
  myReaction = null,
  likesCount = 0,
  reactionSummary = [],
  onReact,
  onShowReactors,
  disabled = false
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const longPressTimer = useRef(null)
  const longPressed = useRef(false)
  const btnRef = useRef(null)

  const clearTimer = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const startPress = () => {
    if (disabled) return
    longPressed.current = false
    clearTimer()
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true
      setPickerOpen(true)
      if (navigator.vibrate) navigator.vibrate(12)
    }, 380)
  }

  const endPress = () => {
    clearTimer()
    if (!longPressed.current && !pickerOpen) {
      onReact?.(myReaction ? null : '❤️')
    }
  }

  const pick = (emoji) => {
    setPickerOpen(false)
    onReact?.(emoji)
  }

  const display = myReaction || null
  const active = Boolean(display)

  const stacked = (Array.isArray(reactionSummary) && reactionSummary.length
    ? reactionSummary
    : myReaction
      ? [{ emoji: myReaction, count: 1 }]
      : []
  )
    .filter((r) => r?.emoji && r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return (
    <div className="relative flex items-center gap-1.5 min-w-0">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={clearTimer}
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onTouchCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm transition select-none touch-manipulation ${
          active
            ? 'text-[color:var(--color-primary)]'
            : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]'
        }`}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        title="Clic: Me gusta · Mantén: más reacciones"
      >
        <span className="text-lg leading-none">{display || '🤍'}</span>
        <span className="tabular-nums">{likesCount}</span>
      </button>

      {stacked.length > 0 && (
        <button
          type="button"
          onClick={() => onShowReactors?.()}
          className="inline-flex items-center -space-x-1.5 pl-0.5 pr-1 py-1 rounded-full hover:bg-[color:var(--bg-muted)] transition"
          title="Ver quién reaccionó"
          aria-label="Ver quién reaccionó"
        >
          {stacked.map((r) => (
            <span
              key={r.emoji}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-sm shadow-sm"
            >
              {r.emoji}
            </span>
          ))}
        </button>
      )}

      <AnimatePresence>
        {pickerOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Cerrar reacciones"
              onClick={() => setPickerOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.94 }}
              className="absolute bottom-full left-0 z-50 mb-2 flex gap-1 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] p-1.5 shadow-xl"
            >
              {POST_REACTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  title={r.label}
                  onClick={() => pick(r.emoji)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition hover:scale-125 ${
                    myReaction === r.emoji ? 'bg-[rgba(var(--color-primary-rgb),0.2)]' : ''
                  }`}
                >
                  {r.emoji}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
