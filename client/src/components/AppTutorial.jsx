import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { userIdOf, writeLocalCompletion } from '../tutorials/completion'
import TutorialDemoSurface from './TutorialDemoSurface'
import { canStartTutorials, subscribeAppGate } from '../utils/appGate'

export const TUTORIAL_STORAGE_KEY = 'qyntra_tutorial_done'
export const TUTORIAL_START_EVENT = 'qyntra:start-tutorial'
export const TUTORIAL_HUB_EVENT = 'qyntra:open-tutorial-hub'
export const TUTORIAL_CLOSED_EVENT = 'qyntra:tutorial-closed'

export function openAppTutorial(tutorialId = TUTORIAL_IDS.QUICK_START) {
  window.dispatchEvent(
    new CustomEvent(TUTORIAL_START_EVENT, { detail: { tutorialId } })
  )
}

export function openTutorialHub(options = {}) {
  window.dispatchEvent(new CustomEvent(TUTORIAL_HUB_EVENT, { detail: options || {} }))
}

function setAvatarMenuOpen(open) {
  window.dispatchEvent(new CustomEvent('qyntra:avatar-menu', { detail: { open: Boolean(open) } }))
}

const SPOTLIGHT_PAD = 6
const CARD_GAP = 12
const EDGE = 12
const HEADER_SAFE = 64
const BOTTOM_SAFE_MOBILE = 88
const MAX_WAIT = 40

function parseTourPath(path) {
  if (!path) return { pathname: '/', search: '' }
  const q = path.indexOf('?')
  const rawPath = q >= 0 ? path.slice(0, q) : path
  const rawSearch = q >= 0 ? path.slice(q + 1) : ''
  return {
    pathname: (rawPath || '/').replace(/\/+$/, '') || '/',
    search: rawSearch
  }
}

function pathMatches(currentPathname, expected, currentSearch = '') {
  if (!expected) return true
  const exp = parseTourPath(expected)
  const a = (currentPathname || '').replace(/\/+$/, '') || '/'
  if (a !== exp.pathname) return false
  if (!exp.search) return true
  const want = new URLSearchParams(exp.search)
  const have = new URLSearchParams((currentSearch || '').replace(/^\?/, ''))
  for (const [key, value] of want.entries()) {
    if (have.get(key) !== value) return false
  }
  return true
}

function isUsableTourEl(el) {
  if (!el || typeof window === 'undefined') return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  // Allow framer-motion mid-animation (opacity < 1) so menu items still highlight
  if (Number(style.opacity) < 0.05) return false
  const r = el.getBoundingClientRect()
  return r.width >= 2 && r.height >= 2
}

/** Prefer visible element; ignore zero-size / display:none duplicates. */
function findTourElement(tourId) {
  if (!tourId || typeof document === 'undefined') return null
  const nodes = Array.from(document.querySelectorAll(`[data-tour="${tourId}"]`))
  if (!nodes.length) return null

  const vh = window.innerHeight
  const vw = window.innerWidth

  const scored = nodes
    .filter(isUsableTourEl)
    .map((el) => {
      const r = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      const hiddenParent = style.display === 'none'
      const inView =
        r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
      const area = r.width * r.height
      // Prefer in-view, then smaller precise targets over giant wrappers
      const score = (inView ? 1000000 : 0) + (hiddenParent ? -500000 : 0) - Math.min(area, 400000) * 0.0001
      return { el, r, score, inView }
    })
    .sort((a, b) => b.score - a.score)

  return scored[0]?.el || nodes.find(isUsableTourEl) || null
}

