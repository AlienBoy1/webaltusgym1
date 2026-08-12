import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX } from 'react-icons/fi'
import { useHistoryBackLayer } from '../../hooks/useHistoryBackLayer'
import { BODY_EDUCATION } from '../../utils/bodyMetrics'

export default function BodyMetricExplainSheet({ educationId, open, onClose }) {
  const item = educationId ? BODY_EDUCATION[educationId] : null
  useHistoryBackLayer(Boolean(open && item), onClose, 'body-edu')

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && item && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Cerrar" onClick={onClose} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="relative z-10 w-full max-w-md rounded-t-2xl border border-white/10 bg-[color:var(--bg-elevated)] p-5 shadow-xl sm:rounded-2xl"
            style={{ maxHeight: 'min(88dvh, 560px)' }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--text-muted)]">Contexto</p>
                <h3 className="font-display text-xl text-[color:var(--text-primary)]">{item.title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-[color:var(--text-muted)] hover:bg-white/5"
                aria-label="Cerrar"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto text-sm leading-relaxed" style={{ maxHeight: '60dvh' }}>
              <section>
                <h4 className="mb-1 font-semibold text-primary-400">Qué es</h4>
                <p className="text-[color:var(--text-secondary)]">{item.what}</p>
              </section>
              <section>
                <h4 className="mb-1 font-semibold text-primary-400">Cómo usarlo</h4>
                <p className="text-[color:var(--text-secondary)]">{item.how}</p>
              </section>
              <section>
                <h4 className="mb-1 font-semibold text-primary-400">Límites</h4>
                <p className="text-[color:var(--text-secondary)]">{item.limits}</p>
              </section>
              <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-[color:var(--text-muted)]">
                Contenido educativo. No sustituye consejo médico ni de un profesional certificado.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
