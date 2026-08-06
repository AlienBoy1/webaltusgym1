import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiCheck, FiX } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import api from '../utils/api'

export const TUTORIAL_STORAGE_KEY = 'qyntra_tutorial_done'
export const TUTORIAL_START_EVENT = 'qyntra:start-tutorial'

export function openAppTutorial() {
  window.dispatchEvent(new CustomEvent(TUTORIAL_START_EVENT))
}

function setAvatarMenuOpen(open) {
  window.dispatchEvent(new CustomEvent('qyntra:avatar-menu', { detail: { open: Boolean(open) } }))
}

function hasSeenTutorial(user) {
  try {
    if (localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1') return true
  } catch {
    /* ignore */
  }
  if (user?.settings?.tutorialCompleted === true) return true
  if (user?.tutorialCompleted === true) return true
  return false
}

/**
 * Full tour: bottom nav, header (classes/chat/challenges/notifications),
 * then avatar menu shortcuts (except "Tutorial de la app").
 */
const STEPS = [
  {
    id: 'dashboard',
    path: '/dashboard',
    target: 'nav-dashboard',
    title: 'Tu centro de mando',
    body: 'Aquí empieza cada sesión: resumen de actividad, accesos rápidos y lo esencial para entrenar sin fricción.'
  },
  {
    id: 'social',
    path: '/social',
    target: 'nav-social',
    title: 'Comunidad que empuja',
    body: 'Comparte hitos, reacciona, comenta y mantén la motivación con tu círculo en Qyntra.'
  },
  {
    id: 'workouts',
    path: '/workouts',
    target: 'nav-workouts',
    title: 'Entrenos a tu medida',
    body: 'Rutinas, sesiones y seguimiento de series: construye consistencia con un flujo claro.'
  },
  {
    id: 'progress',
    path: '/progress',
    target: 'nav-progress',
    title: 'Progreso con claridad',
    body: 'Visualiza avances, tendencias y logros. Mide lo que importa y celebra cada mejora.'
  },
  {
    id: 'profile',
    path: '/profile',
    target: 'nav-profile',
    title: 'Tu identidad en Qyntra',
    body: 'Perfil, insignias y presencia: personaliza cómo te ven y muestra tu trayectoria.'
  },
  {
    id: 'classes',
    path: '/classes',
    target: 'nav-classes',
    title: 'Clases del gimnasio',
    body: 'Consulta horarios, reserva cupo y organízate con las clases disponibles desde este acceso rápido.'
  },
  {
    id: 'challenges',
    path: '/challenges',
    target: 'nav-challenges',
    title: 'Retos que marcan ritmo',
    body: 'Compite, supera metas y suma energía. Los retos convierten el hábito en un juego serio.'
  },
  {
    id: 'chat',
    path: '/chat',
    target: 'nav-chat',
    title: 'Chat en un toque',
    body: 'Desde el encabezado abres mensajes con tu comunidad. Conversación rápida, sin salir del flujo.'
  },
  {
    id: 'notifications',
    path: '/notifications',
    target: 'nav-notifications',
    title: 'Nunca te pierdas nada',
    body: 'Avisos de la comunidad, actividad y recordatorios. Mantente al día con un vistazo.'
  },
  {
    id: 'avatar',
    path: '/dashboard',
    target: 'nav-avatar',
    title: 'Menú de tu cuenta',
    body: 'Al tocar tu foto abrés accesos rápidos: perfil, ajustes, invitaciones, tema y cierre de sesión.',
    openAvatarMenu: false
  },
  {
    id: 'menu-profile',
    path: '/dashboard',
    target: 'menu-profile',
    title: 'Ver perfil',
    body: 'Entra a tu perfil completo para editar datos, foto, cover y revisar tu progreso social.',
    openAvatarMenu: true
  },
  {
    id: 'menu-settings',
    path: '/dashboard',
    target: 'menu-settings',
    title: 'Configuración',
    body: 'Privacidad, apariencia, notificaciones y preferencias de la app. Todo centralizado aquí.',
    openAvatarMenu: true
  },
  {
    id: 'menu-invite',
    path: '/dashboard',
    target: 'menu-invite',
    title: 'Invitar a amigos',
    body: 'Comparte Qyntra con tu equipo. Las invitaciones ayudan a crecer tu comunidad de entrenamiento.',
    openAvatarMenu: true
  },
  {
    id: 'menu-theme',
    path: '/dashboard',
    target: 'menu-theme',
    title: 'Tema claro u oscuro',
    body: 'Cambia la apariencia al instante para entrenar cómodo de día o de noche.',
    openAvatarMenu: true
  },
  {
    id: 'menu-logout',
    path: '/dashboard',
    target: 'menu-logout',
    title: 'Cerrar sesión',
    body: 'Sal de tu cuenta con seguridad cuando termines. Podrás volver a entrar cuando quieras.',
    openAvatarMenu: true
  }
]

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

export default function AppTutorial({ forceOpen = false, onForceHandled }) {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [cardStyle, setCardStyle] = useState(() => placeCard(null))
  const completingRef = useRef(false)
  const cardRef = useRef(null)

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1
  const isFirst = stepIndex === 0

  const measure = useCallback(() => {
    const next = getTargetRect(step?.target)
    setRect(next)
    const h = cardRef.current?.offsetHeight || 220
    setCardStyle(placeCard(next, h))
  }, [step?.target])

  const start = useCallback(() => {
    completingRef.current = false
    setStepIndex(0)
    setOpen(true)
    document.body.dataset.qyntraTutorial = '1'
    setAvatarMenuOpen(false)
    navigate('/dashboard')
  }, [navigate])

  useEffect(() => {
    if (!forceOpen) return
    start()
    onForceHandled?.()
  }, [forceOpen, start, onForceHandled])

  useEffect(() => {
    const onStart = () => start()
    window.addEventListener(TUTORIAL_START_EVENT, onStart)
    return () => window.removeEventListener(TUTORIAL_START_EVENT, onStart)
  }, [start])

  // Auto-show for anyone who has not completed the tutorial yet (new or existing accounts)
  useEffect(() => {
    if (!user || open) return
    if (!user.username) return
    if (hasSeenTutorial(user)) return
    const t = window.setTimeout(() => start(), 500)
    return () => window.clearTimeout(t)
  }, [user?.id, user?._id, user?.username, user?.settings?.tutorialCompleted, open, start])

  useEffect(() => {
    if (!open || !step?.path) return
    if (window.location.pathname !== step.path) {
      navigate(step.path)
    }
  }, [open, step?.path, stepIndex, navigate])

  // Open / close avatar dropdown according to step
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
      if (!getTargetRect(step?.target) && tries < 16) {
        window.setTimeout(tick, 60)
      }
    }
    const id = window.requestAnimationFrame(() => {
      window.setTimeout(tick, step?.openAvatarMenu ? 80 : 0)
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
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    try {
      await api.post('/users/complete-onboarding')
    } catch (err) {
      console.warn('complete-onboarding:', err?.message || err)
    }
    try {
      const nextSettings = {
        ...(user?.settings || {}),
        tutorialCompleted: true
      }
      await api.put('/users/profile', { settings: nextSettings })
      updateUser({ onboardingCompleted: true, settings: nextSettings, tutorialCompleted: true })
    } catch {
      updateUser({ onboardingCompleted: true, tutorialCompleted: true })
    }
  }, [updateUser, user?.settings])

  const next = () => {
    if (isLast) finish()
    else setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }

  const prev = () => {
    if (!isFirst) setStepIndex((i) => Math.max(i - 1, 0))
  }

  useEffect(() => {
    if (!open) {
      delete document.body.dataset.qyntraTutorial
    }
  }, [open])

  if (!open || !step) return null

  const overlay = (
    <AnimatePresence>
      <motion.div
        key="app-tutorial"
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
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="absolute z-[3] w-[calc(100%-2rem)] rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl p-4 sm:p-5"
          style={cardStyle}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-1">
                Paso {stepIndex + 1} de {STEPS.length}
              </p>
              <h2
                id="app-tutorial-title"
                className="font-display text-lg sm:text-xl tracking-wide text-[color:var(--text-primary)]"
              >
                {step.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={finish}
              className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)] transition"
              aria-label="Cerrar tutorial"
            >
              <FiX size={18} />
            </button>
          </div>

          <p className="text-sm leading-relaxed text-[color:var(--text-secondary)] mb-4">{step.body}</p>

          <div className="flex items-center gap-1.5 mb-4" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 rounded-full transition-all ${
                  i === stepIndex
                    ? 'w-5 bg-primary-500'
                    : i < stepIndex
                      ? 'w-2.5 bg-primary-500/50'
                      : 'w-1.5 bg-[color:var(--border-subtle)]'
                }`}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={finish}
              className="text-xs sm:text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition px-1 py-2"
            >
              Omitir tutorial
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={prev}
                disabled={isFirst}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-[color:var(--border-subtle)] disabled:opacity-35 disabled:pointer-events-none hover:bg-[color:var(--bg-muted)] transition"
              >
                <FiArrowLeft size={16} />
                Anterior
              </button>
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition shadow-lg shadow-primary-500/20"
              >
                {isLast ? (
                  <>
                    Listo <FiCheck size={16} />
                  </>
                ) : (
                  <>
                    Siguiente <FiArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(overlay, document.body)
}
