import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiArrowRight, FiTarget, FiTrendingUp, FiSliders } from 'react-icons/fi'
import api from '../utils/api'
import { useAuthStore } from '../store/authStore'
import {
  canShowPrompt,
  setQysiUpdateBlocking,
  subscribeAppGate
} from '../utils/appGate'
import {
  BODY_HUB_UPDATE_DONE_EVENT,
  BODY_HUB_UPDATE_EVENT,
  BODY_HUB_UPDATE_LOCAL,
  BODY_HUB_UPDATE_SETTING,
  shouldPlayProgressBodyIntro,
  shouldShowBodyHubAnnounce
} from '../tutorials/registry'
import { QISI_HANDLE, QISI_NAME } from '../utils/qisi'
import QySiAvatar from './QySiAvatar'

const SETTING_KEY = BODY_HUB_UPDATE_SETTING
const LOCAL_KEY = BODY_HUB_UPDATE_LOCAL

const STAGES = [
  {
    id: 'break',
    eyebrow: 'Actualización Qyntra',
    title: 'Rompiendo con lo de siempre',
    body: 'Qyntra decidió dejar atrás los entrenamientos “genéricos” y acompañarte de verdad en lo que mides y en lo que quieres lograr.'
  },
  {
    id: 'gymrats',
    eyebrow: 'Para ti y tus GymRats',
    title: 'Rutinas más ajustables',
    body: 'Ahora el progreso se conecta con tu cuerpo, tus preferencias y objetivos: medible, editable y pensado para tu ritmo.'
  },
  {
    id: 'guide',
    eyebrow: 'Yo te guío',
    title: `${QISI_NAME} te presenta el hub`,
    body: 'En Progreso verás tu ficha, check-ins, volumen real y una lectura estratégica. Ahora te llevo al recorrido paso a paso.'
  }
]

/** Time each stage stays on screen before auto-advancing (ms). */
const STAGE_MS = 6500
/** Extra beat on the last stage before enabling Continuar. */
const READY_AFTER_LAST_MS = 1800

function localKey(uid) {
  return uid ? `${LOCAL_KEY}:${uid}` : null
}

