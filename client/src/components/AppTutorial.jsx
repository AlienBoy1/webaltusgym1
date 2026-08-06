import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiCheck, FiX } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import api from '../utils/api'
import {
  TUTORIAL_IDS,
  getTutorialMeta,
  getTutorialSteps,
  hasCompletedTutorial
} from '../tutorials/registry'

export const TUTORIAL_STORAGE_KEY = 'qyntra_tutorial_done'
export const TUTORIAL_START_EVENT = 'qyntra:start-tutorial'
export const TUTORIAL_HUB_EVENT = 'qyntra:open-tutorial-hub'

export function openAppTutorial(tutorialId = TUTORIAL_IDS.QUICK_START) {
  window.dispatchEvent(
    new CustomEvent(TUTORIAL_START_EVENT, { detail: { tutorialId } })
  )
}

export function openTutorialHub() {
  window.dispatchEvent(new CustomEvent(TUTORIAL_HUB_EVENT))
}

function setAvatarMenuOpen(open) {
  window.dispatchEvent(new CustomEvent('qyntra:avatar-menu', { detail: { open: Boolean(open) } }))
}

const SPOTLIGHT_PAD = 10
const CARD_GAP = 16

function getTargetRect(tourId) {
  if (!tourId || typeof document === 'undefined') return null
  const el = document.querySelector(`[data-tour="${tourId}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 2 && r.height < 2) return null
  return {
    top: r.top - SPOTLIGHT_PAD,
    left: r.left - SPOTLIGHT_PAD,
    width: r.width + SPOTLIGHT_PAD * 2,
    height: r.height + SPOTLIGHT_PAD * 2,
    bottom: r.bottom + SPOTLIGHT_PAD,
    right: r.right + SPOTLIGHT_PAD,
    midY: r.top + r.height / 2
  }
}

function placeCard(rect, cardH = 220) {
  if (!rect) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: 360 }
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxW = Math.min(360, vw - 32)
  let top = rect.bottom + CARD_GAP
  if (top + cardH > vh - 16) {
    top = Math.max(16, rect.top - CARD_GAP - cardH)
  }
  let left = Math.min(Math.max(16, rect.left), vw - maxW - 16)
  if (rect.midY < vh * 0.35 && rect.bottom + cardH + CARD_GAP > vh - 16) {
    top = Math.min(vh - cardH - 16, rect.bottom + CARD_GAP)
  }
  return { top, left, maxWidth: maxW, transform: 'none' }
}

export default function AppTutorial() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, updateUser } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [tutorialId, setTutorialId] = useState(TUTORIAL_IDS.QUICK_START)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [cardStyle, setCardStyle] = useState(() => placeCard(null))
  const completingRef = useRef(false)
  const cardRef = useRef(null)

  const steps = getTutorialSteps(tutorialId)
  const meta = getTutorialMeta(tutorialId)
  const step = steps[stepIndex]
  const isLast = stepIndex >= steps.length - 1
  const isFirst = stepIndex === 0

  const measure = useCallback(() => {
    const next = getTargetRect(step?.target)
    setRect(next)
    const h = cardRef.current?.offsetHeight || 220
    setCardStyle(placeCard(next, h))
  }, [step?.target])

  const start = useCallback(
    (id = TUTORIAL_IDS.QUICK_START) => {
      completingRef.current = false
      const nextId = id || TUTORIAL_IDS.QUICK_START
      const nextSteps = getTutorialSteps(nextId)
      setTutorialId(nextId)
      setStepIndex(0)
      setOpen(true)
      document.body.dataset.qyntraTutorial = '1'
      setAvatarMenuOpen(false)
      const firstPath = nextSteps[0]?.path || '/dashboard'
      navigate(firstPath)
    },
    [navigate]
  )

  useEffect(() => {
    const onStart = (e) => start(e?.detail?.tutorialId || TUTORIAL_IDS.QUICK_START)
    window.addEventListener(TUTORIAL_START_EVENT, onStart)
    return () => window.removeEventListener(TUTORIAL_START_EVENT, onStart)
  }, [start])

  // Auto-show quick-start after username when never completed
  useEffect(() => {
    if (!user || open) return
    if (!user.username) return
    if (hasCompletedTutorial(user, TUTORIAL_IDS.QUICK_START)) return
    const t = window.setTimeout(() => start(TUTORIAL_IDS.QUICK_START), 600)
    return () => window.clearTimeout(t)
  }, [user?.id, user?._id, user?.username, user?.settings?.tutorialCompleted, open, start])

  // Auto-show profile tutorial on first profile visit
  useEffect(() => {
    if (!user || open) return
    if (!user.username) return
    if (location.pathname !== '/profile') return
    if (hasCompletedTutorial(user, TUTORIAL_IDS.PROFILE_EDIT)) return
    if (!hasCompletedTutorial(user, TUTORIAL_IDS.QUICK_START)) return
    const t = window.setTimeout(() => start(TUTORIAL_IDS.PROFILE_EDIT), 700)
    return () => window.clearTimeout(t)
  }, [user, open, start, location.pathname])

  useEffect(() => {
    if (!open || !step?.path) return
    if (window.location.pathname !== step.path) {
      navigate(step.path)
    }
  }, [open, step?.path, stepIndex, navigate])

  useEffect(() => {
    if (!open) return
    setAvatarMenuOpen(Boolean(step?.openAvatarMenu) || step?.id === 'avatar')
  }, [open, step?.id, step?.openAvatarMenu, stepIndex])

  useLayoutEffect(() => {
    if (!open) return
    let cancelled = false
    let tries = 0
    const tick = () => {
      if (cancelled) return
      if (step?.openAvatarMenu || step?.id === 'avatar') {
        setAvatarMenuOpen(true)
      }
      measure()
      tries += 1
      if (step?.target && !getTargetRect(step.target) && tries < 18) {
        window.setTimeout(tick, 70)
      }
    }
    const id = window.requestAnimationFrame(() => {
      window.setTimeout(tick, step?.openAvatarMenu ? 90 : 40)
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(id)
    }
  }, [open, stepIndex, step?.target, step?.openAvatarMenu, step?.id, measure])

  useEffect(() => {
    if (!open) return
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open, measure])

  const finish = useCallback(async () => {
    if (completingRef.current) return
    completingRef.current = true
    setOpen(false)
    setAvatarMenuOpen(false)
    delete document.body.dataset.qyntraTutorial
    const currentMeta = getTutorialMeta(tutorialId)
    try {
      localStorage.setItem(currentMeta.completionKey, '1')
    } catch {
      /* ignore */
    }
    if (tutorialId === TUTORIAL_IDS.QUICK_START) {
      try {
        await api.post('/users/complete-onboarding')
      } catch (err) {
        console.warn('complete-onboarding:', err?.message || err)
      }
    }
    try {
      const nextSettings = {
        ...(user?.settings || {}),
        [currentMeta.settingsKey]: true,
        ...(tutorialId === TUTORIAL_IDS.QUICK_START ? { tutorialCompleted: true } : {})
      }
      await api.put('/users/profile', { settings: nextSettings })
      updateUser({
        onboardingCompleted: true,
        settings: nextSettings,
        ...(tutorialId === TUTORIAL_IDS.QUICK_START ? { tutorialCompleted: true } : {})
      })
    } catch {
      updateUser({
        onboardingCompleted: true,
        ...(tutorialId === TUTORIAL_IDS.QUICK_START ? { tutorialCompleted: true } : {})
      })
    }
  }, [tutorialId, updateUser, user?.settings])

  const next = () => {
    if (isLast) finish()
    else setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }

  const prev = () => {
    if (!isFirst) setStepIndex((i) => Math.max(i - 1, 0))
  }

  useEffect(() => {
    if (!open) delete document.body.dataset.qyntraTutorial
  }, [open])

  if (!open || !step) return null

  const overlay = (
    <AnimatePresence>
      <motion.div
        key={`app-tutorial-${tutorialId}`}
        className="fixed inset-0 z-[95] pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-tutorial-title"
      >
        <div className="absolute inset-0 z-0" aria-hidden />

        <div className="absolute inset-0 z-[1] pointer-events-none" aria-hidden>
          {rect ? (
            <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <mask id="qyntra-tour-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <rect
                    x={rect.left}
                    y={rect.top}
                    width={rect.width}
                    height={rect.height}
                    rx="16"
                    ry="16"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.72)"
                mask="url(#qyntra-tour-mask)"
              />
            </svg>
          ) : (
            <div className="absolute inset-0 bg-black/72" />
          )}
        </div>

        {rect && (
          <motion.div
            aria-hidden
            className="absolute z-[2] rounded-2xl pointer-events-none"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              outline: '2px solid color-mix(in srgb, var(--color-primary, #FF6B35) 85%, white)',
              outlineOffset: 2,
              boxShadow: '0 0 0 4px color-mix(in srgb, var(--color-primary, #FF6B35) 35%, transparent)'
            }}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: [0.45, 0.95, 0.45] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <motion.div
          ref={cardRef}
          key={step.id}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute z-[3] w-[calc(100%-2rem)] rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl p-4 sm:p-5"
          style={cardStyle}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-primary)]">
                {meta.title} · {stepIndex + 1}/{steps.length}
              </p>
              <h2 id="app-tutorial-title" className="mt-1 font-display text-xl tracking-wide text-[color:var(--text-primary)]">
                {step.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={finish}
              className="rounded-lg p-1.5 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
              aria-label="Saltar tutorial"
            >
              <FiX size={18} />
            </button>
          </div>
          <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">{step.body}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-[color:var(--text-secondary)] disabled:opacity-30 hover:bg-[color:var(--bg-muted)]"
            >
              <FiArrowLeft size={16} /> Atrás
            </button>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[rgba(var(--color-primary-rgb),0.28)]"
            >
              {isLast ? (
                <>
                  <FiCheck size={16} /> Listo
                </>
              ) : (
                <>
                  Siguiente <FiArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(overlay, document.body)
}
