import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiBookOpen, FiRefreshCw } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import { TUTORIAL_IDS, hasCompletedTutorial } from '../tutorials/registry'
import {
  getPendingTutorialNotices,
  acknowledgeTutorialVersions
} from '../tutorials/spotlight'
import {
  subscribeAppGate,
  setTutorialNoticeBlocking,
  canShowPrompt
} from '../utils/appGate'
import { openTutorialHub, TUTORIAL_CLOSED_EVENT } from './AppTutorial'

/**
 * After updates / gate settle: surface brand-new tutorials AND content updates
 * (contentVersion bumps) with the right copy ("Nuevo" vs "Actualización").
 */
export default function NewTutorialPrompt() {
  const user = useAuthStore((s) => s.user)
  const initializing = useAuthStore((s) => s.initializing)
  const [payload, setPayload] = useState(null)
  const dismissedKeysRef = useRef(new Set())
  const pendingRef = useRef(null)

  const dismiss = (openHub) => {
    if (!payload?.ids?.length) {
      setPayload(null)
      pendingRef.current = null
      setTutorialNoticeBlocking(false)
      return
    }
    const ids = payload.ids
    if (payload.key) dismissedKeysRef.current.add(payload.key)
    acknowledgeTutorialVersions(user, ids)
    setPayload(null)
    pendingRef.current = null
    setTutorialNoticeBlocking(false)
    if (openHub) {
      window.setTimeout(() => openTutorialHub({ highlightIds: ids }), 180)
    }
  }

  useEffect(() => {
    dismissedKeysRef.current = new Set()
    pendingRef.current = null
  }, [user?.id, user?._id])

  useEffect(() => {
    const sync = () => {
      const u = useAuthStore.getState().user
      if (initializing || !u?.username) {
        setTutorialNoticeBlocking(false)
        setPayload(null)
        return
      }
      if (!hasCompletedTutorial(u, TUTORIAL_IDS.QUICK_START)) {
        setTutorialNoticeBlocking(false)
        setPayload(null)
        return
      }
      if (document.body.dataset.qyntraTutorial === '1') {
        setPayload(null)
        return
      }

      const fresh = getPendingTutorialNotices(u)
      if (!fresh.length) {
        pendingRef.current = null
        setTutorialNoticeBlocking(false)
        setPayload(null)
        return
      }

      const key = fresh
        .map((t) => `${t.kind}:${t.id}`)
        .sort()
        .join('|')

      if (dismissedKeysRef.current.has(key)) {
        setTutorialNoticeBlocking(false)
        setPayload(null)
        return
      }

      pendingRef.current = {
        key,
        ids: fresh.map((t) => t.id),
        items: fresh
      }
      setTutorialNoticeBlocking(true)

      if (!canShowPrompt('tutorialNotice')) {
        setPayload(null)
        return
      }

      setPayload(pendingRef.current)
    }

    sync()
    const unsub = subscribeAppGate(sync)
    const onClosed = () => window.setTimeout(sync, 420)
    window.addEventListener(TUTORIAL_CLOSED_EVENT, onClosed)
    return () => {
      unsub()
      window.removeEventListener(TUTORIAL_CLOSED_EVENT, onClosed)
    }
  }, [user?.id, user?._id, user?.username, user?.settings?.tutorialCompleted, initializing])

  if (typeof document === 'undefined' || !payload) return null

  const count = payload.items.length
  const allUpdates = payload.items.every((i) => i.kind === 'update')
  const allNew = payload.items.every((i) => i.kind === 'new')

  const eyebrow = allUpdates
    ? count === 1
      ? 'Actualización de tutorial'
      : 'Actualizaciones de tutoriales'
    : allNew
      ? count === 1
        ? 'Nuevo tutorial'
        : 'Nuevos tutoriales'
      : 'Tutoriales'

  const title = (() => {
    if (count === 1) return payload.items[0]?.title || eyebrow
    if (allUpdates) return `${count} tutoriales actualizados`
    if (allNew) return `${count} tutoriales nuevos`
    return `${count} tutoriales`
  })()

  const description = allUpdates
    ? count === 1
      ? 'Este tutorial se actualizó con funciones nuevas. Revísalo para no perderte nada.'
      : 'Hay tutoriales actualizados con cambios importantes. Revísalos en el centro de tutoriales.'
    : allNew
      ? count === 1
        ? 'Hay un tutorial nuevo desde tu última visita. Ábrelo ahora o más tarde desde el menú.'
        : 'Estos tutoriales se agregaron desde tu última visita. Revísalos todos en el centro de tutoriales.'
      : 'Hay tutoriales nuevos y actualizaciones listas para ti.'

  const Icon = allUpdates ? FiRefreshCw : FiBookOpen

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
                background: allUpdates
                  ? 'radial-gradient(90% 120% at 15% 0%, rgba(250,204,21,0.2), transparent 70%)'
                  : 'radial-gradient(90% 120% at 15% 0%, rgba(var(--color-primary-rgb),0.22), transparent 70%)'
              }}
            />
            <div className="relative px-5 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    background: allUpdates
                      ? 'rgba(250,204,21,0.16)'
                      : 'rgba(var(--color-primary-rgb),0.16)',
                    color: allUpdates ? '#FACC15' : 'var(--color-primary)'
                  }}
                >
                  <Icon size={22} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                    {eyebrow}
                  </p>
                  <h3 className="mt-1 font-display text-xl text-[color:var(--text-primary)]">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    {description}
                  </p>
                </div>
              </div>
              {count > 1 && (
                <ul className="mt-4 max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/60 p-2.5">
                  {payload.items.map((item) => (
                    <li
                      key={item.id}
                      className="truncate px-1.5 py-1 text-sm text-[color:var(--text-primary)]"
                    >
                      {item.kind === 'update' ? '↻ ' : '✦ '}
                      {item.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div
              className="flex gap-2 border-t border-[color:var(--border-subtle)] px-5 py-4"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              <button
                type="button"
                onClick={() => dismiss(false)}
                className="btn-secondary flex-1 py-3 text-sm"
              >
                Después
              </button>
              <button
                type="button"
                onClick={() => dismiss(true)}
                className="btn-primary flex-1 py-3 text-sm"
              >
                Ver ahora
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
