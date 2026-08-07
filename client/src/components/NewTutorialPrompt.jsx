import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiBookOpen } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import { TUTORIAL_IDS, hasCompletedTutorial } from '../tutorials/registry'
import { getUnnotifiedTutorials, markTutorialsKnown } from '../tutorials/spotlight'
import {
  canStartTutorials,
  subscribeAppGate,
  setTutorialBlocking,
  canShowPrompt
} from '../utils/appGate'
import { openTutorialHub, TUTORIAL_CLOSED_EVENT } from './AppTutorial'

/**
 * After updates / gate settle: list EVERY catalog tutorial the user hasn't
 * been notified about since they last acknowledged (seeded on first run).
 */
export default function NewTutorialPrompt() {
  const user = useAuthStore((s) => s.user)
  const [payload, setPayload] = useState(null)
  const offeredIdsRef = useRef('')
  const timerRef = useRef(null)

  const dismiss = (openHub) => {
    if (!payload?.ids?.length) {
      setPayload(null)
      setTutorialBlocking(false)
      return
    }
    const ids = payload.ids
    markTutorialsKnown(user, ids)
    setPayload(null)
    setTutorialBlocking(false)
    if (openHub) {
      window.setTimeout(() => openTutorialHub({ highlightIds: ids }), 180)
    }
  }

  useEffect(() => {
    offeredIdsRef.current = ''
  }, [user?.id, user?._id])

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const tryOffer = () => {
      clearTimer()
      const u = useAuthStore.getState().user
      if (!u?.username) return
      if (!canStartTutorials() || !canShowPrompt('tutorial')) return
      if (!hasCompletedTutorial(u, TUTORIAL_IDS.QUICK_START)) return
      if (payload) return
      if (document.body.dataset.qyntraTutorial === '1') return

      const fresh = getUnnotifiedTutorials(u)
      if (!fresh.length) return

      const key = fresh
        .map((t) => t.id)
        .sort()
        .join('|')
      if (offeredIdsRef.current === key) return

      timerRef.current = window.setTimeout(() => {
        if (document.body.dataset.qyntraTutorial === '1') return
        if (!canStartTutorials() || !canShowPrompt('tutorial')) return
        offeredIdsRef.current = key
        setTutorialBlocking(true)
        setPayload({
          ids: fresh.map((t) => t.id),
          items: fresh
        })
      }, 900)
    }

    tryOffer()
    const unsub = subscribeAppGate(() => tryOffer())
    const onClosed = () => window.setTimeout(tryOffer, 400)
    window.addEventListener(TUTORIAL_CLOSED_EVENT, onClosed)
    return () => {
      clearTimer()
      unsub()
      window.removeEventListener(TUTORIAL_CLOSED_EVENT, onClosed)
    }
  }, [user?.id, user?._id, user?.username, user?.settings?.tutorialCompleted, payload])

  useEffect(() => {
    if (!payload) return undefined
    setTutorialBlocking(true)
    return () => setTutorialBlocking(false)
  }, [payload])

  if (typeof document === 'undefined' || !payload) return null

  const count = payload.items.length
  const title =
    count === 1
      ? payload.items[0]?.title || 'Nuevo tutorial'
      : `${count} tutoriales nuevos`

  return createPortal(
    <AnimatePresence>
      {payload && (
        <motion.div
          className="app-overlay-sheet fixed inset-0 z-[148] flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={() => dismiss(false)}
          />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:rounded-3xl"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-90"
              style={{
                background:
                  'radial-gradient(90% 120% at 15% 0%, rgba(var(--color-primary-rgb),0.22), transparent 70%)'
              }}
            />
            <div className="relative px-5 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(var(--color-primary-rgb),0.16)] text-[color:var(--color-primary)]">
                  <FiBookOpen size={22} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                    {count === 1 ? 'Nuevo tutorial' : 'Nuevos tutoriales'}
                  </p>
                  <h2 className="mt-1 font-display text-2xl tracking-wide text-[color:var(--text-primary)]">
                    {title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    {count === 1
                      ? 'Hay un tutorial nuevo desde tu última visita. Ábrelo ahora o más tarde desde el menú.'
                      : 'Estos tutoriales se agregaron desde tu última visita. Revísalos todos en el centro de tutoriales.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 max-h-[40vh] space-y-2 overflow-y-auto overscroll-contain pr-0.5">
                {payload.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/50 px-3.5 py-3"
                  >
                    <span className="text-2xl" aria-hidden>
                      {item.icon || '📘'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-[color:var(--text-muted)]">
                        {item.short || item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => dismiss(true)}
                  className="btn-primary flex-1 py-3"
                >
                  {count === 1 ? 'Ver ahora' : 'Ver todos'}
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(false)}
                  className="btn-secondary flex-1 py-3"
                >
                  Ahora no
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
