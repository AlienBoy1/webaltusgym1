import { motion } from 'framer-motion'
import { QISI_NAME } from '../utils/qisi'

/** Canonical public avatar asset for QySi (robot gymrat). */
export const QYSI_AVATAR_SRC = '/qysi-avatar.png'

/**
 * Premium QySi avatar ring — used in intro, FAB and assistant chrome.
 * Glow uses --color-primary-rgb so it tracks the user's appearance theme.
 */
export default function QySiAvatar({
  size = 56,
  pulse = false,
  attract = false,
  float = false,
  className = '',
  ring = true
}) {
  const glowSpeed = attract ? 1.15 : 2.6

  return (
    <motion.div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      animate={float ? { y: [0, -6, 0] } : undefined}
      transition={float ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      {(pulse || attract) && (
        <>
          <motion.span
            className="absolute inset-[-14%] rounded-full blur-xl"
            style={{ background: 'rgba(var(--color-primary-rgb), 0.45)' }}
            animate={{
              opacity: attract ? [0.4, 1, 0.4] : [0.35, 0.85, 0.35],
              scale: attract ? [0.88, 1.2, 0.88] : [0.9, 1.12, 0.9]
            }}
            transition={{ duration: glowSpeed, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            className="absolute inset-[-4%] rounded-full"
            style={{ border: '1px solid rgba(var(--color-primary-rgb), 0.5)' }}
            animate={{
              opacity: attract ? [0.35, 1, 0.35] : [0.2, 0.7, 0.2],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: glowSpeed * 0.95, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}
      <div
        className={`relative h-full w-full overflow-hidden rounded-full bg-[color:var(--bg-muted)] shadow-[0_16px_48px_var(--shadow-color)] ${
          ring ? 'ring-2 ring-offset-2 ring-offset-[color:var(--bg-app)]' : ''
        }`}
        style={
          ring
            ? { boxShadow: '0 0 0 2px rgba(var(--color-primary-rgb), 0.55)' }
            : undefined
        }
      >
        <img
          src={QYSI_AVATAR_SRC}
          alt={QISI_NAME}
          className="h-full w-full object-cover object-[center_18%]"
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/5" />
      </div>
    </motion.div>
  )
}
