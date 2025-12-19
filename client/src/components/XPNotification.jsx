import { motion, AnimatePresence } from 'framer-motion'
import { FiZap } from 'react-icons/fi'

export default function XPNotification({ xp, level, isVisible, onClose }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.8 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
          onAnimationComplete={() => {
            setTimeout(() => {
              onClose?.()
            }, 3000)
          }}
        >
          <div className="card bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-4 flex items-center gap-3 shadow-2xl">
            <FiZap size={24} className="animate-pulse" />
            <div>
              <div className="font-bold text-lg">+{xp} XP</div>
              {level && (
                <div className="text-sm opacity-90">¡Subiste a Nivel {level}!</div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

