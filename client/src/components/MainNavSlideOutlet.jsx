import { useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MAIN_NAV_PATHS } from '../hooks/useMainNavSwipe'

/**
 * Horizontal slide between primary bottom-nav screens (Facebook-like).
 * Direction is derived from MAIN_NAV_PATHS order so tutorial navigation
 * and real tab taps/swipes share the same motion.
 */
export default function MainNavSlideOutlet({ className = '' }) {
  const location = useLocation()
  const prevPathRef = useRef(location.pathname)
  const dirRef = useRef(0)

  const prev = prevPathRef.current
  if (prev !== location.pathname) {
    const iPrev = MAIN_NAV_PATHS.indexOf(prev)
    const iNext = MAIN_NAV_PATHS.indexOf(location.pathname)
    if (iPrev >= 0 && iNext >= 0 && iPrev !== iNext) {
      dirRef.current = iNext > iPrev ? 1 : -1
    } else {
      dirRef.current = 0
    }
    prevPathRef.current = location.pathname
  }

  const dir = dirRef.current
  const isMainNav = MAIN_NAV_PATHS.includes(location.pathname)

  return (
    <div className={`relative overflow-x-clip ${className}`}>
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={location.pathname}
          data-tour={isMainNav ? 'tour-main-content' : undefined}
          custom={dir}
          initial={
            dir === 0
              ? false
              : { x: dir > 0 ? '36%' : '-36%', opacity: 0.88 }
          }
          animate={{ x: 0, opacity: 1 }}
          exit={
            dir === 0
              ? undefined
              : { x: dir > 0 ? '-28%' : '28%', opacity: 0.88 }
          }
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          className="relative w-full"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
