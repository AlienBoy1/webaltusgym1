import { motion } from 'framer-motion'
import { FiActivity, FiSliders, FiTarget, FiTrendingUp, FiZap } from 'react-icons/fi'
import { QISI_HANDLE, QISI_MEANING, QISI_NAME, QISI_TAGLINE } from '../utils/qisi'
import QySiAvatar from './QySiAvatar'

/**
 * Premium in-viewer story surface for QySi — theme adaptive.
 * `variant`: 'launch' (catalog) | 'body-hub' (Progreso update)
 */
export default function QySiStorySurface({ variant = 'launch' }) {
  const isBodyHub = variant === 'body-hub'

  return (
    <div className="absolute inset-0 overflow-hidden bg-[color:var(--bg-app)]">
      <div
        className="absolute inset-0"
        style={{
          background: isBodyHub
            ? 'radial-gradient(ellipse 85% 55% at 50% 18%, rgba(var(--color-accent-rgb),0.22), transparent 58%), radial-gradient(ellipse 55% 40% at 15% 88%, rgba(var(--color-primary-rgb),0.18), transparent 55%), var(--bg-app)'
            : 'radial-gradient(ellipse 85% 55% at 50% 18%, rgba(var(--color-primary-rgb),0.28), transparent 58%), radial-gradient(ellipse 55% 40% at 85% 88%, rgba(var(--color-accent-rgb),0.14), transparent 55%), var(--bg-app)'
        }}
      />
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, black 18%, transparent 72%)'
        }}
        animate={{ opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 rotate-12"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--text-primary) 12%, transparent), transparent)'
        }}
        initial={{ x: '-30%' }}
        animate={{ x: '340%' }}
        transition={{ duration: 3.2, ease: 'easeInOut', delay: 0.15 }}
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-7 pb-36 pt-24 text-center">
        {isBodyHub && (
          <motion.span
            className="mb-4 rounded-full border border-[rgba(var(--color-accent-rgb),0.45)] bg-[rgba(var(--color-accent-rgb),0.12)] px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[color:var(--color-accent)]"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Actualización
          </motion.span>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.55, y: 36 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16 }}
        >
          <QySiAvatar size={118} pulse attract float />
        </motion.div>

        <motion.p
          className="mt-6 font-display text-5xl tracking-[0.06em] text-[color:var(--text-primary)]"
          initial={{ opacity: 0, y: 16, letterSpacing: '0.28em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '0.06em' }}
          transition={{ delay: 0.28, duration: 0.55 }}
        >
          {QISI_NAME}
        </motion.p>
        <motion.p
          className="mt-1.5 text-sm font-semibold text-[color:var(--color-primary)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
        >
          @{QISI_HANDLE}
        </motion.p>
        <motion.p
          className="mt-3 max-w-xs text-[15px] leading-relaxed text-[color:var(--text-secondary)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58 }}
        >
          {isBodyHub
            ? 'Progreso a tu medida: cuerpo, volumen y objetivos medibles.'
            : `${QISI_MEANING}. ${QISI_TAGLINE}.`}
        </motion.p>

        <motion.div
          className="mt-8 w-full max-w-sm space-y-2.5"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.78 }}
        >
          {isBodyHub ? (
            <>
              <div className="rounded-2xl border border-[rgba(var(--color-primary-rgb),0.4)] bg-[rgba(var(--color-primary-rgb),0.12)] px-4 py-3.5 text-left backdrop-blur-md">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                  <FiSliders size={13} /> Ajustable
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                  Rutinas más editables para ti y tus GymRats
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]/85 px-4 py-3 text-left backdrop-blur-md">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                  <FiTrendingUp size={13} className="text-[color:var(--color-primary)]" /> Medible
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  Ficha corporal · check-ins · volumen real de entrenos
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]/85 px-4 py-3 text-left backdrop-blur-md">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                  <FiTarget size={13} className="text-[color:var(--color-primary)]" /> En Progreso
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  Ábrelo en la pestaña Progreso · yo te guío
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-[rgba(var(--color-primary-rgb),0.4)] bg-[rgba(var(--color-primary-rgb),0.12)] px-4 py-3.5 text-left backdrop-blur-md">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                  <FiZap size={13} /> Entrenamientos
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                  Burbuja inferior derecha · 5 variantes listas
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]/85 px-4 py-3 text-left backdrop-blur-md">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                  <FiActivity size={13} className="text-[color:var(--color-primary)]" /> Rutas
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  Gym · Casa · Calistenia · Running · Full Body
                </p>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
