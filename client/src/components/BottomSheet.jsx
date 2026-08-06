import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Bottom sheet / modal that portals to document.body so it always stacks
 * above the fixed mobile navbar (z-50) and is not trapped by parent transforms.
 */
export default function BottomSheet({
  open,
  onClose,
  children,
  className = '',
  panelClassName = '',
  zIndexClass = 'z-[120]',
  maxWidthClass = 'sm:max-w-md'
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="bottom-sheet"
          className={`app-overlay-sheet fixed inset-0 ${zIndexClass} flex items-end sm:items-center justify-center p-0 sm:p-4 ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={`app-bottom-sheet-panel relative w-full ${maxWidthClass} max-h-[min(92svh,720px)] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl flex flex-col ${panelClassName}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
