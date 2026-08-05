import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiCamera, FiEye, FiX } from 'react-icons/fi'
import { Avatar } from '../utils/avatarUtils'

/**
 * Profile avatar with optional story ring, Ver foto / Ver historia menu,
 * and download/select protection on the photo viewer.
 */
export default function ProfileAvatar({
  avatar,
  name,
  size = 'xl',
  hasStories = false,
  onViewStory,
  className = ''
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)

  const ringClass = hasStories
    ? 'p-[3px] rounded-full bg-gradient-to-tr from-[color:var(--color-primary)] via-[color:var(--color-accent)] to-[color:var(--color-primary)]'
    : ''

  const handleClick = () => {
    if (hasStories || avatar) {
      setMenuOpen(true)
      return
    }
    if (avatar) setPhotoOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`relative inline-flex ${ringClass} ${className}`}
        aria-label="Opciones de foto de perfil"
      >
        <span className="rounded-full bg-[color:var(--bg-app)] p-[2px]">
          <Avatar avatar={avatar} name={name} size={size} />
        </span>
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4"
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] sm:rounded-3xl"
            >
              <div className="border-b border-[color:var(--border-subtle)] px-5 py-4 text-center">
                <p className="font-display text-xl tracking-wide">{name || 'Perfil'}</p>
              </div>
              {hasStories && (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-[color:var(--bg-muted)]"
                  onClick={() => {
                    setMenuOpen(false)
                    onViewStory?.()
                  }}
                >
                  <FiEye className="text-[color:var(--color-primary)]" /> Ver Historia
                </button>
              )}
              <button
                type="button"
                className="flex w-full items-center gap-3 border-t border-[color:var(--border-subtle)] px-5 py-4 text-left hover:bg-[color:var(--bg-muted)]"
                onClick={() => {
                  setMenuOpen(false)
                  setPhotoOpen(true)
                }}
              >
                <FiCamera className="text-[color:var(--color-accent)]" /> Ver foto
              </button>
              <button
                type="button"
                className="w-full border-t border-[color:var(--border-subtle)] px-5 py-4 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
                onClick={() => setMenuOpen(false)}
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {photoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setPhotoOpen(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
              onClick={() => setPhotoOpen(false)}
              aria-label="Cerrar"
            >
              <FiX size={22} />
            </button>
            <div
              className="relative max-h-[80vh] max-w-lg select-none"
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
              {avatar && (avatar.startsWith('data:') || avatar.startsWith('http')) ? (
                <img
                  src={avatar}
                  alt=""
                  draggable={false}
                  className="max-h-[80vh] w-full rounded-2xl object-contain protected-media"
                  style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                />
              ) : (
                <div className="pointer-events-none">
                  <Avatar avatar={avatar} name={name} size="xl" className="!h-64 !w-64 !text-7xl" />
                </div>
              )}
              {/* Transparent overlay blocks save/select shortcuts */}
              <div
                className="absolute inset-0 cursor-default"
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
