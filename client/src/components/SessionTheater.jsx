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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`theater-${variant}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={`session-theater fixed inset-0 z-[100] flex items-center justify-center overflow-hidden ${className}`}
          role="status"
          aria-live="polite"
          data-variant={variant}
        >
          <div className="pointer-events-none absolute inset-0" style={{ background: '#05050A' }} />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: isLogout
                ? 'radial-gradient(ellipse at 50% 35%, rgba(0,245,255,0.14), transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(255,107,53,0.1), transparent 45%)'
                : 'radial-gradient(ellipse at 50% 32%, rgba(255,107,53,0.22), transparent 52%), radial-gradient(ellipse at 20% 80%, rgba(0,245,255,0.12), transparent 45%)'
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
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
                  background: iColor(p.id, isLogout)
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
                  ? 'linear-gradient(90deg, transparent, rgba(0,245,255,0.7), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(255,107,53,0.75), transparent)'
              }}
              animate={{ top: ['12%', '88%', '12%'], opacity: [0.15, 0.55, 0.15] }}
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
              className="mb-7 text-[10px] font-semibold uppercase text-white/55"
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
                color="rgba(255,255,255,0.12)"
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
                        ? '0 0 16px rgba(0,245,255,0.8)'
                        : '0 0 16px rgba(255,107,53,0.8)'
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
                          'drop-shadow(0 0 28px rgba(255,107,53,0.55))',
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
              className="font-display text-5xl tracking-[0.08em] text-white sm:text-6xl"
            >
              <span className="session-theater-gradient">{heading}</span>
            </motion.h1>

            <motion.p
              key={line}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 max-w-sm text-sm text-white/65 sm:text-base"
            >
              {line}
            </motion.p>

            <div className="mt-7 flex w-full max-w-xs flex-col items-center gap-3">
              <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/10">
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
                  className="text-xs font-medium tracking-wide text-white/50"
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
                          : 'rgba(255,255,255,0.2)'
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

function iColor(i, isLogout) {
  if (isLogout) return i % 2 === 0 ? 'rgba(0,245,255,0.55)' : 'rgba(255,255,255,0.35)'
  return i % 2 === 0 ? 'rgba(255,107,53,0.6)' : 'rgba(0,245,255,0.4)'
}
