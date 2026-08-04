import { motion, AnimatePresence } from 'framer-motion'
import QyntraLogo from './QyntraLogo'

const VARIANTS = {
  boot: {
    title: 'QYNTRA',
    subtitle: 'Preparando tu sesión…',
    accent: 'from-primary-500/30 via-transparent to-accent-cyan/20'
  },
  auth: {
    title: 'QYNTRA',
    subtitle: 'Procesando…',
    accent: 'from-primary-500/35 via-transparent to-orange-500/15'
  },
  logout: {
    title: 'Hasta pronto',
    subtitle: 'Cerrando tu sesión con seguridad…',
    accent: 'from-accent-cyan/25 via-transparent to-primary-500/20'
  },
  update: {
    title: 'Actualizando',
    subtitle: 'Instalando la nueva versión…',
    accent: 'from-primary-500/40 via-transparent to-accent-cyan/25'
  }
}

/**
 * Branded full-screen theater used for boot, login/logout and update flows.
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
  const meta = VARIANTS[variant] || VARIANTS.auth
  const heading = title ?? meta.title
  const line = subtitle ?? meta.subtitle

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`theater-${variant}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden ${className}`}
          style={{ background: '#07070c' }}
          role="status"
          aria-live="polite"
        >
          {/* Atmospheric layers */}
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${meta.accent}`} />
          <motion.div
            className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-primary-500/25 blur-[90px]"
            animate={{ x: [0, 40, 0], y: [0, -28, 0], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="pointer-events-none absolute -right-16 bottom-1/4 h-80 w-80 rounded-full bg-accent-cyan/20 blur-[100px]"
            animate={{ x: [0, -36, 0], y: [0, 30, 0], opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="relative z-10 flex w-full max-w-md flex-col items-center px-6 text-center"
          >
            <div className="relative mb-8">
              <motion.div
                className="absolute inset-[-18px] rounded-full border border-white/10"
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-[-32px] rounded-full border border-primary-500/20"
                animate={{ rotate: -360 }}
                transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <QyntraLogo size="xl" withGlow />
              </motion.div>
            </div>

            <motion.h1
              key={heading}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-4xl tracking-wide text-white sm:text-5xl"
            >
              <span className="text-primary-500">{heading.split(' ')[0]}</span>
              {heading.includes(' ') ? (
                <span> {heading.split(' ').slice(1).join(' ')}</span>
              ) : null}
            </motion.h1>

            <motion.p
              key={line + status}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-sm text-gray-400 sm:text-base"
            >
              {status || line}
            </motion.p>

            {typeof progress === 'number' && (
              <div className="mt-8 w-full max-w-xs">
                <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary-500 to-accent-cyan"
                    animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                  />
                  <motion.div
                    className="absolute inset-y-0 w-16 bg-white/30 blur-[2px]"
                    animate={{ left: ['-30%', '110%'] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                  />
                </div>
                <p className="mt-3 font-mono text-xs tabular-nums text-gray-500">{Math.round(progress)}%</p>
              </div>
            )}

            {children && <div className="mt-8 w-full">{children}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
