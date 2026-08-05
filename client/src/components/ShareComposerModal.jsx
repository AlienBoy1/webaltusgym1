import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiX, FiShare2, FiBarChart2, FiSmile } from 'react-icons/fi'

const DEFAULT_MOODS = [
  { id: 'motivated', label: 'Motivado', emoji: '🔥' },
  { id: 'proud', label: 'Orgulloso', emoji: '💪' },
  { id: 'focused', label: 'Enfocado', emoji: '🎯' },
  { id: 'happy', label: 'Bien', emoji: '😊' },
  { id: 'tired', label: 'Cansado', emoji: '😮‍💨' },
  { id: 'determined', label: 'Determinado', emoji: '⚡' }
]

/**
 * Native share compose for routines / follower posts.
 * Supports description, optional mood and optional poll.
 */
export default function ShareComposerModal({
  open,
  onClose,
  onSubmit,
  title = 'Compartir en Comunidad',
  subtitle = '',
  initialContent = '',
  submitLabel = 'Publicar',
  loading = false,
  attachmentPreview = null
}) {
  const [content, setContent] = useState(initialContent)
  const [mood, setMood] = useState(null)
  const [showPoll, setShowPoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('¿Vas a probar esta rutina?')
  const [pollOptions, setPollOptions] = useState(['Sí, la pruebo', 'Tal vez luego', 'No es para mí'])

  useEffect(() => {
    if (!open) return
    setContent(initialContent || '')
    setMood(null)
    setShowPoll(false)
    setPollQuestion('¿Vas a probar esta rutina?')
    setPollOptions(['Sí, la pruebo', 'Tal vez luego', 'No es para mí'])
  }, [open, initialContent])

  const submit = async (e) => {
    e?.preventDefault?.()
    const payload = {
      content: content.trim(),
      mood: mood || undefined,
      poll: undefined
    }
    if (showPoll) {
      const options = pollOptions.map((o) => o.trim()).filter(Boolean)
      if (pollQuestion.trim() && options.length >= 2) {
        payload.poll = { question: pollQuestion.trim(), options }
      }
    }
    await onSubmit?.(payload)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-overlay-sheet fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Cerrar" onClick={onClose} />
          <motion.form
            onSubmit={submit}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="relative flex max-h-[min(92svh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border sm:rounded-3xl"
            style={{
              background: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)'
            }}
          >
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: 'var(--color-primary)' }}>
                  Comunidad
                </p>
                <h2 className="font-display text-2xl tracking-wide">{title}</h2>
                {subtitle && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {subtitle}
                  </p>
                )}
              </div>
              <button type="button" onClick={onClose} className="rounded-xl p-2" style={{ color: 'var(--text-muted)' }}>
                <FiX size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
              {attachmentPreview && (
                <div
                  className="rounded-2xl border p-3"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-muted)' }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>
                    Se adjuntará
                  </p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {attachmentPreview.authorName || 'Publicación'}
                  </p>
                  {attachmentPreview.snippet && (
                    <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {attachmentPreview.snippet}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Descripción
                </label>
                <textarea
                  className="input-field min-h-[110px] resize-y"
                  placeholder="Escribe algo sobre lo que compartes…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  <FiSmile size={15} /> ¿Cómo te sientes?
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_MOODS.map((m) => {
                    const active = mood === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMood(active ? null : m.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition"
                        style={{
                          borderColor: active ? 'var(--color-primary)' : 'var(--border-subtle)',
                          background: active ? 'rgba(var(--color-primary-rgb),0.12)' : 'var(--bg-muted)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <span>{m.emoji}</span> {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowPoll((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
                  style={{
                    borderColor: showPoll ? 'var(--color-primary)' : 'var(--border-subtle)',
                    background: showPoll ? 'rgba(var(--color-primary-rgb),0.1)' : 'var(--bg-muted)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <FiBarChart2 size={15} /> {showPoll ? 'Quitar encuesta' : 'Agregar encuesta'}
                </button>

                {showPoll && (
                  <div className="mt-3 space-y-2 rounded-2xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-muted)' }}>
                    <input
                      className="input-field"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Pregunta de la encuesta"
                    />
                    {pollOptions.map((opt, i) => (
                      <input
                        key={i}
                        className="input-field"
                        value={opt}
                        onChange={(e) =>
                          setPollOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))
                        }
                        placeholder={`Opción ${i + 1}`}
                      />
                    ))}
                    {pollOptions.length < 4 && (
                      <button
                        type="button"
                        className="text-sm font-medium"
                        style={{ color: 'var(--color-primary)' }}
                        onClick={() => setPollOptions((p) => [...p, ''])}
                      >
                        + Opción
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div
              className="flex gap-2 border-t px-5 py-4"
              style={{
                borderColor: 'var(--border-subtle)',
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
              }}
            >
              <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={loading}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary flex flex-1 items-center justify-center gap-2" disabled={loading}>
                <FiShare2 size={16} /> {loading ? 'Publicando…' : submitLabel}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
