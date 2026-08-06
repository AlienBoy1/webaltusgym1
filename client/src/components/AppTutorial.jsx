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

const SPOTLIGHT_PAD = 8
const CARD_GAP = 14
const HEADER_SAFE = 72
const BOTTOM_NAV_SAFE = 84
const EDGE = 12
const MAX_WAIT_TRIES = 36

function isElementVisible(el) {
  if (!el || typeof window === 'undefined') return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false
  }
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return false
  // Off-screen far beyond viewport (allow slight overflow)
  if (r.bottom < -40 || r.top > window.innerHeight + 40) return false
  if (r.right < -40 || r.left > window.innerWidth + 40) return false
  return true
}

/** Prefer the first visible matching tour target (desktop vs mobile duplicates). */
function findTourElement(tourId) {
  if (!tourId || typeof document === 'undefined') return null
  const nodes = Array.from(document.querySelectorAll(`[data-tour="${tourId}"]`))
  if (!nodes.length) return null
  return nodes.find(isElementVisible) || nodes.find((el) => {
    const r = el.getBoundingClientRect()
    return r.width >= 2 && r.height >= 2
  }) || nodes[0]
}

function getTargetRect(tourId) {
  const el = findTourElement(tourId)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return null

  // Cap huge targets so the tip card still has room
  const maxH = Math.min(r.height, Math.max(120, window.innerHeight * 0.42))
  const maxW = Math.min(r.width, Math.max(160, window.innerWidth * 0.92))
  const width = maxW
  const height = maxH
  const left = r.left + (r.width - width) / 2
  const top = r.top

  return {
    el,
    top: top - SPOTLIGHT_PAD,
    left: left - SPOTLIGHT_PAD,
    width: width + SPOTLIGHT_PAD * 2,
    height: height + SPOTLIGHT_PAD * 2,
    bottom: top + height + SPOTLIGHT_PAD,
    right: left + width + SPOTLIGHT_PAD,
    midY: top + height / 2,
    raw: r
  }
}

function scrollTargetIntoView(tourId) {
  const el = findTourElement(tourId)
  if (!el) return false
  try {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
  } catch {
    el.scrollIntoView()
  }
  return true
}

function safeInsets() {
  const vh = window.innerHeight
  const vw = window.innerWidth
  const isNarrow = vw < 768
  return {
    vw,
    vh,
    top: HEADER_SAFE,
    bottom: isNarrow ? BOTTOM_NAV_SAFE : EDGE + 16,
    left: EDGE,
    right: EDGE,
    isNarrow
  }
}

/**
 * Place tip card fully inside the safe viewport. Prefer below target, then above,
 * then dock so the full message stays readable without covering bottom nav targets.
 */
function placeCard(rect, cardH = 210, cardW = 360) {
  const { vw, vh, top: safeTop, bottom: safeBottom, left: safeLeft, right: safeRight, isNarrow } =
    safeInsets()
  const maxW = Math.min(cardW, vw - safeLeft - safeRight)
  const usableBottom = vh - safeBottom
  const usableTop = safeTop
  const maxCardH = Math.max(140, usableBottom - usableTop - 8)
  const h = Math.min(cardH || 210, maxCardH)

  const dockBottom = () => ({
    mode: 'dock',
    top: Math.max(usableTop, usableBottom - h),
    left: safeLeft,
    width: vw - safeLeft - safeRight,
    maxWidth: vw - safeLeft - safeRight,
    maxHeight: maxCardH,
    transform: 'none'
  })

  const dockTop = () => ({
    mode: 'dock',
    top: usableTop,
    left: safeLeft,
    width: vw - safeLeft - safeRight,
    maxWidth: vw - safeLeft - safeRight,
    maxHeight: maxCardH,
    transform: 'none'
  })

  if (!rect) {
    return isNarrow ? dockBottom() : {
      mode: 'center',
      top: '50%',
      left: '50%',
      maxWidth: Math.min(360, vw - 32),
      maxHeight: maxCardH,
      transform: 'translate(-50%, -50%)'
    }
  }

  // Target in bottom band (mobile nav / lower chrome): tip goes to top so it is fully readable
  const targetNearBottom = rect.midY > vh * 0.62 || rect.bottom > usableBottom - 8
  if (isNarrow && targetNearBottom) return dockTop()
  if (isNarrow) return dockBottom()

  const candidates = []
  candidates.push({
    top: rect.bottom + CARD_GAP,
    left: Math.min(Math.max(safeLeft, rect.left), vw - maxW - safeRight)
  })
  candidates.push({
    top: rect.top - CARD_GAP - h,
    left: Math.min(Math.max(safeLeft, rect.left), vw - maxW - safeRight)
  })
  candidates.push({
    top: Math.min(Math.max(usableTop, rect.top), usableBottom - h),
    left: rect.right + CARD_GAP
  })

  for (const c of candidates) {
    if (
      c.top >= usableTop - 2 &&
      c.top + h <= usableBottom + 2 &&
      c.left >= safeLeft - 2 &&
      c.left + maxW <= vw - safeRight + 2
    ) {
      return { top: c.top, left: c.left, maxWidth: maxW, maxHeight: maxCardH, transform: 'none', mode: 'float' }
    }
  }

  return targetNearBottom ? dockTop() : dockBottom()
}

