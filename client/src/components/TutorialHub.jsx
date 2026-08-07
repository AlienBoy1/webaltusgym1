import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiBookOpen, FiCheck, FiPlay, FiX } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import { TUTORIAL_CATALOG, hasCompletedTutorial } from '../tutorials/registry'
import { openAppTutorial, TUTORIAL_HUB_EVENT } from './AppTutorial'

/**
 * Native premium sheet listing every structured app tutorial (per-user "Visto").
 * Supports highlightIds to pulse new tutorials after an update.
 */
export default function TutorialHub() {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [highlightIds, setHighlightIds] = useState([])
  const itemRefs = useRef({})

  useEffect(() => {
    const onOpen = (event) => {
      const ids = Array.isArray(event?.detail?.highlightIds)
        ? event.detail.highlightIds.filter(Boolean)
        : []
      setHighlightIds(ids)
      setOpen(true)
    }
    window.addEventListener(TUTORIAL_HUB_EVENT, onOpen)
    return () => window.removeEventListener(TUTORIAL_HUB_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open || !highlightIds.length) return undefined
    const firstId = highlightIds[0]
    const t = window.setTimeout(() => {
      itemRefs.current[firstId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 280)
    return () => window.clearTimeout(t)
  }, [open, highlightIds])

  if (typeof document === 'undefined') return null

  const doneCount = TUTORIAL_CATALOG.filter((item) => hasCompletedTutorial(user, item.id)).length
  const highlightSet = new Set(highlightIds)

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-overlay-sheet fixed inset-0 z-[150] flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={() => {
              setOpen(false)
              setHighlightIds([])
            }}
          />
          <motion.div
            initial={{ y: 44, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            className="relative flex max-h-[min(90svh,680px)] w-full flex-col overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:max-w-md sm:rounded-3xl"
          >
            <div className="relative overflow-hidden border-b border-[color:var(--border-subtle)] px-4 py-4">
              <div
                className="pointer-events-none absolute inset-0 opacity-80"
                style={{
                  background:
                    'radial-gradient(120% 80% at 0% 0%, rgba(var(--color-primary-rgb),0.18), transparent 55%)'
                }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(var(--color-primary-rgb),0.16)] text-[color:var(--color-primary)]">
                    <FiBookOpen size={20} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-xl tracking-wide">Tutoriales</h2>
                    <p className="text-xs text-[color:var(--text-muted)]">
                      {highlightIds.length
                        ? `${highlightIds.length} nuevo${highlightIds.length === 1 ? '' : 's'} para ti`
                        : `${doneCount}/${TUTORIAL_CATALOG.length} completados · solo esta cuenta`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setHighlightIds([])
                  }}
                  className="rounded-lg p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {TUTORIAL_CATALOG.map((item) => {
                const done = hasCompletedTutorial(user, item.id)
                const highlighted = highlightSet.has(item.id)
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      itemRefs.current[item.id] = el
                    }}
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      setHighlightIds([])
                      window.setTimeout(() => openAppTutorial(item.id), 200)
                    }}
                    className={`group relative flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition ${
                      highlighted
                        ? 'border-[color:var(--color-primary)] bg-[rgba(var(--color-primary-rgb),0.12)] shadow-[0_0_0_1px_rgba(var(--color-primary-rgb),0.35)]'
                        : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/40 hover:border-[color:var(--color-primary)] hover:bg-[rgba(var(--color-primary-rgb),0.1)]'
                    }`}
                  >
                    {highlighted && (
                      <span
                        className="pointer-events-none absolute inset-0 rounded-2xl"
                        style={{
                          animation: 'qyntra-tutorial-pulse 1.8s ease-in-out 3',
                          boxShadow: '0 0 0 0 rgba(var(--color-primary-rgb), 0.45)'
                        }}
                      />
                    )}
                    <span className="mt-0.5 text-2xl leading-none" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[color:var(--text-primary)]">{item.title}</span>
                        {done ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-500">
                            <FiCheck size={10} /> Visto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[rgba(var(--color-primary-rgb),0.14)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--color-primary)]">
                            Nuevo
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-[color:var(--text-secondary)]">{item.short}</span>
                      <span className="mt-1 block text-[11px] leading-snug text-[color:var(--text-muted)]">
                        {item.description}
                      </span>
                    </span>
                    <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--bg-card)] text-[color:var(--color-primary)] opacity-70 transition group-hover:opacity-100">
                      <FiPlay size={14} />
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