function readSeen(uid) {
  const key = localKey(uid)
  if (!key) return false
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeSeen(uid) {
  const key = localKey(uid)
  if (!key) return
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

/**
 * QySi announcement:
 * - Auto (login): legacy + 24h via appGate `qysiUpdate`
 * - Progress intro: forced when Progress tutorial starts during 24h (hub or auto)
 */
export default function QySiBodyHubUpdate() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const initializing = useAuthStore((s) => s.initializing)
  const updateUser = useAuthStore((s) => s.updateUser)

  const [open, setOpen] = useState(false)
  const [forceMode, setForceMode] = useState(false)
  const [asProgressIntro, setAsProgressIntro] = useState(false)
  const [stageIndex, setStageIndex] = useState(0)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pausedAuto, setPausedAuto] = useState(false)

  const firstName = useMemo(() => {
    const raw = String(user?.name || '').trim()
    if (!raw) return ''
    return raw.split(/\s+/)[0]
  }, [user?.name])

  const markSeen = (uid, settingsBase) => {
    writeSeen(uid)
    updateUser({
      settings: { ...(settingsBase || {}), [SETTING_KEY]: true }
    })
  }

  const dismiss = async () => {
    if (saving || !ready) return
    const u = useAuthStore.getState().user
    const uid = u?.id || u?._id
    const wasIntro = asProgressIntro
    setSaving(true)
    markSeen(uid, u?.settings)
    setOpen(false)
    setForceMode(false)
    setAsProgressIntro(false)
    setQysiUpdateBlocking(false)
    try {
      await api.put('/users/profile', { settings: { [SETTING_KEY]: true } })
    } catch {
      /* local already marked */
    } finally {
      setSaving(false)
      setStageIndex(0)
      setReady(false)
      if (wasIntro) {
        try {
          window.dispatchEvent(
            new CustomEvent(BODY_HUB_UPDATE_DONE_EVENT, { detail: { continueProgress: true } })
          )
        } catch {
          /* ignore */
        }
      }
    }
  }

  // Forced open as Progress tutorial intro (bypasses gate + "seen" flags)
  useEffect(() => {
    const onForce = () => {
      const u = useAuthStore.getState().user
      if (!u?.id && !u?._id) return
      if (!shouldPlayProgressBodyIntro(u)) return
      setAsProgressIntro(true)
      setForceMode(true)
      setStageIndex(0)
      setReady(false)
      setOpen(true)
      setQysiUpdateBlocking(false)
    }
    window.addEventListener(BODY_HUB_UPDATE_EVENT, onForce)
    return () => window.removeEventListener(BODY_HUB_UPDATE_EVENT, onForce)
  }, [])

  useEffect(() => {
    const sync = () => {
      if (forceMode) {
        setOpen(true)
        return
      }
      if (!isAuthenticated || initializing) {
        setQysiUpdateBlocking(false)
        setOpen(false)
        return
      }
      const u = useAuthStore.getState().user
      const uid = u?.id || u?._id
      if (!uid || !u.username) {
        setQysiUpdateBlocking(false)
        setOpen(false)
        return
      }

      if (!shouldShowBodyHubAnnounce(u)) {
        setQysiUpdateBlocking(false)
        setOpen(false)
        return
      }

      if (readSeen(uid) || u.settings?.[SETTING_KEY] === true) {
        if (u.settings?.[SETTING_KEY] === true) writeSeen(uid)
        setQysiUpdateBlocking(false)
        setOpen(false)
        return
      }

      const welcomeSeen =
        u.settings?.qyntraWelcomeSeen === true ||
        (() => {
          try {
            return localStorage.getItem(`qyntra_welcome_seen:${uid}`) === '1'
          } catch {
            return false
          }
        })()
      if (!welcomeSeen) {
        setQysiUpdateBlocking(false)
        setOpen(false)
        return
      }

      const introSeen =
        u.settings?.qysiIntroSeenV2 === true ||
        (() => {
          try {
            return localStorage.getItem(`qyntra_qysi_intro_seen:${uid}`) === '1'
          } catch {
            return false
          }
        })()
      if (!introSeen) {
        setQysiUpdateBlocking(false)
        setOpen(false)
        return
      }

      setQysiUpdateBlocking(true)
      setOpen(canShowPrompt('qysiUpdate'))
    }

    sync()
    const unsub = subscribeAppGate(sync)
    return () => {
      unsub()
      if (!forceMode) setQysiUpdateBlocking(false)
    }
  }, [
    isAuthenticated,
    initializing,
    forceMode,
    user?.id,
    user?._id,
    user?.username,
    user?.createdAt,
    user?.settings?.[SETTING_KEY],
    user?.settings?.qyntraWelcomeSeen,
    user?.settings?.qysiIntroSeenV2
  ])

  useEffect(() => {
    if (!open) return undefined
    setStageIndex(0)
    setReady(false)
    setPausedAuto(false)
    return undefined
  }, [open])

  useEffect(() => {
    if (!open || pausedAuto) return undefined
    if (stageIndex >= STAGES.length - 1) {
      const t = window.setTimeout(() => setReady(true), READY_AFTER_LAST_MS)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 1))
    }, STAGE_MS)
    return () => window.clearTimeout(t)
  }, [open, stageIndex, pausedAuto])

  const goNextStage = () => {
    setPausedAuto(true)
    if (stageIndex >= STAGES.length - 1) {
      setReady(true)
      return
    }
    setStageIndex((i) => Math.min(i + 1, STAGES.length - 1))
  }

  const goPrevStage = () => {
    setPausedAuto(true)
    setReady(false)
    setStageIndex((i) => Math.max(0, i - 1))
  }

  if (typeof document === 'undefined') return null

  const visible = forceMode ? open : open && canShowPrompt('qysiUpdate')
  const stage = STAGES[Math.min(stageIndex, STAGES.length - 1)]
  const isLast = stageIndex >= STAGES.length - 1

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[220] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          role="dialog"
          aria-modal="true"
          aria-label="Actualización QySi"
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 85% 65% at 50% 12%, rgba(var(--color-primary-rgb),0.28), transparent 55%), radial-gradient(ellipse 55% 45% at 88% 88%, rgba(var(--color-accent-rgb),0.16), transparent 50%), var(--bg-app)'
            }}
          />
          <motion.div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                'linear-gradient(color-mix(in srgb, var(--text-primary) 6%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 6%, transparent) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'radial-gradient(ellipse at center, black 25%, transparent 72%)'
            }}
            animate={{ opacity: [0.3, 0.55, 0.3] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative z-10 flex w-full max-w-lg flex-col px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0.4, y: 40, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 14 }}
              >
                <QySiAvatar size={112} pulse float />
              </motion.div>
              <motion.p
                className="mt-4 font-display text-4xl tracking-wide text-[color:var(--text-primary)] sm:text-5xl"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {QISI_NAME}
              </motion.p>
              <motion.p
                className="mt-1 text-sm font-semibold text-[color:var(--color-primary)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                @{QISI_HANDLE}
                {firstName ? ` · Hola, ${firstName}` : ''}
              </motion.p>
            </div>

            <div className="mt-6 flex min-h-[168px] items-stretch sm:min-h-[180px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, y: 22, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -14, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                  className="w-full rounded-2xl border border-[rgba(var(--color-primary-rgb),0.4)] bg-gradient-to-br from-[rgba(var(--color-primary-rgb),0.16)] via-[color:var(--bg-elevated)] to-[color:var(--bg-elevated)] px-5 py-4 text-left shadow-[0_16px_48px_rgba(var(--color-primary-rgb),0.14)] backdrop-blur-xl sm:px-6 sm:py-5"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[color:var(--color-primary)]">
                    {stage.eyebrow}
                  </p>
                  <p className="mt-1.5 font-display text-xl text-[color:var(--text-primary)] sm:text-2xl">
                    {stage.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)] sm:text-[15px]">
                    {stage.body}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={goPrevStage}
                disabled={stageIndex === 0}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-[color:var(--text-secondary)] disabled:opacity-30"
              >
                Anterior
              </button>
              <div className="flex justify-center gap-1.5">
                {STAGES.map((s, i) => (
                  <span
                    key={s.id}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === stageIndex ? 22 : 8,
                      background:
                        i <= stageIndex
                          ? 'var(--color-primary)'
                          : 'color-mix(in srgb, var(--text-muted) 45%, transparent)'
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={goNextStage}
                disabled={isLast && ready}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-[color:var(--color-primary)] disabled:opacity-40"
              >
                {isLast ? 'Listo' : 'Siguiente'}
              </button>
            </div>

            <motion.div
              className="mt-4 flex flex-wrap items-center justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: ready ? 1 : 0.35 }}
            >
              {[
                { icon: FiSliders, label: 'Ajustable' },
                { icon: FiTrendingUp, label: 'Medible' },
                { icon: FiTarget, label: 'Tu objetivo' }
              ].map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--bg-elevated)]/85 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)]"
                >
                  <chip.icon size={12} className="text-[color:var(--color-primary)]" />
                  {chip.label}
                </span>
              ))}
            </motion.div>

            <motion.button
              type="button"
              disabled={saving || !ready}
              onClick={dismiss}
              whileHover={ready ? { scale: 1.02 } : undefined}
              whileTap={ready ? { scale: 0.98 } : undefined}
              animate={{ opacity: ready ? 1 : 0.35, y: ready ? 0 : 8 }}
              className="relative mt-5 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-8 py-4 text-sm font-bold disabled:cursor-not-allowed sm:mx-auto sm:w-auto sm:min-w-[260px]"
              style={{
                background:
                  'linear-gradient(90deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 55%, var(--color-accent)) 52%, var(--color-accent) 100%)',
                color: '#0A0A0F',
                boxShadow: '0 18px 50px rgba(var(--color-primary-rgb),0.32)'
              }}
            >
              {asProgressIntro ? 'Empezar tutorial' : 'Continuar'}
              <FiArrowRight size={18} />
            </motion.button>
            <p className="mt-3 text-center text-[11px] text-[color:var(--text-muted)]">
              Usa Siguiente a tu ritmo · o espera ~{Math.round(STAGE_MS / 1000)} s por apartado
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