function pathMatches(current, expected) {
  if (!expected) return true
  const a = (current || '').replace(/\/+$/, '') || '/'
  const b = (expected || '').replace(/\/+$/, '') || '/'
  return a === b
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
  const [ready, setReady] = useState(false)
  const completingRef = useRef(false)
  const cardRef = useRef(null)
  const alignGen = useRef(0)

  const steps = getTutorialSteps(tutorialId)
  const meta = getTutorialMeta(tutorialId)
  const step = steps[stepIndex]
  const isLast = stepIndex >= steps.length - 1
  const isFirst = stepIndex === 0

  const applyMeasure = useCallback(() => {
    const next = step?.target ? getTargetRect(step.target) : null
    setRect(next)
    const measuredH = cardRef.current?.offsetHeight || 210
    setCardStyle(placeCard(next, measuredH))
    return next
  }, [step?.target])

  const alignStep = useCallback(async () => {
    const gen = ++alignGen.current
    setReady(false)

    if (!step) return

    // 1) Navigate to the step route and wait for it
    if (step.path && !pathMatches(window.location.pathname, step.path)) {
      navigate(step.path)
    }

    // 2) Open / close avatar menu as needed
    const needsMenu = Boolean(step.openAvatarMenu) || step.id === 'avatar'
    setAvatarMenuOpen(needsMenu)

    // 3) Wait until path + target are ready, scrolling target into view
    let tries = 0
    while (tries < MAX_WAIT_TRIES && gen === alignGen.current) {
      const onPath = !step.path || pathMatches(window.location.pathname, step.path)
      if (onPath) {
        if (needsMenu) setAvatarMenuOpen(true)
        if (!step.target) {
          if (gen === alignGen.current) {
            setRect(null)
            setCardStyle(placeCard(null, cardRef.current?.offsetHeight || 210))
            setReady(true)
          }
          return
        }
        scrollTargetIntoView(step.target)
        const found = getTargetRect(step.target)
        if (found) {
          // Second scroll+measure after layout settles
          await new Promise((r) => window.requestAnimationFrame(() => window.setTimeout(r, 40)))
          if (gen !== alignGen.current) return
          scrollTargetIntoView(step.target)
          applyMeasure()
          // Remeasure with real card height
          await new Promise((r) => window.requestAnimationFrame(() => window.setTimeout(r, 30)))
          if (gen !== alignGen.current) return
          applyMeasure()
          setReady(true)
          return
        }
      }
      tries += 1
      await new Promise((r) => window.setTimeout(r, 80))
    }

    // Fallback: show centered / docked tip even if target missing
    if (gen === alignGen.current) {
      setRect(null)
      setCardStyle(placeCard(null, cardRef.current?.offsetHeight || 210))
      setReady(true)
    }
  }, [step, navigate, applyMeasure])

  const start = useCallback(
    (id = TUTORIAL_IDS.QUICK_START) => {
      completingRef.current = false
      const nextId = id || TUTORIAL_IDS.QUICK_START
      const nextSteps = getTutorialSteps(nextId)
      setTutorialId(nextId)
      setStepIndex(0)
      setOpen(true)
      setReady(false)
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

  useEffect(() => {
    if (!user || open) return
    if (!user.username) return
    if (hasCompletedTutorial(user, TUTORIAL_IDS.QUICK_START)) return
    const t = window.setTimeout(() => start(TUTORIAL_IDS.QUICK_START), 600)
    return () => window.clearTimeout(t)
  }, [user?.id, user?._id, user?.username, user?.settings?.tutorialCompleted, open, start])

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
    if (!open) return
    alignStep()
    return () => {
      alignGen.current += 1
    }
  }, [open, stepIndex, tutorialId, alignStep])

  // Keep spotlit when scrolling/resizing
  useEffect(() => {
    if (!open || !ready) return
    const onRelayout = () => applyMeasure()
    window.addEventListener('resize', onRelayout)
    window.addEventListener('scroll', onRelayout, true)
    const ro = typeof ResizeObserver !== 'undefined' && cardRef.current
      ? new ResizeObserver(() => applyMeasure())
      : null
    if (ro && cardRef.current) ro.observe(cardRef.current)
    return () => {
      window.removeEventListener('resize', onRelayout)
      window.removeEventListener('scroll', onRelayout, true)
      ro?.disconnect()
    }
  }, [open, ready, applyMeasure, stepIndex])

  const finish = useCallback(async () => {
    if (completingRef.current) return
    completingRef.current = true
    setOpen(false)
    setReady(false)
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
    else {
      setReady(false)
      setStepIndex((i) => Math.min(i + 1, steps.length - 1))
    }
  }

  const prev = () => {
    if (!isFirst) {
      setReady(false)
      setStepIndex((i) => Math.max(i - 1, 0))
    }
  }

  useEffect(() => {
    if (!open) delete document.body.dataset.qyntraTutorial
  }, [open])

  if (!open || !step) return null

  const cardInlineStyle = {
    top: cardStyle.top,
    left: cardStyle.left,
    maxWidth: cardStyle.maxWidth,
    width: cardStyle.width || undefined,
    maxHeight: cardStyle.maxHeight,
    transform: cardStyle.transform || 'none'
  }

  const overlay = (
    <AnimatePresence>
      <motion.div
        key={`app-tutorial-${tutorialId}`}
        className="fixed inset-0 z-[140] pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-tutorial-title"
      >
        <div className="absolute inset-0 z-0" aria-hidden />

        <div className="absolute inset-0 z-[1] pointer-events-none" aria-hidden>
          {rect ? (
            <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <mask id={`qyntra-tour-mask-${tutorialId}-${step.id}`}>
                  <rect width="100%" height="100%" fill="white" />
                  <rect
                    x={rect.left}
                    y={rect.top}
                    width={rect.width}
                    height={rect.height}
                    rx="14"
                    ry="14"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.72)"
                mask={`url(#qyntra-tour-mask-${tutorialId}-${step.id})`}
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
          key={`${tutorialId}-${step.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: ready ? 1 : 0.85, y: 0 }}
          className="absolute z-[3] flex flex-col overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] p-4 shadow-2xl sm:p-5"
          style={cardInlineStyle}
        >
          <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-primary)]">
                {meta.title} · {stepIndex + 1}/{steps.length}
              </p>
              <h2
                id="app-tutorial-title"
                className="mt-1 font-display text-lg tracking-wide text-[color:var(--text-primary)] sm:text-xl"
              >
                {step.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={finish}
              className="shrink-0 rounded-lg p-1.5 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
              aria-label="Saltar tutorial"
            >
              <FiX size={18} />
            </button>
          </div>
          <p className="min-h-0 flex-1 overflow-y-auto text-sm leading-relaxed text-[color:var(--text-secondary)] whitespace-pre-wrap break-words">
            {step.body}
          </p>
          <div className="mt-4 flex shrink-0 items-center justify-between gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] disabled:opacity-30"
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
