import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiAward, FiTarget, FiTrendingUp, FiUsers, FiZap } from 'react-icons/fi'
import api from '../utils/api'
import { useAuthStore } from '../store/authStore'
import {
  setWelcomeBlocking,
  subscribeAppGate,
  canShowPrompt
} from '../utils/appGate'

const SETTING_KEY = 'qyntraWelcomeSeen'

function welcomeLocalKey(uid) {
  return uid ? `qyntra_welcome_seen:${uid}` : null
}

function readWelcomeSeenLocal(uid) {
  const key = welcomeLocalKey(uid)
  if (!key) return false
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeWelcomeSeenLocal(uid) {
  const key = welcomeLocalKey(uid)
  if (!key) return
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

/**
 * One-time product intro for every authenticated user (new + existing).
 * Persisted in profiles.settings.qyntraWelcomeSeen — blocks tutorials until dismissed.
 */
export default function WelcomeIntroModal() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const healTriedRef = useRef(new Set())

  const markSeenLocally = (uid, settingsBase) => {
    writeWelcomeSeenLocal(uid)
    updateUser({
      settings: { ...(settingsBase || {}), [SETTING_KEY]: true }
    })
  }

  const healDbIfNeeded = (uid, settingsBase) => {
    if (!uid || healTriedRef.current.has(String(uid))) return
    if (settingsBase?.[SETTING_KEY] === true) return
    if (!readWelcomeSeenLocal(uid)) return
    healTriedRef.current.add(String(uid))
    markSeenLocally(uid, settingsBase)
    api.put('/users/profile', { settings: { [SETTING_KEY]: true } }).catch(() => {
      /* local already true — retry next session */
      healTriedRef.current.delete(String(uid))
    })
  }

  useEffect(() => {
    const tryOpen = () => {
      if (!isAuthenticated) {
        setWelcomeBlocking(false)
        setOpen(false)
        return
      }
      const u = useAuthStore.getState().user
      const uid = u?.id || u?._id
      if (!uid) return
      if (!u.username) {
        setWelcomeBlocking(false)
        setOpen(false)
        return
      }
      if (document.body.dataset.qyntraTutorial === '1') return

      const seenInSettings = u.settings?.[SETTING_KEY] === true
      const seenLocal = readWelcomeSeenLocal(uid)

      // Already dismissed — never flash open. Heal DB if only local survived a failed PUT.
      if (seenInSettings || seenLocal) {
        if (seenLocal && !seenInSettings) healDbIfNeeded(uid, u.settings)
        setWelcomeBlocking(false)
        setOpen(false)
        return
      }

      // Need to show welcome — reserve slot so tutorials/membership wait
      setWelcomeBlocking(true)
      if (!canShowPrompt('welcome')) {
        setOpen(false)
        return
      }
      setOpen(true)
    }

    tryOpen()
    const t1 = window.setTimeout(tryOpen, 400)
    const t2 = window.setTimeout(tryOpen, 1400)
    const unsub = subscribeAppGate(() => tryOpen())
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      unsub()
    }
  }, [
    isAuthenticated,
    user?.id,
    user?._id,
    user?.username,
    user?.settings?.[SETTING_KEY]
  ])

  const dismiss = async () => {
    if (saving) return
    setSaving(true)
    const uid = user?.id || user?._id
    const nextSettings = {
      ...(useAuthStore.getState().user?.settings || {}),
      [SETTING_KEY]: true
    }
    // Persist locally first so a later login never flashes the modal again
    writeWelcomeSeenLocal(uid)
    updateUser({ settings: nextSettings })
    try {
      const { data } = await api.put('/users/profile', { settings: { [SETTING_KEY]: true } })
      if (data?.user) {
        updateUser({
          ...data.user,
          settings: { ...(data.user.settings || {}), [SETTING_KEY]: true }
        })
      }
    } catch {
      /* local persistence already applied */
    } finally {
      setWelcomeBlocking(false)
      setOpen(false)
      setSaving(false)
    }
  }

  // Retroactive tutorial / milestone badges for existing accounts
  useEffect(() => {
    const uid = user?.id || user?._id
    if (!uid || !isAuthenticated) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.post('/users/badges/sync')
        if (cancelled || !data?.user) return
        // Preserve welcome-seen if badge sync returns stale settings from DB
        const prevSettings = useAuthStore.getState().user?.settings || {}
        const incoming = data.user
        const mergedSettings = {
          ...(incoming.settings || {}),
          ...(prevSettings[SETTING_KEY] === true || readWelcomeSeenLocal(uid)
            ? { [SETTING_KEY]: true }
            : {})
        }
        updateUser({ ...incoming, settings: mergedSettings })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, user?._id, isAuthenticated, updateUser])

  if (typeof document === 'undefined') return null

  const highlights = [
    {
      icon: FiZap,
      title: 'Entrena con más ritmo',
      text: 'Convierte tus rutinas en un flujo claro, medible y entretenido.'
    },
    {
      icon: FiTarget,
      title: 'Retos y clases',
      text: 'Completa desafíos y sesiones para mantener la constancia.'
    },
    {
      icon: FiTrendingUp,
      title: 'XP y niveles',
      text: 'Gana experiencia con cada logro y sube de nivel en Qyntra.'
    },
    {
      icon: FiAward,
      title: 'Insignias',
      text: 'Desbloquea logros y compártelos con la comunidad.'
    },
    {
      icon: FiUsers,
      title: 'Comunidad',
      text: 'Historias, publicaciones y chat para entrenar acompañado.'
    }
  ]

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="qyntra-welcome-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
            aria-label="Cerrar"
            onClick={dismiss}
          />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 28, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="relative z-10 flex max-h-[min(92dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative shrink-0 overflow-hidden px-5 pt-6 pb-5 sm:px-7 sm:pt-8"
              style={{
                background:
                  'linear-gradient(145deg, rgba(var(--color-primary-rgb),0.22) 0%, rgba(var(--color-primary-rgb),0.06) 55%, transparent 100%)'
              }}
            >
              <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[rgba(var(--color-primary-rgb),0.18)] blur-2xl" />
              <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-[rgba(var(--color-primary-rgb),0.12)] blur-xl" />
              <p className="relative text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-primary)]">
                Bienvenido a Qyntra
              </p>
              <h2
                id="qyntra-welcome-title"
                className="relative mt-2 font-display text-2xl sm:text-[1.75rem] leading-tight text-[color:var(--text-primary)]"
              >
                Tu entrenamiento, automatizado y más divertido
              </h2>
              <p className="relative mt-2.5 text-sm sm:text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
                Qyntra organiza tus procesos personales de entrenamiento y los convierte en una
                experiencia clara: entrena, completa retos, gana XP, sube de nivel y desbloquea
                insignias para compartir con la comunidad.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">
              <ul className="space-y-3">
                {highlights.map((item) => (
                  <li
                    key={item.title}
                    className="flex gap-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/70 px-3.5 py-3"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--color-primary-rgb),0.14)] text-[color:var(--color-primary)]">
                      <item.icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-snug text-[color:var(--text-muted)]">
                        {item.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="shrink-0 border-t border-[color:var(--border-subtle)] px-5 py-4 sm:px-7"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              <button
                type="button"
                onClick={dismiss}
                disabled={saving}
                className="btn-primary w-full rounded-2xl py-3.5 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Empezar en Qyntra'}
              </button>
              <p className="mt-2.5 text-center text-[11px] text-[color:var(--text-muted)]">
                Este mensaje se muestra una sola vez
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
