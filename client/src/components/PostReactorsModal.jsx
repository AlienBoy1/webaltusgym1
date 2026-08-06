import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX } from 'react-icons/fi'
import { Avatar } from '../utils/avatarUtils'

export default function PostReactorsModal({ open, onClose, reactors = [], loading = false }) {
  const grouped = reactors.reduce((acc, r) => {
    const key = r.emoji || '❤️'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  const emojis = Object.keys(grouped)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
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
            className="relative w-full sm:max-w-md max-h-[75vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-subtle)]">
              <h3 className="font-display text-lg">Reacciones</h3>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(75vh-3.5rem)] p-4 space-y-5">
              {loading ? (
                <div className="py-10 flex justify-center">
                  <div className="w-7 h-7 border-2 border-[color:var(--border-subtle)] border-t-[color:var(--color-primary)] rounded-full animate-spin" />
                </div>
              ) : reactors.length === 0 ? (
                <p className="text-center text-[color:var(--text-secondary)] py-8 text-sm">
                  Aún no hay reacciones
                </p>
              ) : (
                emojis.map((emoji) => (
                  <div key={emoji}>
                    <div className="flex items-center gap-2 mb-2 text-sm text-[color:var(--text-secondary)]">
                      <span className="text-lg">{emoji}</span>
                      <span>{grouped[emoji].length}</span>
                    </div>
                    <div className="space-y-2">
                      {grouped[emoji].map((r) => (
                        <Link
                          key={`${r.userId}-${emoji}`}
                          to={`/user/${r.userId}`}
                          onClick={onClose}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-[color:var(--bg-muted)] transition"
                        >
                          <Avatar avatar={r.avatar} name={r.name} size="sm" />
                          <span className="font-medium text-sm truncate">{r.name || 'Usuario'}</span>
                          <span className="ml-auto text-base">{emoji}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
