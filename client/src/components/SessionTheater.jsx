import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import QyntraLogo from './QyntraLogo'

const VARIANTS = {
  boot: {
    title: 'QYNTRA',
    subtitle: 'Preparando tu sesión',
    kicker: 'GYM OS · BOOT',
    stages: ['Sincronizando perfil', 'Cargando preferencias', 'Listo para entrenar']
  },
  auth: {
    title: 'QYNTRA',
    subtitle: 'Entrando a tu cuenta',
    kicker: 'SECURE ACCESS',
    stages: ['Verificando credenciales', 'Abriendo tu espacio', 'Bienvenido de nuevo']
  },
  logout: {
    title: 'HASTA PRONTO',
    subtitle: 'Cerrando tu sesión',
    kicker: 'SAFE EXIT',
    stages: ['Guardando progreso', 'Cerrando conexiones', 'Sesión finalizada']
  },
  update: {
    title: 'ACTUALIZANDO',
    subtitle: 'Instalando la nueva versión',
    kicker: 'SYSTEM UPDATE',
    stages: ['Descargando paquete', 'Aplicando cambios', 'Reiniciando interfaz']
  }
}

function useResolvedTheme() {
  const [mode, setMode] = useState(() => {
    if (typeof document === 'undefined') return 'dark'
    if (document.documentElement.classList.contains('light')) return 'light'
    if (document.documentElement.classList.contains('dark')) return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    const sync = () => {
      if (root.classList.contains('light')) setMode('light')
      else if (root.classList.contains('dark')) setMode('dark')
      else setMode(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    }
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener?.('change', sync)
    return () => {
      obs.disconnect()
      mq.removeEventListener?.('change', sync)
    }
  }, [])

  return mode
}

function OrbitRing({ size, delay = 0, reverse = false, color, reduceMotion }) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 rounded-full border"
      style={{
        width: size,
        height: size,
        x: '-50%',
        y: '-50%',
        borderColor: color
      }}
      animate={
        reduceMotion
          ? undefined
          : {
              rotate: reverse ? -360 : 360,
              opacity: [0.25, 0.65, 0.25]
            }
      }
      transition={{
        rotate: { duration: 14 + delay * 4, repeat: Infinity, ease: 'linear' },
        opacity: { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay }
      }}
    />
  )
}

/**
 * Branded full-screen theater for boot, login/logout and update flows.
 * Respects light / dark / system theme via html class + CSS variables.
 */
