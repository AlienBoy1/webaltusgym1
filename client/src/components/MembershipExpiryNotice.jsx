import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiAward, FiClock } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import {
  FREE_ERA_END_ISO,
  freeEraEndLabel,
  isPastFreeEra
} from '../utils/membershipLifecycle'
import { canStartTutorials, subscribeAppGate } from '../utils/appGate'

const NOTICE_KEY = 'qyntra_membership_expiry_notice'

function noticeStorageKey(userId) {
  return userId ? `${NOTICE_KEY}:${userId}:2026` : null
}

function hasOptedOut(userId) {
  const key = noticeStorageKey(userId)
  if (!key) return true
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markOptedOut(userId) {
  const key = noticeStorageKey(userId)
  if (!key) return
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

/**
 * Free membership ends Dec 31, 2026 23:59 (Mexico City).
 * Shows on every login unless the user taps "No volver a recordar".
 * "Entendido" only closes it for the current session.
 */
export default function MembershipExpiryNotice() {
  const user = useAuthStore((s) => s.user)
  const membershipNotice = useAuthStore((s) => s.membershipNotice)
  const clearMembershipNotice = useAuthStore((s) => s.clearMembershipNotice)
  const [open, setOpen] = useState(false)
  const closedThisSessionRef = useRef(false)

  // New login notice → allow showing again this session
  useEffect(() => {
    if (membershipNotice) {
      closedThisSessionRef.current = false
    }
  }, [membershipNotice])

  useEffect(() => {
    const tryOpen = () => {
      const u = useAuthStore.getState().user
      if (!u?.id && !u?._id) return
      if (!u.username) return
      if (!canStartTutorials()) return
      if (document.body.dataset.qyntraTutorial === '1') return
      if (closedThisSessionRef.current) return

      const uid = u.id || u._id
      if (hasOptedOut(uid)) return

      const membership = u.membership
      const isLegacy =
        membership?.isLegacyFree !== false &&
        membership?.era !== 'paid' &&
        membership?.__paidEra !== true

      if (!isLegacy && !useAuthStore.getState().membershipNotice) return

      setOpen(true)
    }

    tryOpen()
    const unsub = subscribeAppGate(() => tryOpen())
    const t = window.setTimeout(tryOpen, 1200)
    return () => {
      unsub()
      window.clearTimeout(t)
    }
  }, [user?.id, user?._id, user?.username, user?.membership?.endDate, membershipNotice])

  const endsLabel = freeEraEndLabel()
  const expired = isPastFreeEra() || membershipNotice?.type === 'expired'

  const bodyText = expired
    ? `El acceso gratuito concluyó el ${endsLabel}. Pronto se habilitarán los planes de pago.`
    : `Tu membresía gratuita vence el ${endsLabel}. A partir de enero 2027 se habilitarán los planes de pago en Qyntra.`

  const closeForSession = () => {
    closedThisSessionRef.current = true
    setOpen(false)
  }

  const dontRemindAgain = () => {
    const uid = user?.id || user?._id
    markOptedOut(uid)
    closedThisSessionRef.current = true
    clearMembershipNotice?.()
    setOpen(false)
  }

  if (typeof document === 'undefined' || !open || !user) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-overlay-sheet fixed inset-0 z-[146] flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={closeForSession}
          />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:rounded-3xl"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-32"
              style={{
                background: expired
                  ? 'radial-gradient(90% 120% at 20% 0%, rgba(239,68,68,0.18), transparent 70%)'
                  : 'radial-gradient(90% 120% at 20% 0%, rgba(var(--color-primary-rgb),0.22), transparent 70%)'
              }}
            />
            <div className="relative px-5 pt-5 pb-5">
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    background: expired
                      ? 'rgba(239,68,68,0.14)'
                      : 'rgba(var(--color-primary-rgb),0.16)',
                    color: expired ? '#ef4444' : 'var(--color-primary)'
                  }}
                >
                  <FiAward size={22} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                    Membresía
                  </p>
                  <h2 className="mt-1 font-display text-2xl tracking-wide text-[color:var(--text-primary)]">
                    {expired
                      ? 'Periodo gratuito finalizado'
                      : 'Tu membresía gratuita tiene fecha límite'}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    {bodyText}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/55 px-3.5 py-3">
                <FiClock className="shrink-0 text-[color:var(--color-primary)]" size={18} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                    {expired ? 'Venció' : 'Vence'}
                  </p>
                  <p className="text-sm font-medium text-[color:var(--text-primary)]">{endsLabel}</p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">
                    Plan actual: {(user.membership?.plan || 'basic').toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <button type="button" onClick={closeForSession} className="btn-primary w-full py-3">
                  Entendido
                </button>
                <button
                  type="button"
                  onClick={dontRemindAgain}
                  className="w-full rounded-xl border border-[color:var(--border-subtle)] px-4 py-3 text-sm font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--bg-muted)] hover:text-[color:var(--text-primary)]"
                >
                  No volver a recordar
                </button>
              </div>
              <p className="mt-3 text-center text-[11px] text-[color:var(--text-muted)]">
                Puedes revisar los detalles en Inicio → Ver más o en tu perfil.
              </p>
              <time dateTime={FREE_ERA_END_ISO} className="sr-only">
                {FREE_ERA_END_ISO}
              </time>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
