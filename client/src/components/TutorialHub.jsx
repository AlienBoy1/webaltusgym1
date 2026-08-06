import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiBookOpen, FiCheck, FiX } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import { TUTORIAL_CATALOG, hasCompletedTutorial } from '../tutorials/registry'
import { openAppTutorial, TUTORIAL_HUB_EVENT } from './AppTutorial'

/**
 * Native sheet listing every structured app tutorial.
 */
export default function TutorialHub() {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(TUTORIAL_HUB_EVENT, onOpen)
    return () => window.removeEventListener(TUTORIAL_HUB_EVENT, onOpen)
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-overlay-sheet fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            className="relative flex max-h-[min(88svh,640px)] w-full sm:max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(var(--color-primary-rgb),0.14)] text-[color:var(--color-primary)]">
                  <FiBookOpen size={18} />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-xl tracking-wide">Tutoriales</h2>
                  <p className="text-xs text-[color:var(--text-muted)]">Guías nativas paso a paso</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {TUTORIAL_CATALOG.map((item) => {
                const done = hasCompletedTutorial(user, item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      window.setTimeout(() => openAppTutorial(item.id), 180)
                    }}
                    className="flex w-full items-start gap-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/50 px-3.5 py-3 text-left transition hover:border-[color:var(--color-primary)] hover:bg-[rgba(var(--color-primary-rgb),0.08)]"
                  >
                    <span className="text-2xl leading-none mt-0.5" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-[color:var(--text-primary)]">{item.title}</span>
                        {done && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-500">
                            <FiCheck size={10} /> Visto
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-[color:var(--text-secondary)]">{item.short}</span>
                      <span className="mt-1 block text-[11px] leading-snug text-[color:var(--text-muted)]">
                        {item.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