function getTargetRect(tourId) {
  const el = findTourElement(tourId)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return null

  // Use the intersection of the element with the visible viewport (fixes "highlight below")
  const topClamp = Math.max(r.top, 4)
  const bottomClamp = Math.min(r.bottom, window.innerHeight - 4)
  const leftClamp = Math.max(r.left, 4)
  const rightClamp = Math.min(r.right, window.innerWidth - 4)
  let top = topClamp
  let left = leftClamp
  let width = Math.max(2, rightClamp - leftClamp)
  let height = Math.max(2, bottomClamp - topClamp)

  // If element is mostly off-screen, use raw rect (caller should scroll first)
  if (height < 8 || width < 8) {
    top = r.top
    left = r.left
    width = r.width
    height = Math.min(r.height, window.innerHeight * 0.5)
  }

  // Cap extremely tall targets around their visible center band
  const maxH = window.innerHeight * 0.48
  if (height > maxH) {
    const mid = top + height / 2
    top = mid - maxH / 2
    height = maxH
  }

  return {
    el,
    top: top - SPOTLIGHT_PAD,
    left: left - SPOTLIGHT_PAD,
    width: width + SPOTLIGHT_PAD * 2,
    height: height + SPOTLIGHT_PAD * 2,
    bottom: top + height + SPOTLIGHT_PAD,
    right: left + width + SPOTLIGHT_PAD,
    midX: left + width / 2,
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

function safeBands() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const narrow = vw < 768
  return {
    vw,
    vh,
    narrow,
    top: HEADER_SAFE,
    bottom: narrow ? BOTTOM_SAFE_MOBILE : EDGE + 12,
    left: EDGE,
    right: EDGE
  }
}

/**
 * Place tip card NEXT to the spotlight (below → above → side). Never clips message.
 * For avatar-menu steps, always place BELOW the full dropdown so the tip is never tucked under it.
 */
function placeCardNear(rect, cardH = 200, cardW = 340, opts = {}) {
  const { vw, vh, top: safeTop, bottom: safeBottom, left: safeLeft, right: safeRight } = safeBands()
  const maxW = Math.min(cardW, vw - safeLeft - safeRight)
  const usableBottom = vh - safeBottom
  const maxCardH = Math.max(160, usableBottom - safeTop - 8)
  const h = Math.min(Math.max(cardH, 160), maxCardH)
  const clampLeft = (x) => Math.min(Math.max(safeLeft, x), vw - maxW - safeRight)

  if (opts.belowAvatarMenu) {
    const menuEl = findTourElement('tour-avatar-menu-panel')
    const mr = menuEl?.getBoundingClientRect()
    if (mr && mr.height > 8) {
      let top = mr.bottom + CARD_GAP
      if (top + h > usableBottom) {
        // Not enough room under menu: dock near bottom of safe area (still above bottom nav)
        top = Math.max(safeTop, usableBottom - h)
      }
      // If tip would still cover the menu, push it just under
      if (top < mr.bottom + 8) top = Math.min(mr.bottom + CARD_GAP, usableBottom - h)
      return {
        top,
        left: clampLeft(opts.preferMidX != null ? opts.preferMidX - maxW / 2 : mr.left),
        width: maxW,
        maxWidth: maxW,
        maxHeight: maxCardH,
        arrow: { side: 'top', x: Math.min(maxW - 24, Math.max(24, (rect?.midX || mr.left + mr.width / 2) - clampLeft(opts.preferMidX != null ? opts.preferMidX - maxW / 2 : mr.left))) }
      }
    }
  }

  if (!rect) {
    return {
      top: Math.max(safeTop, (vh - h) / 2),
      left: (vw - maxW) / 2,
      width: maxW,
      maxWidth: maxW,
      maxHeight: maxCardH,
      arrow: null
    }
  }

  const fits = (top, left) =>
    top >= safeTop - 1 &&
    top + h <= usableBottom + 1 &&
    left >= safeLeft - 1 &&
    left + maxW <= vw - safeRight + 1

  // 1) Below target, aligned to target center
  {
    const top = rect.bottom + CARD_GAP
    const left = clampLeft(rect.midX - maxW / 2)
    if (fits(top, left)) {
      return {
        top,
        left,
        width: maxW,
        maxWidth: maxW,
        maxHeight: maxCardH,
        arrow: { side: 'top', x: Math.min(maxW - 24, Math.max(24, rect.midX - left)) }
      }
    }
  }

  // 2) Above target
  {
    const top = rect.top - CARD_GAP - h
    const left = clampLeft(rect.midX - maxW / 2)
    if (fits(top, left)) {
      return {
        top,
        left,
        width: maxW,
        maxWidth: maxW,
        maxHeight: maxCardH,
        arrow: { side: 'bottom', x: Math.min(maxW - 24, Math.max(24, rect.midX - left)) }
      }
    }
  }

  // 3) Side (desktop / wide)
  if (vw >= 640) {
    const top = Math.min(Math.max(safeTop, rect.midY - h / 2), usableBottom - h)
    const rightOf = rect.right + CARD_GAP
    if (fits(top, rightOf) && rightOf + maxW <= vw - safeRight) {
      return {
        top,
        left: rightOf,
        width: maxW,
        maxWidth: maxW,
        maxHeight: maxCardH,
        arrow: { side: 'left', y: Math.min(h - 24, Math.max(24, rect.midY - top)) }
      }
    }
    const leftOf = rect.left - CARD_GAP - maxW
    if (fits(top, leftOf) && leftOf >= safeLeft) {
      return {
        top,
        left: leftOf,
        width: maxW,
        maxWidth: maxW,
        maxHeight: maxCardH,
        arrow: { side: 'right', y: Math.min(h - 24, Math.max(24, rect.midY - top)) }
      }
    }
  }

  // 4) Soft dock closest to target without covering it
  const spaceBelow = usableBottom - rect.bottom
  const spaceAbove = rect.top - safeTop
  if (spaceBelow >= spaceAbove && spaceBelow >= 120) {
    return {
      top: Math.min(rect.bottom + CARD_GAP, usableBottom - h),
      left: clampLeft(rect.midX - maxW / 2),
      width: maxW,
      maxWidth: maxW,
      maxHeight: maxCardH,
      arrow: { side: 'top', x: maxW / 2 }
    }
  }
  if (spaceAbove >= 120) {
    return {
      top: Math.max(safeTop, rect.top - CARD_GAP - h),
      left: clampLeft(rect.midX - maxW / 2),
      width: maxW,
      maxWidth: maxW,
      maxHeight: maxCardH,
      arrow: { side: 'bottom', x: maxW / 2 }
    }
  }

  // Last resort: opposite half of screen from target
  const dockTop = rect.midY > vh * 0.5
  return {
    top: dockTop ? safeTop : usableBottom - h,
    left: safeLeft,
    width: vw - safeLeft - safeRight,
    maxWidth: vw - safeLeft - safeRight,
    maxHeight: maxCardH,
    arrow: null
  }
}

export default function AppTutorial() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, updateUser } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [tutorialId, setTutorialId] = useState(TUTORIAL_IDS.QUICK_START)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [cardStyle, setCardStyle] = useState(() => placeCardNear(null))
  const [useDemo, setUseDemo] = useState(false)
  const [ready, setReady] = useState(false)
  const completingRef = useRef(false)
  const cardRef = useRef(null)
  const alignGen = useRef(0)
  const hadOpenRef = useRef(false)

  const steps = getTutorialSteps(tutorialId)
  const meta = getTutorialMeta(tutorialId)
  const step = steps[stepIndex]
  const isLast = stepIndex >= steps.length - 1
  const isFirst = stepIndex === 0

  const measure = useCallback(() => {
    let next = step?.target ? getTargetRect(step.target) : null
    // Menu steps: prefer the specific item; fall back to panel if item not ready
    if (step?.openAvatarMenu && !next) {
      next = getTargetRect('tour-avatar-menu-panel')
    }
    // Keep previous spotlight if briefly missing — avoids full-screen flash
    if (next) {
      setRect(next)
      const h = cardRef.current?.offsetHeight || 200
      setCardStyle(
        placeCardNear(next, h, 340, {
          belowAvatarMenu: Boolean(step?.openAvatarMenu),
          preferMidX: next.midX
        })
      )
    } else if (!step?.target) {
      setRect(null)
      setCardStyle(placeCardNear(null, cardRef.current?.offsetHeight || 200))
    }
    return next
  }, [step?.target, step?.openAvatarMenu])

  const alignStep = useCallback(async () => {
    const gen = ++alignGen.current
    // Do NOT clear rect / ready — prevents destello between steps
    if (!step) return

    const needsMenu = Boolean(step.openAvatarMenu)
    setAvatarMenuOpen(needsMenu)

    if (step.path && !pathMatches(window.location.pathname, step.path, window.location.search)) {
      navigate(step.path)
    }

    let tries = 0
    while (tries < MAX_WAIT && gen === alignGen.current) {
      const onPath =
        !step.path || pathMatches(window.location.pathname, step.path, window.location.search)
      if (onPath) {
        if (needsMenu) setAvatarMenuOpen(true)

        if (!step.target) {
          if (gen !== alignGen.current) return
          setUseDemo(false)
          setRect(null)
          setCardStyle(placeCardNear(null, cardRef.current?.offsetHeight || 200))
          setReady(true)
          return
        }

        scrollTargetIntoView(step.target)
        // Wait longer when opening avatar menu so items finish animating in
        const settleMs = needsMenu ? 100 : 48
        await new Promise((r) => window.requestAnimationFrame(() => window.setTimeout(r, settleMs)))
        if (gen !== alignGen.current) return

        let found = getTargetRect(step.target)
        if (needsMenu && !found) {
          // Keep trying menu item before falling back to panel
          setAvatarMenuOpen(true)
          await new Promise((r) => window.setTimeout(r, 70))
          if (gen !== alignGen.current) return
          found = getTargetRect(step.target)
        }

        if (found) {
          setUseDemo(false)
          measure()
          setReady(true)
          // One quiet remeasure after layout
          await new Promise((r) => window.requestAnimationFrame(() => window.setTimeout(r, 40)))
          if (gen !== alignGen.current) return
          measure()
          return
        }

        if (step.demo) {
          setUseDemo(true)
          await new Promise((r) => {
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => window.setTimeout(r, 50))
            })
          })
          if (gen !== alignGen.current) return
          measure()
          setReady(true)
          return
        }
      }

      tries += 1
      await new Promise((r) => window.setTimeout(r, 60))
    }

    if (gen === alignGen.current) {
      if (step.demo) setUseDemo(true)
      await new Promise((r) => window.requestAnimationFrame(() => window.setTimeout(r, 40)))
      measure()
      setReady(true)
    }
  }, [step, navigate, measure])

  const start = useCallback(
    (id = TUTORIAL_IDS.QUICK_START, { force = false } = {}) => {
      // Never fight a blocking update prompt
      if (!force && !canStartTutorials()) return
      completingRef.current = false
      const nextId = id || TUTORIAL_IDS.QUICK_START
      const nextSteps = getTutorialSteps(nextId)
      setTutorialId(nextId)
      setStepIndex(0)
      setOpen(true)
      setReady(false)
      setUseDemo(false)
      document.body.dataset.qyntraTutorial = '1'
      setAvatarMenuOpen(false)
      navigate(nextSteps[0]?.path || '/dashboard')
    },
    [navigate]
  )

  useEffect(() => {
    const onStart = (e) => {
      const id = e?.detail?.tutorialId || TUTORIAL_IDS.QUICK_START
      // Hub / manual start: only if gates allow (update must be done)
      if (!canStartTutorials()) return
      start(id, { force: true })
    }
    window.addEventListener(TUTORIAL_START_EVENT, onStart)
    return () => window.removeEventListener(TUTORIAL_START_EVENT, onStart)
  }, [start])

  // If update appears while a tutorial is open, pause it
  useEffect(() => {
    return subscribeAppGate((gate) => {
      if (gate.updateBlocking && open) {
        setOpen(false)
        setReady(false)
        setAvatarMenuOpen(false)
        delete document.body.dataset.qyntraTutorial
      }
    })
  }, [open])

  // Quick-start only after username + update gates clear
  useEffect(() => {
    if (!user || open) return
    if (!user.username) return
    if (!canStartTutorials()) return
    if (hasCompletedTutorial(user, TUTORIAL_IDS.QUICK_START)) return
    const t = window.setTimeout(() => start(TUTORIAL_IDS.QUICK_START, { force: true }), 500)
    return () => window.clearTimeout(t)
  }, [
    user?.id,
    user?._id,
    user?.username,
    user?.settings?.tutorialCompleted,
    open,
    start,
    user
  ])

  // Retry when gates flip to ready
  useEffect(() => {
    return subscribeAppGate((gate) => {
      if (!gate.canStartTutorials) return
      const u = useAuthStore.getState().user
      if (!u?.username || open) return
      if (hasCompletedTutorial(u, TUTORIAL_IDS.QUICK_START)) return
      window.setTimeout(() => start(TUTORIAL_IDS.QUICK_START, { force: true }), 400)
    })
  }, [open, start])

  useEffect(() => {
    if (!user || open) return
    if (!user.username) return
    if (!canStartTutorials()) return
    if (location.pathname !== '/profile') return
    if (hasCompletedTutorial(user, TUTORIAL_IDS.PROFILE_EDIT)) return
    if (!hasCompletedTutorial(user, TUTORIAL_IDS.QUICK_START)) return
    const t = window.setTimeout(() => start(TUTORIAL_IDS.PROFILE_EDIT, { force: true }), 750)
    return () => window.clearTimeout(t)
  }, [user, open, start, location.pathname])

  useEffect(() => {
    if (!open) return undefined
    alignStep()
    return () => {
      alignGen.current += 1
    }
  }, [open, stepIndex, tutorialId, alignStep])

  useLayoutEffect(() => {
    if (!open || !ready) return
    measure()
  }, [open, ready, useDemo, measure, stepIndex])

  useEffect(() => {
    if (!open || !ready) return undefined
    const onRelayout = () => measure()
    window.addEventListener('resize', onRelayout)
    window.addEventListener('scroll', onRelayout, true)
    const ro =
      typeof ResizeObserver !== 'undefined' && cardRef.current
        ? new ResizeObserver(() => measure())
        : null
    if (ro && cardRef.current) ro.observe(cardRef.current)
    return () => {
      window.removeEventListener('resize', onRelayout)
      window.removeEventListener('scroll', onRelayout, true)
      ro?.disconnect()
    }
  }, [open, ready, measure, stepIndex])

  const finish = useCallback(async () => {
    if (completingRef.current) return
    completingRef.current = true
    setOpen(false)
    setReady(false)
    setUseDemo(false)
    setAvatarMenuOpen(false)
    delete document.body.dataset.qyntraTutorial
    const currentMeta = getTutorialMeta(tutorialId)
    const uid = userIdOf(user)
    writeLocalCompletion(currentMeta.completionKey, uid)

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
  }, [tutorialId, updateUser, user])

  const next = () => {
    if (isLast) finish()
    else setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }

  const prev = () => {
    if (!isFirst) setStepIndex((i) => Math.max(i - 1, 0))
  }

  useEffect(() => {
    if (open) {
      hadOpenRef.current = true
      return
    }
    delete document.body.dataset.qyntraTutorial
    if (hadOpenRef.current) {
      hadOpenRef.current = false
      window.dispatchEvent(new CustomEvent(TUTORIAL_CLOSED_EVENT))
    }
  }, [open])

  if (!open || !step) return null

  const arrow = cardStyle.arrow
  const spot = rect

  const overlay = (
    <div
      className="fixed inset-0 z-[200] pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-tutorial-title"
    >
      <div className="absolute inset-0 z-[1] pointer-events-none" aria-hidden>
        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="qyntra-tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {spot && (
                <rect
                  x={spot.left}
                  y={spot.top}
                  width={spot.width}
                  height={spot.height}
                  rx="14"
                  ry="14"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.72)"
            mask="url(#qyntra-tour-mask)"
          />
        </svg>
      </div>

      {spot && (
        <div
          aria-hidden
          className="absolute z-[2] rounded-2xl pointer-events-none"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            outline: '2.5px solid color-mix(in srgb, var(--color-primary, #FF6B35) 90%, white)',
            outlineOffset: 2,
            boxShadow:
              '0 0 0 5px color-mix(in srgb, var(--color-primary, #FF6B35) 26%, transparent)',
            transition: 'top 160ms ease, left 160ms ease, width 160ms ease, height 160ms ease'
          }}
        />
      )}

      {useDemo && step.demo && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(5.5rem,12vh)] z-[2] flex justify-center px-4">
          <TutorialDemoSurface demoId={step.demo} />
        </div>
      )}

      <div
        ref={cardRef}
        className="absolute z-[3] flex flex-col overflow-visible rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
        style={{
          top: cardStyle.top,
          left: cardStyle.left,
          width: cardStyle.width,
          maxWidth: cardStyle.maxWidth,
          maxHeight: cardStyle.maxHeight,
          transition: 'top 160ms ease, left 160ms ease, width 160ms ease'
        }}
      >
        {arrow?.side === 'top' && (
          <span
            className="absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]"
            style={{ left: arrow.x - 8 }}
          />
        )}
        {arrow?.side === 'bottom' && (
          <span
            className="absolute -bottom-2 h-4 w-4 rotate-45 border-b border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]"
            style={{ left: arrow.x - 8 }}
          />
        )}
        {arrow?.side === 'left' && (
          <span
            className="absolute -left-2 h-4 w-4 rotate-45 border-b border-l border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]"
            style={{ top: arrow.y - 8 }}
          />
        )}
        {arrow?.side === 'right' && (
          <span
            className="absolute -right-2 h-4 w-4 rotate-45 border-r border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]"
            style={{ top: arrow.y - 8 }}
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-4 sm:p-5">
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
              aria-label="Omitir tutorial"
              title="Omitir"
            >
              <FiX size={18} />
            </button>
          </div>
          <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-[color:var(--text-secondary)]">
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
            <div className="flex items-center gap-2">
              {!isLast && (
                <button
                  type="button"
                  onClick={finish}
                  className="rounded-xl px-3 py-2 text-xs font-medium text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
                >
                  Omitir
                </button>
              )}
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
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
