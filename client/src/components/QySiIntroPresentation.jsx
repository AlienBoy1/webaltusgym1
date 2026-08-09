import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiActivity, FiArrowRight, FiHome, FiZap } from 'react-icons/fi'
import api from '../utils/api'
import { useAuthStore } from '../store/authStore'
import {
  canShowPrompt,
  setQysiBlocking,
  subscribeAppGate
} from '../utils/appGate'
import { writeLocalCompletion } from '../tutorials/completion'
import { TUTORIAL_IDS } from '../tutorials/registry'
import { markTutorialCompletedVersion } from '../tutorials/spotlight'
import { QISI_HANDLE, QISI_MEANING, QISI_NAME } from '../utils/qisi'
import QySiAvatar from './QySiAvatar'

export const QYSI_INTRO_EVENT = 'qyntra:open-qysi-intro'
const SETTING_KEY = 'qysiIntroSeenV2'
const COMPLETION_KEY = 'qyntra_qysi_intro_seen'

/** Replay / open the cinematic QySi welcome (from Tutoriales hub). */
export function openQySiIntro(options = {}) {
  window.dispatchEvent(
    new CustomEvent(QYSI_INTRO_EVENT, { detail: { force: true, ...options } })
  )
}

const STAGES = [
  {
    id: 'hello',
    eyebrow: 'Asistente virtual',
    title: (name) => (name ? `Hola, ${name}` : 'Hola'),
    body: () => `Soy ${QISI_NAME}. Un Qyntra-inner listo para acompañarte en cada sesión.`
  },
  {
    id: 'meaning',
    eyebrow: 'Qué significa',
    title: () => QISI_NAME,
    body: () => `${QISI_MEANING}. Inteligencia de entrenamiento dentro de tu app.`
  },
  {
    id: 'offer',
    eyebrow: 'Qué te ofrezco',
    title: () => '5 variantes · tu nivel',
    body: () =>
      'Gimnasio, casa, calistenia, running y full body. Elige foco, nivel y adopta la rutina en un toque.'
  },
  {
    id: 'invite',
    eyebrow: 'Dónde encontrarme',
    title: () => 'Entrenamientos',
    body: () =>
      'Ábreme cuando quieras en la burbuja inferior derecha. Siempre estaré ahí.'
  },
  {
    id: 'promise',
    eyebrow: 'Mi promesa',
    title: () => 'Sin importar tu nivel',
    body: () => 'Estoy aquí para ayudarte a entrenar.'
  }
]

function introLocalKey(uid) {
  return uid ? `qyntra_qysi_intro_seen:${uid}` : null
}

