import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiClock, FiLock, FiMessageCircle, FiX } from 'react-icons/fi'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Avatar } from '../utils/avatarUtils'
import { useAuthStore } from '../store/authStore'
import { useNotesStore } from '../store/notesStore'

const MAX_CHARS = 60
const INTRO_LS_KEY = 'qyntra_notes_intro_seen'

function hasSeenIntroLocal(userId) {
  try {
    return localStorage.getItem(`${INTRO_LS_KEY}:${userId}`) === '1'
  } catch {
    return false
  }
}

function markIntroLocal(userId) {
  try {
    localStorage.setItem(`${INTRO_LS_KEY}:${userId}`, '1')
  } catch {
    /* ignore */
  }
}

function hoursLeft(expiresAt) {
  if (!expiresAt) return 0
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (60 * 60 * 1000)))
}

/** Floating cloud beside avatar — Facebook Notes style */
export function NoteBubble({
  note,
  isOwner = false,
  onCreate,
  onOpen,
  className = ''
}) {
  if (!note && !isOwner) return null

  if (!note && isOwner) {
    return (
      <button
        type="button"
        onClick={onCreate}
        className={`absolute -right-1 -top-1 z-20 max-w-[7.5rem] rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-2.5 py-1.5 text-left shadow-[0_6px_18px_rgba(0,0,0,0.12)] transition hover:border-[color:var(--color-primary)]/35 sm:-right-2 sm:-top-2 sm:max-w-[8.5rem] ${className}`}
        aria-label="Crear nota"
      >
        <span className="block text-[11px] font-medium leading-snug text-[color:var(--text-secondary)] sm:text-xs">
          Di lo que piensas…
        </span>
        <span
          className="absolute -bottom-1.5 left-4 h-2.5 w-2.5 rotate-45 border-b border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]"
          aria-hidden
        />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`absolute -right-1 -top-1 z-20 max-w-[7.75rem] rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-2.5 py-1.5 text-left shadow-[0_8px_20px_rgba(0,0,0,0.14)] transition hover:scale-[1.02] active:scale-[0.98] sm:-right-3 sm:-top-2 sm:max-w-[9rem] ${className}`}
      aria-label={isOwner ? 'Ver tu nota' : 'Ver nota'}
    >
      <span className="block break-words text-[11px] font-medium leading-snug text-[color:var(--text-primary)] sm:text-xs">
        {note.body}
      </span>
      <span
        className="absolute -bottom-1.5 left-4 h-2.5 w-2.5 rotate-45 border-b border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]"
        aria-hidden
      />
    </button>
  )
}

function NoteIntroSheet({ open, onClose, onAgree }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-overlay-sheet fixed inset-0 z-[152] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-[color:var(--bg-elevated)] shadow-2xl"
          >
            <div
              className="relative flex h-36 items-center justify-center overflow-hidden"
              style={{
                background:
                  'linear-gradient(135deg, rgba(var(--color-primary-rgb),0.92), rgba(var(--color-accent-rgb),0.75) 55%, rgba(var(--color-primary-rgb),0.85))'
              }}
            >
              <div className="absolute left-6 top-8 h-8 w-8 rounded-full bg-white/25" />
              <div className="absolute right-10 top-10 h-6 w-6 rotate-12 rounded-md bg-[rgba(0,245,255,0.45)]" />
              <div className="absolute bottom-6 right-16 h-5 w-5 rounded-full bg-rose-300/70" />
              <div className="relative flex h-[4.5rem] w-[5.5rem] items-center justify-center rounded-[1.75rem] bg-sky-200/95 shadow-lg">
                <span className="text-3xl tracking-[0.2em] text-sky-800/80">···</span>
              </div>
            </div>

            <div className="px-5 pb-6 pt-5">
              <h2 className="text-center text-[1.35rem] font-bold leading-snug text-[color:var(--text-primary)]">
                Comparte lo que piensas con las notas
              </h2>

              <ul className="mt-5 space-y-4">
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.12)] text-[color:var(--color-primary)]">
                    <FiMessageCircle size={18} />
                  </span>
                  <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    Las notas son una forma sencilla de expresarte y compartir lo que piensas con tu
                    comunidad Qyntra.
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.12)] text-[color:var(--color-primary)]">
                    <FiClock size={18} />
                  </span>
                  <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    Las notas se muestran en tu perfil durante 24 horas.
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.12)] text-[color:var(--color-primary)]">
                    <FiLock size={18} />
                  </span>
                  <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    Solo tú puedes ver las respuestas a tu nota.
                  </p>
                </li>
              </ul>

              <button type="button" onClick={onAgree} className="btn-primary mt-6 w-full py-3.5 text-[15px]">
                De acuerdo
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