export default function SessionTheater({
  visible = true,
  variant = 'auth',
  title,
  subtitle,
  progress = null,
  status = '',
  children,
  className = ''
}) {
  const reduceMotion = useReducedMotion()
  const theme = useResolvedTheme()
  const isLight = theme === 'light'
  const meta = VARIANTS[variant] || VARIANTS.auth
  const heading = title ?? meta.title
  const line = subtitle ?? meta.subtitle
  const isLogout = variant === 'logout'
  const [stageIdx, setStageIdx] = useState(0)

  useEffect(() => {
    if (!visible) {
      setStageIdx(0)
      return undefined
    }
    if (reduceMotion) return undefined
    const id = setInterval(() => {
      setStageIdx((i) => (i + 1) % meta.stages.length)
    }, 1400)
    return () => clearInterval(id)
  }, [visible, reduceMotion, meta.stages.length])

  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${6 + ((i * 17) % 88)}%`,
        top: `${8 + ((i * 29) % 84)}%`,
        size: 2 + (i % 3),
        delay: (i % 7) * 0.35,
        duration: 4.5 + (i % 5)
      })),
    []
  )

  const stageLabel = status || meta.stages[stageIdx] || line
  const gridLine = isLight ? 'rgba(15,15,20,0.06)' : 'rgba(255,255,255,0.035)'
  const trackBg = isLight ? 'rgba(15,15,20,0.08)' : 'rgba(255,255,255,0.1)'
  const idleDot = isLight ? 'rgba(15,15,20,0.18)' : 'rgba(255,255,255,0.2)'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`theater-${variant}-${theme}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={`session-theater fixed inset-0 z-[100] flex items-center justify-center overflow-hidden ${className}`}
          role="status"
          aria-live="polite"
          data-variant={variant}
          data-theme={theme}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'var(--bg-app)' }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: isLogout
                ? 'radial-gradient(ellipse at 50% 35%, rgba(0,245,255,0.12), transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(255,107,53,0.08), transparent 45%)'
                : 'radial-gradient(ellipse at 50% 32%, rgba(255,107,53,0.16), transparent 52%), radial-gradient(ellipse at 20% 80%, rgba(0,245,255,0.1), transparent 45%)'
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: isLight ? 0.55 : 0.35,
              backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`,
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 72%)'
            }}
          />

          {!reduceMotion &&
            particles.map((p) => (
              <motion.span
                key={p.id}
                className="pointer-events-none absolute rounded-full"
                style={{
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  background: iColor(p.id, isLogout, isLight)
                }}
                animate={{ opacity: [0.1, 0.75, 0.1], y: [0, -18, 0], scale: [1, 1.35, 1] }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              />
            ))}

          {!reduceMotion && (
            <motion.div
              className="pointer-events-none absolute inset-x-0 h-px"
              style={{
                background: isLogout
                  ? 'linear-gradient(90deg, transparent, rgba(0,245,255,0.55), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(255,107,53,0.6), transparent)'
              }}
              animate={{ top: ['12%', '88%', '12%'], opacity: [0.15, 0.5, 0.15] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: isLogout ? 24 : -20,
              scale: isLogout ? 0.96 : 1.02,
              filter: 'blur(6px)'
            }}
            transition={{ type: 'spring', damping: 22, stiffness: 240 }}
            className="relative z-10 flex w-full max-w-lg flex-col items-center px-6 text-center"
          >
            <motion.p
              initial={{ opacity: 0, letterSpacing: '0.5em' }}
              animate={{ opacity: 1, letterSpacing: '0.35em' }}
              className="mb-7 text-[10px] font-semibold uppercase"
              style={{ color: 'var(--text-muted)' }}
            >
              {meta.kicker}
            </motion.p>

            <div className="relative mb-9 flex h-36 w-36 items-center justify-center sm:h-40 sm:w-40">
              <OrbitRing
                size="100%"
                delay={0}
                color="rgba(255,107,53,0.28)"
                reduceMotion={reduceMotion}
              />
              <OrbitRing
                size="78%"
                delay={0.4}
                reverse
                color="rgba(0,245,255,0.22)"
                reduceMotion={reduceMotion}
              />
              <OrbitRing
                size="56%"
                delay={0.8}
                color={isLight ? 'rgba(15,15,20,0.12)' : 'rgba(255,255,255,0.12)'}
                reduceMotion={reduceMotion}
              />

              {!reduceMotion && (
                <motion.div
                  className="absolute inset-[10%]"
                  animate={{ rotate: isLogout ? -360 : 360 }}
                  transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                >
                  <span
                    className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full"
                    style={{
                      background: isLogout ? '#00F5FF' : '#FF6B35',
                      boxShadow: isLogout
                        ? '0 0 16px rgba(0,245,255,0.55)'
                        : '0 0 16px rgba(255,107,53,0.55)'
                    }}
                  />
                </motion.div>
              )}

              <motion.div
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        scale: [1, 1.05, 1],
                        filter: [
                          'drop-shadow(0 0 0 rgba(255,107,53,0))',
                          `drop-shadow(0 0 24px rgba(255,107,53,${isLight ? 0.35 : 0.55}))`,
                          'drop-shadow(0 0 0 rgba(255,107,53,0))'
                        ]
                      }
                }
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10"
              >
                <QyntraLogo size="xl" withGlow />
              </motion.div>
            </div>

            <motion.h1
              key={heading}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-5xl tracking-[0.08em] sm:text-6xl"
              style={{ color: 'var(--text-primary)' }}
            >
              <span className={`session-theater-gradient${isLight ? ' is-light' : ''}`}>{heading}</span>
            </motion.h1>

            <motion.p
              key={line}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 max-w-sm text-sm sm:text-base"
              style={{ color: 'var(--text-secondary)' }}
            >
              {line}
            </motion.p>

            <div className="mt-7 flex w-full max-w-xs flex-col items-center gap-3">
              <div className="relative h-[3px] w-full overflow-hidden rounded-full" style={{ background: trackBg }}>
                {typeof progress === 'number' ? (
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #FF6B35, #00F5FF)'
                    }}
                    animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                  />
                ) : (
                  <motion.div
                    className="absolute inset-y-0 w-1/3 rounded-full"
                    style={{
                      background: isLogout
                        ? 'linear-gradient(90deg, transparent, #00F5FF, transparent)'
                        : 'linear-gradient(90deg, transparent, #FF6B35, #00F5FF, transparent)'
                    }}
                    animate={reduceMotion ? { left: '33%' } : { left: ['-35%', '110%'] }}
                    transition={{ repeat: Infinity, duration: 1.35, ease: 'easeInOut' }}
                  />
                )}
              </div>

              <AnimatePresence mode="wait">
                <motion.p
                  key={stageLabel}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28 }}
                  className="text-xs font-medium tracking-wide"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {stageLabel}
                  {typeof progress === 'number' ? ` · ${Math.round(progress)}%` : ''}
                </motion.p>
              </AnimatePresence>

              <div className="mt-1 flex items-center gap-1.5">
                {meta.stages.map((_, i) => (
                  <span
                    key={i}
                    className="h-1 rounded-full transition-all duration-300"
                    style={{
                      width: i === stageIdx ? 18 : 6,
                      background:
                        i === stageIdx
                          ? isLogout
                            ? '#00F5FF'
                            : '#FF6B35'
                          : idleDot
                    }}
                  />
                ))}
              </div>
            </div>

            {children && <div className="mt-8 w-full">{children}</div>}
          </motion.div>

          <style>{`
            .session-theater-gradient {
              background: linear-gradient(105deg, #FF6B35 0%, #fff 42%, #00F5FF 100%);
              background-size: 200% 100%;
              -webkit-background-clip: text;
              background-clip: text;
              color: transparent;
              animation: session-theater-shine 4.8s ease-in-out infinite;
            }
            .session-theater-gradient.is-light {
              background: linear-gradient(105deg, #FF6B35 0%, #1a1a22 45%, #0891b2 100%);
              background-size: 200% 100%;
              -webkit-background-clip: text;
              background-clip: text;
            }
            @keyframes session-theater-shine {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
            @media (prefers-reduced-motion: reduce) {
              .session-theater-gradient { animation: none; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function iColor(i, isLogout, isLight) {
  if (isLogout) {
    return i % 2 === 0
      ? `rgba(0,245,255,${isLight ? 0.45 : 0.55})`
      : isLight
        ? 'rgba(15,15,20,0.25)'
        : 'rgba(255,255,255,0.35)'
  }
  return i % 2 === 0
    ? `rgba(255,107,53,${isLight ? 0.5 : 0.6})`
    : `rgba(0,245,255,${isLight ? 0.35 : 0.4})`
}