function readIntroSeenLocal(uid) {
  const key = introLocalKey(uid)
  if (!key) return false
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeIntroSeenLocal(uid) {
  const key = introLocalKey(uid)
  if (!key) return
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

function StageCard({ stage, firstName, active, dimmed }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 28 }}
      animate={{
        opacity: dimmed ? 0.42 : 1,
        y: 0,
        scale: active ? 1 : 0.98
      }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      className={`rounded-2xl border px-4 py-3 text-left backdrop-blur-xl sm:px-5 sm:py-3.5 ${
        active
          ? 'border-[rgba(var(--color-primary-rgb),0.45)] bg-gradient-to-br from-[rgba(var(--color-primary-rgb),0.18)] via-[color:var(--bg-elevated)] to-[color:var(--bg-elevated)] shadow-[0_12px_40px_rgba(var(--color-primary-rgb),0.16)]'
          : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/80'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--color-primary)]">
        {stage.eyebrow}
      </p>
      <p className="mt-1 font-display text-xl tracking-wide text-[color:var(--text-primary)] sm:text-2xl">
        {stage.title(firstName)}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--text-secondary)] sm:text-[15px]">
        {stage.body(firstName)}
      </p>
    </motion.div>
  )
}

/**
 * One-time cinematic intro for QySi after welcome (before structured tutorials).
 */
export default function QySiIntroPresentation() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const initializing = useAuthStore((s) => s.initializing)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [open, setOpen] = useState(false)
  const [stageIndex, setStageIndex] = useState(-1)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [replayMode, setReplayMode] = useState(false)

  const firstName = useMemo(() => {
    const raw = String(user?.name || '').trim()
    if (!raw) return ''
    return raw.split(/\s+/)[0]
  }, [user?.name])

  const markSeen = (uid, settingsBase) => {
    writeIntroSeenLocal(uid)
    writeLocalCompletion(COMPLETION_KEY, uid)
    markTutorialCompletedVersion(useAuthStore.getState().user || { id: uid }, TUTORIAL_IDS.QYSI_WELCOME)
    updateUser({
      settings: { ...(settingsBase || {}), [SETTING_KEY]: true }
    })
  }

  const dismiss = async () => {
    if (saving || !ready) return
    const u = useAuthStore.getState().user
    const uid = u?.id || u?._id
    setSaving(true)
    markSeen(uid, u?.settings)
    setOpen(false)
    setReplayMode(false)
    setQysiBlocking(false)
    try {
      await api.put('/users/profile', { settings: { [SETTING_KEY]: true } })
    } catch {
      /* local already marked */
    } finally {
      setSaving(false)
      setStageIndex(-1)
      setReady(false)
    }
  }

  useEffect(() => {
    const onForceOpen = () => {
      const u = useAuthStore.getState().user
      if (!u?.id && !u?._id) return
      setReplayMode(true)
      setStageIndex(-1)
      setReady(false)
      setQysiBlocking(true)
      setOpen(canShowPrompt('qysi'))
    }
    window.addEventListener(QYSI_INTRO_EVENT, onForceOpen)
    return () => window.removeEventListener(QYSI_INTRO_EVENT, onForceOpen)
  }, [])

  useEffect(() => {
    const sync = () => {
      if (replayMode) {
        setQysiBlocking(true)
        setOpen(canShowPrompt('qysi'))
        return
      }
      if (!isAuthenticated || initializing) {
        setQysiBlocking(false)
        setOpen(false)
        return
      }
      const u = useAuthStore.getState().user
      const uid = u?.id || u?._id
      if (!uid || !u.username) {
        setQysiBlocking(false)
        setOpen(false)
        return
      }

      const seenSettings = u.settings?.[SETTING_KEY] === true
      const seenLocal = readIntroSeenLocal(uid)
      if (seenSettings || seenLocal) {
        if (seenSettings) writeIntroSeenLocal(uid)
        if (seenLocal && !seenSettings) {
          markSeen(uid, u.settings)
          api.put('/users/profile', { settings: { [SETTING_KEY]: true } }).catch(() => {})
        }
        setQysiBlocking(false)
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
        setQysiBlocking(false)
        setOpen(false)
        return
      }

      setQysiBlocking(true)
      setOpen(canShowPrompt('qysi'))
    }

    sync()
    const unsub = subscribeAppGate(sync)
    return () => {
      unsub()
      if (!replayMode) setQysiBlocking(false)
    }
  }, [
    isAuthenticated,
    initializing,
    replayMode,
    user?.id,
    user?._id,
    user?.username,
    user?.settings?.[SETTING_KEY],
    user?.settings?.qyntraWelcomeSeen
  ])

  useEffect(() => {
    if (!open) return undefined
    setStageIndex(-1)
    setReady(false)
    const timers = []
    // Avatar settles, then stage cascade
    timers.push(window.setTimeout(() => setStageIndex(0), 700))
    STAGES.forEach((_, i) => {
      if (i === 0) return
      timers.push(window.setTimeout(() => setStageIndex(i), 700 + i * 900))
    })
    timers.push(
      window.setTimeout(() => {
        setStageIndex(STAGES.length - 1)
        setReady(true)
      }, 700 + STAGES.length * 900)
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [open])

  if (typeof document === 'undefined') return null

  const visibleCount = Math.max(0, stageIndex + 1)

  return createPortal(
    <AnimatePresence>
      {open && canShowPrompt('qysi') && (
        <motion.div
          className="fixed inset-0 z-[190] flex items-end justify-center overflow-hidden sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
        >
          {/* Theme-adaptive cinematic backdrop */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background:
                'radial-gradient(ellipse 90% 70% at 50% 18%, rgba(var(--color-primary-rgb),0.24), transparent 55%), radial-gradient(ellipse 60% 50% at 82% 92%, rgba(var(--color-accent-rgb),0.14), transparent 52%), var(--bg-app)'
            }}
          />
          <motion.div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)'
            }}
            animate={{ opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Sweep light — contrast-safe on light & dark */}
          <motion.div
            className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 rotate-12"
            style={{
              background:
                'linear-gradient(90deg, transparent, color-mix(in srgb, var(--text-primary) 14%, transparent), transparent)'
            }}
            initial={{ x: '-20%' }}
            animate={{ x: '320%' }}
            transition={{ duration: 2.8, ease: 'easeInOut', delay: 0.2 }}
          />

          <div className="relative z-10 flex max-h-[100dvh] w-full max-w-xl flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:py-10">
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{
                  x: typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.42, 220) : 180,
                  y: typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.38, 320) : 260,
                  scale: 0.22,
                  rotate: -18,
                  opacity: 0
                }}
                animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 95, damping: 14, mass: 1.05 }}
              >
                <QySiAvatar size={128} pulse float />
              </motion.div>

              <motion.div
                className="mt-5"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.55 }}
              >
                <motion.p
                  className="font-display text-5xl tracking-[0.04em] text-[color:var(--text-primary)] sm:text-6xl"
                  initial={{ letterSpacing: '0.28em', opacity: 0.4 }}
                  animate={{ letterSpacing: '0.04em', opacity: 1 }}
                  transition={{ delay: 0.55, duration: 0.7 }}
                >
                  {QISI_NAME}
                </motion.p>
                <motion.p
                  className="mt-1 text-sm font-semibold text-[color:var(--color-primary)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.75 }}
                >
                  @{QISI_HANDLE}
                </motion.p>
              </motion.div>
            </div>

            <div className="mt-6 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pb-2 scrollbar-hide">
              <AnimatePresence initial={false}>
                {STAGES.slice(0, visibleCount).map((stage, idx) => (
                  <StageCard
                    key={stage.id}
                    stage={stage}
                    firstName={firstName}
                    active={idx === stageIndex}
                    dimmed={idx < stageIndex && stageIndex < STAGES.length - 1}
                  />
                ))}
              </AnimatePresence>
            </div>

            <motion.div
              className="mt-3 flex flex-wrap items-center justify-center gap-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 10 }}
              transition={{ duration: 0.45 }}
            >
              {[
                { icon: FiHome, label: 'Gimnasio & Casa' },
                { icon: FiZap, label: '5 variantes' },
                { icon: FiActivity, label: 'Tu nivel' }
              ].map((chip, i) => (
                <motion.span
                  key={chip.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={ready ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.08 * i }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--bg-elevated)]/80 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] backdrop-blur-md"
                >
                  <chip.icon size={12} className="text-[color:var(--color-primary)]" />
                  {chip.label}
                </motion.span>
              ))}
            </motion.div>

            <motion.button
              type="button"
              disabled={saving || !ready}
              onClick={dismiss}
              whileHover={ready ? { scale: 1.02 } : undefined}
              whileTap={ready ? { scale: 0.98 } : undefined}
              initial={{ opacity: 0, y: 24 }}
              animate={{
                opacity: ready ? 1 : 0.25,
                y: ready ? 0 : 16
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="relative mt-5 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-8 py-4 text-sm font-bold shadow-[0_18px_50px_rgba(var(--color-primary-rgb),0.35)] disabled:cursor-not-allowed sm:mx-auto sm:w-auto sm:min-w-[240px]"
              style={{
                background:
                  'linear-gradient(90deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 55%, var(--color-accent)) 52%, var(--color-accent) 100%)',
                color: '#0A0A0F'
              }}
            >
              {ready && (
                <motion.span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, color-mix(in srgb, #fff 40%, transparent), transparent)'
                  }}
                  initial={{ x: '-120%' }}
                  animate={{ x: '120%' }}
                  transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.8 }}
                />
              )}
              <span className="relative z-[1]">{saving ? 'Guardando…' : 'Continuar'}</span>
              {!saving && <FiArrowRight className="relative z-[1]" size={18} />}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
