import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FiArrowLeft,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiPlus,
  FiTrash2,
  FiX
} from 'react-icons/fi'
import { Avatar } from '../utils/avatarUtils'
import ChatEmojiPicker from './ChatEmojiPicker'

/** WhatsApp-style quick reactions (+ opens full picker). */
export const CHAT_QUICK_REACTIONS = [
  { emoji: '👍', id: 'like' },
  { emoji: '❤️', id: 'heart' },
  { emoji: '😂', id: 'laugh' },
  { emoji: '😮', id: 'wow' },
  { emoji: '😢', id: 'sad' },
  { emoji: '🙏', id: 'pray' },
  { emoji: '🥺', id: 'plead' }
]

export const DELETE_FOR_EVERYONE_MS = 60 * 60 * 1000

export function canDeleteForEveryone(msg) {
  if (!msg || msg.sender !== 'me' || msg.deleted) return false
  if (String(msg.id).startsWith('temp-')) return false
  const created = msg.createdAt || msg.created_at
  if (!created) return false
  const age = Date.now() - new Date(created).getTime()
  return age >= 0 && age <= DELETE_FOR_EVERYONE_MS
}

/**
 * Full-screen message selection: reaction bar, toolbar, delete & forward sheets.
 */
export default function ChatMessageActionOverlay({
  action,
  onClose,
  onReply,
  onReact,
  onDeleteForMe,
  onDeleteForEveryone,
  onForward,
  conversations = [],
  busy = false
}) {
  const msg = action?.msg
  const rect = action?.rect
  const [sheet, setSheet] = useState(null) // 'delete' | 'forward' | null
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [forwardQuery, setForwardQuery] = useState('')
  const [forwardBusy, setForwardBusy] = useState(false)
  const everyoneOk = canDeleteForEveryone(msg)

  useEffect(() => {
    setSheet(null)
    setEmojiOpen(false)
    setForwardQuery('')
  }, [msg?.id])

  useEffect(() => {
    if (!msg) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (emojiOpen) setEmojiOpen(false)
        else if (sheet) setSheet(null)
        else onClose?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [msg, sheet, emojiOpen, onClose])

  const forwardList = useMemo(() => {
    const q = forwardQuery.trim().toLowerCase()
    return (conversations || []).filter((c) => {
      if (!c?.otherId) return false
      if (!q) return true
      return (
        c.name?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q)
      )
    })
  }, [conversations, forwardQuery])

  if (typeof document === 'undefined' || !msg) return null

  const barTop = (() => {
    if (!rect) return Math.max(88, window.innerHeight * 0.28)
    // Prefer above the bubble with clear gap so reactions don't cover the text
    const preferred = rect.top - 72
    if (preferred >= 78) return preferred
    return Math.min(window.innerHeight - 110, rect.bottom + 14)
  })()

  const bubbleStyle = rect
    ? {
        position: 'absolute',
        top: rect.top,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - Math.min(rect.width, window.innerWidth - 20) - 10)),
        width: Math.min(rect.width, window.innerWidth - 20),
        maxWidth: 'min(85vw, 28rem)',
        zIndex: 15
      }
    : null

  const preview =
    msg.deleted
      ? 'Mensaje eliminado'
      : msg.text?.trim() ||
        (msg.attachment?.type === 'audio'
          ? 'Audio'
          : msg.attachment?.type === 'image'
            ? 'Foto'
            : msg.attachment?.type === 'story'
              ? 'Estado'
              : msg.attachment?.type === 'post'
                ? 'Publicación'
                : 'Mensaje')

  return createPortal(
    <AnimatePresence>
      {msg ? (
        <motion.div
          key={`sel-${msg.id}`}
          className="fixed inset-0 z-[160]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label="Cerrar"
            onClick={onClose}
          />

          {/* Top selection toolbar */}
          <motion.header
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            className="absolute inset-x-0 top-0 z-20 flex items-center gap-1 border-b border-white/10 bg-[color:var(--bg-elevated)]/95 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[color:var(--text-primary)] shadow-lg backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2.5 hover:bg-[color:var(--bg-muted)]"
              aria-label="Cancelar selección"
            >
              <FiArrowLeft size={20} />
            </button>
            <span className="min-w-[1.5rem] px-1 text-lg font-semibold tabular-nums">1</span>
            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                disabled={msg.deleted || busy}
                onClick={() => onReply?.(msg)}
                className="rounded-xl p-2.5 hover:bg-[color:var(--bg-muted)] disabled:opacity-40"
                aria-label="Responder"
                title="Responder"
              >
                <FiCornerUpLeft size={20} />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setSheet('delete')}
                className="rounded-xl p-2.5 text-red-500 hover:bg-red-500/10 disabled:opacity-40"
                aria-label="Eliminar"
                title="Eliminar"
              >
                <FiTrash2 size={20} />
              </button>
              <button
                type="button"
                disabled={msg.deleted || busy}
                onClick={() => setSheet('forward')}
                className="rounded-xl p-2.5 hover:bg-[color:var(--bg-muted)] disabled:opacity-40"
                aria-label="Reenviar"
                title="Reenviar"
              >
                <FiCornerUpRight size={20} />
              </button>
            </div>
          </motion.header>

          {/* Floating reaction bar — full viewport width track, never clipped */}
          {!msg.deleted && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 22, stiffness: 380 }}
              className="pointer-events-none absolute inset-x-0 z-20"
              style={{
                top: Math.min(
                  Math.max(barTop, 78),
                  typeof window !== 'undefined' ? window.innerHeight - 100 : barTop
                )
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pointer-events-auto flex w-full justify-center px-3 box-border">
                <div className="flex max-w-[calc(100vw-1.5rem)] items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-full border border-white/10 bg-[color:var(--bg-elevated)]/95 px-1.5 py-1 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl scrollbar-none">
                  {CHAT_QUICK_REACTIONS.map((r) => {
                    const active = msg.myReaction === r.emoji
                    return (
                      <button
                        key={r.id}
                        type="button"
                        title={r.emoji}
                        disabled={busy}
                        onClick={() => onReact?.(msg, r.emoji)}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[1.15rem] transition active:scale-90 ${
                          active
                            ? 'bg-[rgba(var(--color-primary-rgb),0.22)] ring-2 ring-[color:var(--color-primary)]'
                            : 'hover:bg-[color:var(--bg-muted)]'
                        }`}
                      >
                        {r.emoji}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEmojiOpen(true)}
                    className="ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)] ring-1 ring-[color:var(--border-subtle)] transition hover:text-[color:var(--color-primary)] active:scale-90"
                    aria-label="Más emojis"
                    title="Más emojis"
                  >
                    <FiPlus size={18} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Highlighted message ghost — kept separate from the reaction bar */}
          {bubbleStyle && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`pointer-events-none rounded-2xl px-3 py-2 text-sm shadow-2xl ring-2 ring-white/25 ${
                msg.sender === 'me'
                  ? 'bg-[color:var(--color-primary)] text-white'
                  : 'bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]'
              }`}
              style={bubbleStyle}
            >
              <p className="line-clamp-6 whitespace-pre-wrap break-words">{preview}</p>
            </motion.div>
          )}

          {/* Delete sheet */}
          <AnimatePresence>
            {sheet === 'delete' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
                onClick={() => setSheet(null)}
              >
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 28, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:rounded-3xl"
                >
                  <div className="border-b border-[color:var(--border-subtle)] px-5 py-4">
                    <p className="font-semibold text-[color:var(--text-primary)]">¿Eliminar mensaje?</p>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                      Esta acción no se puede deshacer.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDeleteForMe?.(msg)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-medium text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <FiTrash2 size={18} />
                    Eliminar para mí
                  </button>
                  {everyoneOk ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDeleteForEveryone?.(msg)}
                      className="flex w-full items-center gap-3 border-t border-[color:var(--border-subtle)] px-5 py-4 text-left text-sm font-medium text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <FiTrash2 size={18} />
                      Eliminar para todos
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSheet(null)}
                    className="w-full border-t border-[color:var(--border-subtle)] px-5 py-4 text-sm text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
                  >
                    Cancelar
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Forward sheet */}
          <AnimatePresence>
            {sheet === 'forward' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
                onClick={() => setSheet(null)}
              >
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 28, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex max-h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:rounded-3xl"
                >
                  <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
                    <p className="font-semibold text-[color:var(--text-primary)]">Reenviar a…</p>
                    <button
                      type="button"
                      onClick={() => setSheet(null)}
                      className="rounded-full p-2 hover:bg-[color:var(--bg-muted)]"
                      aria-label="Cerrar"
                    >
                      <FiX />
                    </button>
                  </div>
                  <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
                    <input
                      value={forwardQuery}
                      onChange={(e) => setForwardQuery(e.target.value)}
                      placeholder="Buscar conversación…"
                      className="input-field py-2.5 text-sm"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 py-2">
                    {forwardList.length === 0 ? (
                      <p className="py-10 text-center text-sm text-[color:var(--text-muted)]">
                        No hay conversaciones
                      </p>
                    ) : (
                      forwardList.map((c) => (
                        <button
                          key={c.otherId}
                          type="button"
                          disabled={forwardBusy || busy}
                          onClick={async () => {
                            setForwardBusy(true)
                            try {
                              await onForward?.(msg, c)
                              setSheet(null)
                              onClose?.()
                            } finally {
                              setForwardBusy(false)
                            }
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[color:var(--bg-muted)] disabled:opacity-50"
                        >
                          <Avatar avatar={c.avatar} name={c.name} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--text-primary)]">
                            {c.name}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <ChatEmojiPicker
            open={emojiOpen}
            onClose={() => setEmojiOpen(false)}
            onPick={(emoji) => {
              setEmojiOpen(false)
              onReact?.(msg, emoji)
            }}
            anchor="overlay"
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
