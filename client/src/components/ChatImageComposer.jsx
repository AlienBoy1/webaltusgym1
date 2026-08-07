import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiSend, FiX } from 'react-icons/fi'
import ViewOnceIcon from './ViewOnceIcon'

/**
 * Full-screen image preview before send (caption + view once).
 * force-dark keeps chrome readable under html.light remaps.
 */
export default function ChatImageComposer({
  open,
  imageUrl,
  recipientName = '',
  sending = false,
  onClose,
  onSend
}) {
  const [caption, setCaption] = useState('')
  const [viewOnce, setViewOnce] = useState(false)

  useEffect(() => {
    if (open) {
      setCaption('')
      setViewOnce(false)
    }
  }, [open, imageUrl])

  if (!open || !imageUrl || typeof document === 'undefined') return null

  return createPortal(
    <div className="force-dark fixed inset-0 z-[140] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="rounded-full p-2.5 text-white/90 hover:bg-white/10"
          aria-label="Cerrar"
        >
          <FiX size={24} />
        </button>
        {recipientName ? (
          <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-white/80">
            {recipientName}
          </p>
        ) : (
          <span className="flex-1" />
        )}
        <span className="w-11 shrink-0" aria-hidden />
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <img
          src={imageUrl}
          alt="Vista previa"
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
        {viewOnce && (
          <span className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <ViewOnceIcon size={16} active />
            Solo se verá una vez
          </span>
        )}
      </div>

      <div className="space-y-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-white/15 bg-white/10 py-1.5 pl-4 pr-1.5">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Añade un comentario…"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/45"
              maxLength={500}
              style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
            />
            <button
              type="button"
              onClick={() => setViewOnce((v) => !v)}
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
                viewOnce ? 'bg-white/15 text-[color:var(--color-primary)]' : 'text-white/80 hover:bg-white/10'
              }`}
              aria-label="Ver una sola vez"
              aria-pressed={viewOnce}
            >
              <ViewOnceIcon size={20} active={viewOnce} />
            </button>
          </div>
          <button
            type="button"
            disabled={sending}
            onClick={() => onSend({ caption: caption.trim(), viewOnce })}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white shadow-lg transition enabled:active:scale-95 disabled:opacity-40"
            aria-label="Enviar foto"
          >
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <FiSend size={18} className="-ml-0.5" />
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