function NoteComposer({ open, onClose, avatar, name, initialBody = '', onSaved, onDeleted }) {
  const [text, setText] = useState(initialBody)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setText(initialBody || '')
  }, [open, initialBody])

  const canShare = text.trim().length > 0 && text.trim().length <= MAX_CHARS

  const share = async () => {
    if (!canShare || saving) return
    setSaving(true)
    try {
      const { data } = await api.post('/notes', { body: text.trim() })
      toast.success('Nota publicada · 24 h')
      onSaved?.(data.note)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo publicar')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    try {
      await api.delete('/notes/me')
      toast.success('Nota eliminada')
      onDeleted?.()
      onClose()
    } catch {
      toast.error('No se pudo eliminar')
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[151] flex flex-col bg-[color:var(--bg-app)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <header className="flex items-center justify-between gap-3 border-b border-[color:var(--border-subtle)] px-3 py-3 sm:px-5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)]"
              aria-label="Cerrar"
            >
              <FiX size={22} />
            </button>
            <h1 className="font-display text-lg tracking-wide text-[color:var(--text-primary)]">
              Nueva nota
            </h1>
            <button
              type="button"
              disabled={!canShare || saving}
              onClick={share}
              className={`min-w-[5.5rem] rounded-full px-3 py-2 text-sm font-semibold transition ${
                canShare
                  ? 'text-[color:var(--color-primary)] hover:bg-[rgba(var(--color-primary-rgb),0.1)]'
                  : 'cursor-not-allowed text-[color:var(--text-muted)]'
              }`}
            >
              {saving ? '…' : 'Compartir'}
            </button>
          </header>

          <div className="flex flex-1 flex-col items-center px-4 pt-10 sm:pt-14">
            <div className="relative w-full max-w-sm">
              <div className="relative mx-auto w-full max-w-[17rem] rounded-[1.65rem] border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-4 py-4 shadow-sm">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                  placeholder="Di lo que piensas…"
                  rows={3}
                  maxLength={MAX_CHARS}
                  autoFocus
                  className="w-full resize-none bg-transparent text-center text-[15px] leading-relaxed text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                />
                <span
                  className="absolute -bottom-2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]"
                  aria-hidden
                />
              </div>

              <div className="mt-5 flex flex-col items-center">
                <Avatar avatar={avatar} name={name} size="xl" />
                <p className="mt-3 text-sm tabular-nums text-[color:var(--text-muted)]">
                  {text.length} / {MAX_CHARS}
                </p>
              </div>
            </div>

            <p className="mt-auto mb-6 max-w-xs text-center text-xs leading-relaxed text-[color:var(--text-muted)] sm:mb-10">
              Compartida en tu perfil durante 24 horas.
            </p>

            {initialBody ? (
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className="mb-8 text-sm font-medium text-red-500 hover:underline"
              >
                Eliminar nota
              </button>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

function NoteViewerSheet({ open, note, isOwner, replies, onClose, onEdit, onReply, profileUser }) {
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) setReply('')
  }, [open])

  const sendReply = async () => {
    const body = reply.trim()
    if (!body || sending || !note) return
    setSending(true)
    try {
      await onReply?.(body)
      setReply('')
      toast.success('Respuesta enviada')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo responder')
    } finally {
      setSending(false)
    }
  }

  if (typeof document === 'undefined' || !note) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-overlay-sheet fixed inset-0 z-[150] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Cerrar" onClick={onClose} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-primary)]">
                  Nota
                </p>
                <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                  ~{hoursLeft(note.expiresAt)} h restantes
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[color:var(--bg-muted)]"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <Avatar avatar={profileUser?.avatar} name={profileUser?.name} size="md" />
                <div className="min-w-0 flex-1 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-3.5 py-3">
                  <p className="text-[15px] leading-relaxed text-[color:var(--text-primary)]">{note.body}</p>
                </div>
              </div>

              {isOwner ? (
                <div className="mt-5">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                    <FiLock size={12} /> Respuestas privadas
                  </div>
                  {replies?.length ? (
                    <ul className="max-h-48 space-y-2 overflow-y-auto">
                      {replies.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/60 px-3 py-2.5"
                        >
                          <p className="text-xs font-medium text-[color:var(--color-primary)]">
                            {r.from?.username ? `@${r.from.username}` : r.from?.name || 'Usuario'}
                          </p>
                          <p className="mt-0.5 text-sm text-[color:var(--text-primary)]">{r.body}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[color:var(--text-muted)]">Aún no hay respuestas.</p>
                  )}
                  <button type="button" onClick={onEdit} className="btn-primary mt-4 w-full py-3">
                    Editar nota
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <p className="text-xs text-[color:var(--text-muted)]">
                    Tu respuesta solo la verá {profileUser?.name || 'el autor'}.
                  </p>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value.slice(0, 280))}
                    rows={3}
                    placeholder="Escribe una respuesta…"
                    className="input-field w-full resize-none"
                  />
                  <button
                    type="button"
                    disabled={!reply.trim() || sending}
                    onClick={sendReply}
                    className="btn-primary w-full py-3 disabled:opacity-50"
                  >
                    {sending ? 'Enviando…' : 'Enviar respuesta'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

/**
 * Orchestrates notes on a profile (own or visited).
 * Wrap the avatar container with `relative` and render this sibling.
 */
export default function ProfileNotes({
  profileUserId,
  isOwner = false,
  avatar,
  name,
  className = ''
}) {
  const authUser = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [note, setNote] = useState(null)
  const [replies, setReplies] = useState([])
  const [introOpen, setIntroOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const uid = authUser?.id || authUser?._id

  const load = useCallback(async () => {
    if (!profileUserId) return
    try {
      if (isOwner) {
        const { data } = await api.get('/notes/me')
        setNote(data.note || null)
        setReplies(data.replies || [])
      } else {
        const { data } = await api.get(`/notes/user/${profileUserId}`)
        setNote(data.note || null)
        setReplies([])
      }
    } catch {
      setNote(null)
      setReplies([])
    }
  }, [profileUserId, isOwner])

  useEffect(() => {
    load()
  }, [load])

  const openCreateFlow = () => {
    const seenServer = authUser?.settings?.notesIntroSeen === true
    const seenLocal = uid && hasSeenIntroLocal(uid)
    if (isOwner && !seenServer && !seenLocal) {
      setIntroOpen(true)
      return
    }
    setComposerOpen(true)
  }

  const agreeIntro = async () => {
    if (uid) markIntroLocal(uid)
    setIntroOpen(false)
    try {
      await api.post('/notes/intro/seen')
      updateUser?.({
        settings: { ...(authUser?.settings || {}), notesIntroSeen: true }
      })
    } catch {
      /* local flag is enough */
    }
    setComposerOpen(true)
  }

  const reply = async (body) => {
    await api.post(`/notes/${note.id}/replies`, { body })
  }

  return (
    <>
      <div data-tour="tour-profile-notes" className={`pointer-events-auto ${className}`}>
        <NoteBubble
          note={note}
          isOwner={isOwner}
          onCreate={openCreateFlow}
          onOpen={() => (isOwner ? setViewerOpen(true) : setViewerOpen(true))}
        />
      </div>

      <NoteIntroSheet open={introOpen} onClose={() => setIntroOpen(false)} onAgree={agreeIntro} />

      <NoteComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        avatar={avatar}
        name={name}
        initialBody={note?.body || ''}
        onSaved={(n) => {
          setNote(n)
          setReplies([])
          const id = profileUserId
          if (id) useNotesStore.getState().prime(id, n)
        }}
        onDeleted={() => {
          setNote(null)
          setReplies([])
          const id = profileUserId
          if (id) useNotesStore.getState().prime(id, null)
        }}
      />

      <NoteViewerSheet
        open={viewerOpen}
        note={note}
        isOwner={isOwner}
        replies={replies}
        profileUser={{ avatar, name }}
        onClose={() => setViewerOpen(false)}
        onEdit={() => {
          setViewerOpen(false)
          setComposerOpen(true)
        }}
        onReply={reply}
      />
    </>
  )
}
