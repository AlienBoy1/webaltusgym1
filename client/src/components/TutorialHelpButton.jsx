import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiHelpCircle } from 'react-icons/fi'
import { getTutorialMeta } from '../tutorials/registry'
import { openAppTutorial } from './AppTutorial'

/**
 * Compact "?" entry to launch a screen’s catalog tutorial.
 * Place next to page titles or near tutorial landmarks (e.g. rest timer).
 */
export default function TutorialHelpButton({
  tutorialId,
  className = '',
  size = 'md',
  label,
  message
}) {
  const [open, setOpen] = useState(false)
  const meta = getTutorialMeta(tutorialId)
  const title = label || meta?.title || 'Tutorial'
  const body =
    message ||
    `Esta pantalla tiene un tutorial para comprender cómo usarla. Puedes verlo ahora o más tarde desde el centro de tutorías.`

  const dim = size === 'sm' ? 18 : size === 'lg' ? 22 : 20
  const btnPad = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-10 w-10' : 'h-9 w-9'

  const start = () => {
    setOpen(false)
    window.setTimeout(() => openAppTutorial(tutorialId), 180)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/80 text-[color:var(--text-secondary)] shadow-sm backdrop-blur-sm transition hover:border-[color:var(--color-primary)]/40 hover:bg-[color:var(--bg-elevated)] hover:text-[color:var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--color-primary-rgb),0.35)] ${btnPad} ${className}`}
        aria-label={`Ayuda: ${title}`}
        title={`Tutorial: ${title}`}
      >
        <FiHelpCircle size={dim} strokeWidth={2.2} />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                className="app-overlay-sheet fixed inset-0 z-[148] flex items-end justify-center p-0 sm:items-center sm:p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                  aria-label="Cerrar"
                  onClick={() => setOpen(false)}
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="tutorial-help-title"
                  initial={{ y: 36, opacity: 0, scale: 0.98 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="relative w-full max-w-sm overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:rounded-3xl"
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-24"
                    style={{
                      background:
                        'radial-gradient(90% 120% at 15% 0%, rgba(var(--color-primary-rgb),0.2), transparent 70%)'
                    }}
                  />
                  <div className="relative px-5 pt-5 pb-5">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(var(--color-primary-rgb),0.14)] text-[color:var(--color-primary)]">
                        <FiHelpCircle size={22} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
                          Tutorial disponible
                        </p>
                        <h2
                          id="tutorial-help-title"
                          className="mt-1 font-display text-xl tracking-wide text-[color:var(--text-primary)]"
                        >
                          {title}
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                          {body}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
                      <button type="button" onClick={start} className="btn-primary w-full py-3 sm:flex-1">
                        Ver tutorial
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="w-full rounded-xl border border-[color:var(--border-subtle)] px-4 py-3 text-sm font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--bg-muted)] hover:text-[color:var(--text-primary)] sm:flex-1"
                      >
                        Entendido
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
