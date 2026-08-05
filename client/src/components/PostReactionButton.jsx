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
 * Facebook-style: click = ❤️ like toggle, long-press = reaction picker (story reactions).
 */
export default function PostReactionButton({
  myReaction = null,
  likesCount = 0,
  onReact,
  disabled = false
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const longPressTimer = useRef(null)
  const longPressed = useRef(false)

  const clearTimer = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const startPress = (e) => {
    if (disabled) return
    e.preventDefault?.()
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

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={clearTimer}
        onTouchStart={startPress}
        onTouchEnd={(e) => {
          e.preventDefault()
          endPress()
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
          active
            ? 'text-[color:var(--color-primary)]'
            : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]'
        }`}
        title="Clic: Me gusta · Mantén: más reacciones"
      >
        <span className="text-lg leading-none">{display || '🤍'}</span>
        <span>{likesCount}</span>
      </button>

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
