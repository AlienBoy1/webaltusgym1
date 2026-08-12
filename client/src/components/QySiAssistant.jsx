import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
  FiZap,
  FiBookOpen,
  FiRefreshCw,
  FiClock,
  FiTarget,
  FiStar
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { useAuthStore } from '../store/authStore'
import { useHistoryBackLayer } from '../hooks/useHistoryBackLayer'
import { QISI_VARIANTS, findQiSiCatalogItem, getQiSiLevelGuide } from '../data/qisiCatalog'
import {
  QISI_HANDLE,
  QISI_MEANING,
  QISI_NAME,
  QISI_SOURCE_KIND,
  QISI_TAGLINE,
  QISI_USERNAME
} from '../utils/qisi.js'
import { readLocalCompletion, writeLocalCompletion, userIdOf } from '../tutorials/completion'
import QySiAvatar from './QySiAvatar'

const COMPLETION_KEY = 'qyntra_tutorial_qysi_done'
const SETTINGS_KEY = 'tutorialQysiCompleted'
const WORKOUT_TEMPLATES_KEY = 'qyntra:workout_templates'
export const QYSI_ASSISTANT_OPEN_EVENT = 'qyntra:open-qysi-assistant'
const OPEN_FLAG_KEY = 'qyntra:openQySiAssistant'
const HINTS_KEY = 'qyntra:qysiHints'

/** Navigate-friendly opener: set flag + emit event (Workouts mounts the panel). */
export function openQySiAssistant(hints = null) {
  try {
    sessionStorage.setItem(OPEN_FLAG_KEY, '1')
    if (hints) sessionStorage.setItem(HINTS_KEY, JSON.stringify(hints))
    else sessionStorage.removeItem(HINTS_KEY)
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(QYSI_ASSISTANT_OPEN_EVENT, { detail: hints || null }))
  } catch {
    /* ignore */
  }
}

