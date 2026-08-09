import { motion } from 'framer-motion'
import { FiActivity, FiZap } from 'react-icons/fi'
import { QISI_HANDLE, QISI_NAME } from '../utils/qisi'

/**
 * Theme-aware animated QySi profile cover (no stock/AI photo).
 */
export default function QySiCover({ className = '' }) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{
        background:
          'radial-gradient(ellipse 90% 70% at 18% 20%, rgba(var(--color-primary-rgb),0.38), transparent 55%), radial-gradient(ellipse 70% 60% at 88% 75%, rgba(var(--color-accent-rgb),0.22), transparent 50%), linear-gradient(145deg, var(--bg-muted) 0%, var(--bg-app) 55%, color-mix(in srgb, var(--bg-app) 70%, var(--color-primary) 30%) 100%)'
      }}
    >
      {/* Soft grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(color-mix(in srgb, var(--text-primary) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 8%, transparent) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(ellipse at 40% 40%, black 10%, transparent 75%)'
        }}
      />

      {/* Floating orbs */}
      <motion.span
        className="absolute -left-8 top-2 h-36 w-36 rounded-full blur-2xl"
        style={{ background: 'rgba(var(--color-primary-rgb),0.45)' }}
        animate={{ x: [0, 18, 0], y: [0, 10, 0], opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="absolute right-0 bottom-0 h-40 w-40 rounded-full blur-3xl"
        style={{ background: 'rgba(var(--color-accent-rgb),0.35)' }}
        animate={{ x: [0, -14, 0], y: [0, -12, 0], opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Sweep */}
      <motion.div
        className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 rotate-12"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--text-primary) 16%, transparent), transparent)'
        }}
        animate={{ x: ['-10%', '340%'] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }}
      />

      {/* Decorative rings */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-[58%] rounded-full border"
        style={{ borderColor: 'rgba(var(--color-primary-rgb),0.35)' }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-[58%] rounded-full border"
        style={{ borderColor: 'rgba(var(--color-accent-rgb),0.22)' }}
        animate={{ scale: [1.02, 1.12, 1.02], opacity: [0.2, 0.45, 0.2], rotate: [0, 40, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-8 pt-3 text-center">
        <motion.div
          className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(var(--color-primary-rgb),0.4)] bg-[rgba(var(--color-primary-rgb),0.14)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)] backdrop-blur-md"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <FiZap size={11} /> Sistema inteligente
        </motion.div>
        <motion.p
          className="mt-2 font-display text-3xl tracking-[0.12em] text-[color:var(--text-primary)] sm:text-4xl"
          animate={{ letterSpacing: ['0.22em', '0.12em', '0.22em'] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {QISI_NAME}
        </motion.p>
        <p className="mt-1 text-xs font-semibold text-[color:var(--color-primary)]">@{QISI_HANDLE}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {['5 rutas', 'Tu nivel', 'Entrenamientos'].map((label, i) => (
            <motion.span
              key={label}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]/70 px-2.5 py-1 text-[10px] font-semibold text-[color:var(--text-secondary)] backdrop-blur-md"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.8 + i * 0.35, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
            >
              <FiActivity size={10} className="text-[color:var(--color-primary)]" />
              {label}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  )
}
