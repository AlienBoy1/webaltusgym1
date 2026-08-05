import { motion, AnimatePresence } from 'framer-motion'
import { FiX } from 'react-icons/fi'

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  size = 'md'
}) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl'
  }
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${sizes[size]} p-4 z-[90]`}
          >
            <div className="app-modal-panel bg-elevated rounded-2xl border border-app overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-app">
                <h2 className="font-display text-xl text-app">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-app-secondary hover:text-app hover:bg-[color:var(--bg-muted)] rounded-lg transition-colors"
                >
                  <FiX size={20} />
                </button>
              </div>
              
              {/* Content */}
              <div className="p-4">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