function readStoredHints() {
  try {
    const raw = sessionStorage.getItem(HINTS_KEY)
    if (!raw) return null
    sessionStorage.removeItem(HINTS_KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const TUTORIAL_BEATS = [
  {
    id: 'who',
    kicker: 'Tu trainer inteligente',
    title: `Soy ${QISI_NAME}`,
    body: `${QISI_MEANING}. @${QISI_HANDLE}. Te guío sin ruido: eliges contexto, nivel y entrenas.`
  },
  {
    id: 'path',
    kicker: 'Ruta estratégica',
    title: '3 pasos. Listo.',
    body: '1) Dónde entrenas · 2) Qué enfoque · 3) Tu nivel. Adopta y aparece en Entrenamientos con mi etiqueta.'
  },
  {
    id: 'rules',
    kicker: 'Importante',
    title: 'Privadas por diseño',
    body: 'Mis rutinas no se publican en Explorar: me pertenecen. Tú las entrenas, las editas y las compartes como sesión completada.'
  }
]

function hasCompletedQySiTutorial(user) {
  const uid = userIdOf(user)
  if (user?.settings?.[SETTINGS_KEY] === true) return true
  if (user?.settings?.tutorialQisiCompleted === true) return true
  if (readLocalCompletion(COMPLETION_KEY, uid)) return true
  return readLocalCompletion('qyntra_tutorial_qisi_done', uid)
}

function persistQySiTutorial(user, updateUser) {
  const uid = userIdOf(user)
  writeLocalCompletion(COMPLETION_KEY, uid)
  const nextSettings = { ...(user?.settings || {}), [SETTINGS_KEY]: true }
  updateUser?.({ settings: nextSettings })
  api.put('/users/profile', { settings: { [SETTINGS_KEY]: true } }).catch(() => {})
}

function persistAdoptedLocal(local) {
  try {
    const stored = JSON.parse(localStorage.getItem(WORKOUT_TEMPLATES_KEY) || '[]')
    const list = Array.isArray(stored) ? stored : []
    const sourceId = local?.sourceRoutineId
    const next = sourceId
      ? list.filter((t) => String(t?.sourceRoutineId || '') !== String(sourceId))
      : list
    localStorage.setItem(WORKOUT_TEMPLATES_KEY, JSON.stringify([...next, local]))
  } catch {
    /* ignore */
  }
}

function suggestLevelId(templates = []) {
  const count = Array.isArray(templates) ? templates.length : 0
  if (count >= 8) return 'advanced'
  if (count >= 3) return 'intermediate'
  return 'beginner'
}

function LevelPill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-primary-500 bg-primary-500/15 text-primary-500'
          : 'border-app bg-[color:var(--bg-muted)] text-app-secondary hover:text-app'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Floating QySi assistant — premium guided flow for Entrenamientos.
 */
export default function QySiAssistant({ onAdopted, templates = [] }) {
  const { user, updateUser } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  // home | tutorial | path (variant+program+level together) | confirm
  const [phase, setPhase] = useState('home')
  const [tutorialStep, setTutorialStep] = useState(0)
  const [tutorialForced, setTutorialForced] = useState(false)
  const [variantId, setVariantId] = useState(null)
  const [programId, setProgramId] = useState(null)
  const [levelId, setLevelId] = useState(null)
  const [adopting, setAdopting] = useState(false)
  /** Brief theme-colored glow on first paint of Entrenamientos (non-blocking). */
  const [attracting, setAttracting] = useState(true)
  const [bodyHints, setBodyHints] = useState(null)

  const suggestedLevel = useMemo(() => {
    const fromBody = bodyHints?.suggestedLevelId
    if (fromBody === 'beginner' || fromBody === 'intermediate' || fromBody === 'advanced') {
      return fromBody
    }
    return suggestLevelId(templates)
  }, [templates, bodyHints])
  const levelGuide = useMemo(() => getQiSiLevelGuide(), [])

  const variant = QISI_VARIANTS.find((v) => v.id === variantId) || null
  const program = variant?.programs?.find((p) => p.id === programId) || null
  const level = program?.levels?.find((l) => l.id === levelId) || null
  const catalogId =
    variant && program && level ? `${variant.id}-${program.id}-${level.id}` : null
  const catalogItem = catalogId ? findQiSiCatalogItem(catalogId) : null
  const userHasRoutines = (templates || []).length > 0

  useEffect(() => {
    if (!attracting) return undefined
    const t = window.setTimeout(() => setAttracting(false), 4800)
    return () => window.clearTimeout(t)
  }, [attracting])

  useEffect(() => {
    if (open) setAttracting(false)
  }, [open])

  // Auto-advance tutorial beats for premium cadence
  useEffect(() => {
    if (!open || phase !== 'tutorial') return undefined
    if (tutorialStep >= TUTORIAL_BEATS.length - 1) return undefined
    const t = window.setTimeout(() => setTutorialStep((s) => s + 1), 3200)
    return () => window.clearTimeout(t)
  }, [open, phase, tutorialStep])

  // Keep path selection coherent when variant changes
  useEffect(() => {
    if (!variant) return
    if (!variant.programs.some((p) => p.id === programId)) {
      setProgramId(variant.programs[0]?.id || null)
    }
  }, [variantId, variant, programId])

  useEffect(() => {
    if (!program) return
    if (!program.levels.some((l) => l.id === levelId)) {
      setLevelId(suggestedLevel)
    }
  }, [programId, program, levelId, suggestedLevel])

  const closePanel = () => {
    if (tutorialForced && !hasCompletedQySiTutorial(user)) {
      toast('Termina el breve recorrido de QySi para continuar', { icon: '✨' })
      return
    }
    setOpen(false)
  }

  const requestClose = useHistoryBackLayer(open, closePanel, 'qysi-assistant')

  const resetPath = () => {
    setVariantId(null)
    setProgramId(null)
    setLevelId(suggestedLevel)
  }

  const openAssistant = useCallback(
    (hints = null) => {
      const applied = hints || readStoredHints()
      if (applied) setBodyHints(applied)

      const u = useAuthStore.getState().user
      const done = hasCompletedQySiTutorial(u)
      setOpen(true)
      if (!done) {
        setTutorialForced(true)
        setTutorialStep(0)
        setPhase('tutorial')
      } else {
        setTutorialForced(false)
        setPhase(applied?.preferredVariants?.length ? 'path' : 'home')
        const preferred = applied?.preferredVariants?.[0]
        if (preferred && QISI_VARIANTS.some((v) => v.id === preferred)) {
          setVariantId(preferred)
          const variant = QISI_VARIANTS.find((v) => v.id === preferred)
          const progId =
            applied?.preferredProgramId &&
            variant?.programs?.some((p) => p.id === applied.preferredProgramId)
              ? applied.preferredProgramId
              : variant?.programs?.[0]?.id || null
          setProgramId(progId)
          const lvl = applied?.suggestedLevelId || suggestLevelId(templates)
          setLevelId(lvl)
        } else {
          setVariantId(null)
          setProgramId(null)
          setLevelId(applied?.suggestedLevelId || suggestLevelId(templates))
        }
      }
    },
    [templates]
  )

  const openAssistantRef = useRef(openAssistant)
  openAssistantRef.current = openAssistant

  useEffect(() => {
    const onExternalOpen = (ev) => openAssistantRef.current(ev?.detail || null)
    window.addEventListener(QYSI_ASSISTANT_OPEN_EVENT, onExternalOpen)
    return () => window.removeEventListener(QYSI_ASSISTANT_OPEN_EVENT, onExternalOpen)
  }, [])

  // Deep-link from profile / Progress ("Entrenar con QySi") — runs once on mount of Entrenamientos
  useEffect(() => {
    const q = searchParams.get('qysi')
    const fromQuery = q === '1' || q === 'open' || q === 'true'
    let fromFlag = false
    try {
      fromFlag = sessionStorage.getItem(OPEN_FLAG_KEY) === '1'
      if (fromFlag) sessionStorage.removeItem(OPEN_FLAG_KEY)
    } catch {
      /* ignore */
    }
    if (!fromQuery && !fromFlag) return undefined

    if (fromQuery) {
      const next = new URLSearchParams(searchParams)
      next.delete('qysi')
      setSearchParams(next, { replace: true })
    }

    const hints = readStoredHints()
    const t = window.setTimeout(() => openAssistantRef.current(hints), 280)
    return () => window.clearTimeout(t)
    // Intentionally once on mount when arriving from profile CTA
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finishTutorial = () => {
    persistQySiTutorial(user, updateUser)
    setTutorialForced(false)
    setPhase('path')
    resetPath()
    toast.success('Listo. Elige tu entrenamiento')
  }

  const replayTutorial = () => {
    setTutorialForced(false)
    setTutorialStep(0)
    setPhase('tutorial')
  }

  const startSmartPath = () => {
    const first = QISI_VARIANTS[0]
    setVariantId(first.id)
    setProgramId(first.programs[0]?.id || null)
    setLevelId(suggestedLevel)
    setPhase('path')
  }

  const adoptCurrent = async () => {
    if (!catalogId || !catalogItem) return
    setAdopting(true)
    try {
      const { data } = await api.post(`/qisi/adopt/${catalogId}`)
      const local = {
        id: data.localId || data.local_id || `wk-qisi-${catalogId}`,
        serverId: data.id || data._id,
        name: data.name || catalogItem.name,
        color: data.color || catalogItem.color || 'primary',
        days: Array.isArray(data.days) ? data.days : [],
        exercises: data.exercises || catalogItem.exercises,
        isPublic: false,
        isQiSi: true,
        sourceKind: QISI_SOURCE_KIND,
        sourceRoutineId: data.sourceRoutineId || data.source_routine_id || null,
        originalCreatorId: data.originalCreatorId || null,
        originalCreator: data.originalCreator || {
          name: QISI_NAME,
          username: QISI_USERNAME,
          isQiSi: true
        },
        adoptCount: 0,
        isEditedFork: false
      }
      persistAdoptedLocal(local)
      onAdopted?.(local)
      toast.success('Rutina de QySi adoptada')
      setPhase('home')
      resetPath()
      setOpen(false)
    } catch (error) {
      const status = error?.response?.status
      const message = error?.response?.data?.message
      if (status === 409) {
        toast.error(message || 'Ya adoptaste esta rutina de QySi')
      } else if (!error?.response) {
        const local = {
          id: `wk-qisi-${catalogId}-${Date.now().toString(36)}`,
          name: catalogItem.name,
          color: catalogItem.color || 'primary',
          days: [],
          exercises: catalogItem.exercises,
          isPublic: false,
          isQiSi: true,
          sourceKind: QISI_SOURCE_KIND,
          sourceRoutineId: `local-${catalogId}`,
          originalCreator: { name: QISI_NAME, username: QISI_USERNAME, isQiSi: true }
        }
        persistAdoptedLocal(local)
        onAdopted?.(local)
        toast.success('Rutina guardada localmente')
        setPhase('home')
        setOpen(false)
      } else {
        toast.error(message || 'No se pudo adoptar la rutina')
      }
    } finally {
      setAdopting(false)
    }
  }

  const headerTitle =
    phase === 'tutorial'
      ? 'Conoce a QySi'
      : phase === 'path'
        ? 'Arma tu sesión'
        : phase === 'confirm'
          ? 'Confirmar'
          : QISI_NAME

  const canGoBack =
    phase === 'path' ||
    phase === 'confirm' ||
    (phase === 'tutorial' && !tutorialForced && tutorialStep > 0)

  const goBack = () => {
    if (phase === 'confirm') return setPhase('path')
    if (phase === 'path') return setPhase('home')
    if (phase === 'tutorial' && tutorialStep > 0) return setTutorialStep((s) => s - 1)
    if (phase === 'tutorial' && !tutorialForced) return setPhase('home')
  }

  const tipForLevel = levelGuide.find((g) => g.id === (levelId || suggestedLevel))?.tip

  const fab = (
    <motion.button
      type="button"
      data-tour="tour-qysi-fab"
      data-no-swipe
      aria-label={`Abrir ${QISI_NAME}`}
      onClick={openAssistant}
      className="pointer-events-auto fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-[60] flex items-center gap-2 rounded-full border border-[rgba(var(--color-primary-rgb),0.35)] bg-elevated/95 py-2 pl-2 pr-3.5 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl md:bottom-8 md:right-6"
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
    >
      <span className="relative flex items-center gap-2">
        {attracting && (
          <>
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-[-10px] -z-10 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(var(--color-primary-rgb),0.55) 0%, rgba(var(--color-primary-rgb),0) 70%)'
              }}
              animate={{ opacity: [0.25, 0.95, 0.25], scale: [0.92, 1.18, 0.92] }}
              transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 rounded-full"
              style={{
                boxShadow:
                  '0 0 0 2px rgba(var(--color-primary-rgb),0.55), 0 0 28px 4px rgba(var(--color-primary-rgb),0.45)'
              }}
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}
        <QySiAvatar size={48} pulse={attracting} attract={attracting} />
        <div className="hidden min-w-0 text-left sm:block">
          <p className="text-xs font-bold text-app">{QISI_NAME}</p>
          <p className="truncate text-[10px] text-app-secondary">@{QISI_HANDLE}</p>
        </div>
      </span>
    </motion.button>
  )

  return (
    <>
      {typeof document !== 'undefined' ? createPortal(fab, document.body) : fab}

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.button
                type="button"
                aria-label="Cerrar"
                className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
                onClick={() => (tutorialForced ? null : requestClose())}
              />

              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={QISI_NAME}
                initial={{ opacity: 0, y: 40, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 28, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="relative flex h-[min(92dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-app bg-[color:var(--bg-elevated)] shadow-2xl sm:h-[min(88dvh,780px)] sm:rounded-[1.75rem]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(var(--color-primary-rgb),0.16),transparent_55%)]" />
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.35]"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(var(--color-primary-rgb),0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--color-primary-rgb),0.06)_1px,transparent_1px)',
                    backgroundSize: '28px 28px',
                    maskImage: 'linear-gradient(to bottom, black, transparent 70%)'
                  }}
                />

                <header className="relative z-10 flex items-center gap-2 border-b border-app px-3 py-3 sm:px-4">
                  {canGoBack ? (
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-app bg-[color:var(--bg-muted)] text-app"
                    >
                      <FiChevronLeft size={18} />
                    </button>
                  ) : (
                    <div className="h-9 w-9" />
                  )}
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <QySiAvatar size={40} ring={false} />
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg leading-tight text-app">
                        {headerTitle}
                      </p>
                      <p className="truncate text-[11px] text-app-secondary">
                        @{QISI_HANDLE} · {QISI_TAGLINE}
                      </p>
                    </div>
                  </div>
                  {!tutorialForced && (
                    <button
                      type="button"
                      onClick={requestClose}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-app bg-[color:var(--bg-muted)] text-app"
                    >
                      <FiX size={16} />
                    </button>
                  )}
                </header>

                <div className="relative z-10 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
                  <AnimatePresence mode="wait">
                    {phase === 'home' && (
                      <motion.div
                        key="home"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="overflow-hidden rounded-[1.5rem] border border-app bg-gradient-to-br from-primary-500/15 via-[color:var(--bg-muted)] to-transparent p-4">
                          <div className="flex items-start gap-3">
                            <QySiAvatar size={56} pulse />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-500">
                                De vuelta
                              </p>
                              <p className="mt-1 font-display text-2xl text-app">
                                ¡Qué gusto tenerte!
                              </p>
                              <p className="mt-1 text-sm text-app-secondary">
                                {userHasRoutines
                                  ? 'Ya tienes rutinas. ¿Sumamos una de QySi a tu plan?'
                                  : 'Empecemos con una sesión clara, a tu nivel.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={startSmartPath}
                          className="btn-primary flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                        >
                          <span className="inline-flex items-center gap-2 font-semibold">
                            <FiStar size={18} /> Ruta rápida
                          </span>
                          <FiChevronRight />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            resetPath()
                            setPhase('path')
                          }}
                          className="btn-secondary flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                        >
                          <span className="inline-flex items-center gap-2 font-semibold">
                            <FiZap size={18} /> Elegir variante
                          </span>
                          <FiChevronRight />
                        </button>

                        <button
                          type="button"
                          onClick={replayTutorial}
                          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-app px-4 py-3 text-left text-sm text-app-secondary transition hover:border-primary-500/40 hover:text-app"
                        >
                          <span className="inline-flex items-center gap-2 font-medium">
                            <FiBookOpen size={16} /> Volver a ver tutorial
                          </span>
                          <FiRefreshCw size={14} />
                        </button>
                      </motion.div>
                    )}

                    {phase === 'tutorial' && (
                      <motion.div
                        key={`tut-${tutorialStep}`}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="flex h-full flex-col"
                      >
                        <div className="mb-5 flex gap-1.5">
                          {TUTORIAL_BEATS.map((b, i) => (
                            <motion.div
                              key={b.id}
                              className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--bg-muted)]"
                            >
                              <motion.div
                                className="h-full rounded-full bg-primary-500"
                                initial={{ width: '0%' }}
                                animate={{
                                  width: i < tutorialStep ? '100%' : i === tutorialStep ? '100%' : '0%'
                                }}
                                transition={{ duration: i === tutorialStep ? 3 : 0.35 }}
                              />
                            </motion.div>
                          ))}
                        </div>

                        <div className="flex flex-1 flex-col items-center justify-center pb-4 text-center">
                          <QySiAvatar size={100} pulse float />
                          <motion.p
                            className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary-500"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            {TUTORIAL_BEATS[tutorialStep].kicker}
                          </motion.p>
                          <motion.h3
                            className="mt-2 font-display text-3xl text-app sm:text-4xl"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 }}
                          >
                            {TUTORIAL_BEATS[tutorialStep].title}
                          </motion.h3>
                          <motion.p
                            className="mt-3 max-w-md text-sm leading-relaxed text-app-secondary sm:text-base"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.14 }}
                          >
                            {TUTORIAL_BEATS[tutorialStep].body}
                          </motion.p>
                        </div>

                        <div className="flex gap-2">
                          {!tutorialForced && (
                            <button
                              type="button"
                              onClick={() => setPhase('home')}
                              className="btn-secondary flex-1 py-3"
                            >
                              Omitir
                            </button>
                          )}
                          {tutorialStep < TUTORIAL_BEATS.length - 1 ? (
                            <button
                              type="button"
                              onClick={() => setTutorialStep((s) => s + 1)}
                              className="btn-primary flex flex-[2] items-center justify-center gap-2 py-3"
                            >
                              Siguiente <FiChevronRight />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={finishTutorial}
                              className="btn-primary flex flex-[2] items-center justify-center gap-2 py-3"
                            >
                              <FiCheck /> Empezar a entrenar
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {phase === 'path' && (
                      <motion.div
                        key="path"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-5"
                      >
                        <section>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-app-secondary">
                              1 · Contexto
                            </p>
                            <span className="text-[11px] text-app-secondary">Elige dónde entrenas</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {QISI_VARIANTS.map((v, i) => {
                              const active = v.id === variantId
                              return (
                                <motion.button
                                  key={v.id}
                                  type="button"
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.03 }}
                                  onClick={() => {
                                    setVariantId(v.id)
                                    setProgramId(v.programs[0]?.id || null)
                                    setLevelId(suggestedLevel)
                                  }}
                                  className={`rounded-2xl border p-3 text-left transition ${
                                    active
                                      ? 'border-primary-500/50 bg-primary-500/12 shadow-[0_0_0_1px_rgba(var(--color-primary-rgb),0.12)]'
                                      : 'border-app bg-[color:var(--bg-muted)]/70 hover:border-primary-500/30'
                                  }`}
                                >
                                  <span className="text-lg">{v.emoji}</span>
                                  <span className="mt-1 block text-sm font-semibold text-app">
                                    {v.shortName}
                                  </span>
                                </motion.button>
                              )
                            })}
                          </div>
                        </section>

                        <AnimatePresence>
                          {variant && (
                            <motion.section
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-4 overflow-hidden"
                            >
                              <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-app-secondary">
                                  2 · Enfoque
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {variant.programs.map((p) => (
                                    <LevelPill
                                      key={p.id}
                                      active={p.id === programId}
                                      onClick={() => setProgramId(p.id)}
                                    >
                                      {p.name}
                                    </LevelPill>
                                  ))}
                                </div>
                                {program?.subtitle && (
                                  <p className="mt-2 text-xs text-app-secondary">{program.subtitle}</p>
                                )}
                              </div>

                              <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-app-secondary">
                                  3 · Nivel
                                </p>
                                <div className="grid grid-cols-1 gap-2">
                                  {(program?.levels || []).map((l) => {
                                    const active = l.id === levelId
                                    return (
                                      <button
                                        key={l.id}
                                        type="button"
                                        onClick={() => setLevelId(l.id)}
                                        className={`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                                          active
                                            ? 'border-primary-500/50 bg-primary-500/12'
                                            : 'border-app bg-elevated hover:border-primary-500/30'
                                        }`}
                                      >
                                        <span>
                                          <span className="block font-semibold text-app">{l.name}</span>
                                          <span className="mt-0.5 inline-flex items-center gap-2 text-[11px] text-app-secondary">
                                            <FiClock size={11} /> {l.durationMin} min
                                            <FiTarget size={11} /> {l.exercises.length} ej.
                                          </span>
                                        </span>
                                        {active && (
                                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-black">
                                            <FiCheck size={14} />
                                          </span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                                {tipForLevel && (
                                  <p className="mt-2 text-xs leading-relaxed text-app-secondary">
                                    {tipForLevel}
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={!catalogItem}
                                onClick={() => setPhase('confirm')}
                                className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 disabled:opacity-50"
                              >
                                Revisar y adoptar <FiChevronRight />
                              </button>
                            </motion.section>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}

                    {phase === 'confirm' && catalogItem && (
                      <motion.div
                        key="confirm"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="rounded-[1.5rem] border border-primary-500/30 bg-gradient-to-br from-primary-500/15 to-transparent p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-500">
                            Rutina QySi · @{QISI_HANDLE}
                          </p>
                          <h3 className="mt-1.5 font-display text-2xl text-app">{catalogItem.name}</h3>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-app-secondary">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--bg-muted)] px-2.5 py-1">
                              <FiClock size={12} /> {catalogItem.durationMin} min
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--bg-muted)] px-2.5 py-1">
                              <FiTarget size={12} /> {catalogItem.levelName}
                            </span>
                          </div>
                          {catalogItem.restNote && (
                            <p className="mt-2 text-xs text-app-secondary">{catalogItem.restNote}</p>
                          )}
                        </div>

                        <ul className="space-y-2">
                          {catalogItem.exercises.map((ex, i) => (
                            <motion.li
                              key={ex.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.04 }}
                              className="flex items-center gap-3 rounded-2xl border border-app bg-elevated px-3.5 py-3"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-xs font-bold text-primary-500">
                                {i + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-app">{ex.name}</span>
                                <span className="text-xs text-app-secondary">
                                  {ex.sets}×{ex.reps}
                                </span>
                              </span>
                            </motion.li>
                          ))}
                        </ul>

                        <button
                          type="button"
                          disabled={adopting}
                          onClick={adoptCurrent}
                          className="btn-primary flex w-full items-center justify-center gap-2 py-3.5"
                        >
                          {adopting ? 'Adoptando…' : 'Adoptar en Entrenamientos'}
                        </button>
                        <p className="text-center text-[11px] text-app-secondary">
                          Quedará etiquetada como adoptada de {QISI_NAME} · {QISI_MEANING}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

export { hasCompletedQySiTutorial, COMPLETION_KEY as QISI_TUTORIAL_COMPLETION_KEY }
