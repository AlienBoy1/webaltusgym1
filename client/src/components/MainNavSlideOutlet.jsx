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
    <div className={`relative overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={location.pathname}
          data-tour={isMainNav ? 'tour-main-content' : undefined}
          custom={dir}
          initial={
            dir === 0
              ? { x: 0, opacity: 1 }
              : { x: dir > 0 ? '42%' : '-42%', opacity: 0.72 }
          }
          animate={{ x: 0, opacity: 1 }}
          exit={
            dir === 0
              ? { x: 0, opacity: 1 }
              : { x: dir > 0 ? '-42%' : '42%', opacity: 0.72 }
          }
          transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
          className="will-change-transform"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
