import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiCamera, FiEye, FiX } from 'react-icons/fi'
import { Avatar } from '../utils/avatarUtils'
import ProtectedMedia from './ProtectedMedia'
import { useHistoryBackLayer } from '../hooks/useHistoryBackLayer'

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

  const requestCloseMenu = useHistoryBackLayer(
    menuOpen && !photoOpen,
    () => setMenuOpen(false),
    'profile-avatar-menu'
  )

  const requestClosePhoto = useHistoryBackLayer(
    photoOpen,
    () => setPhotoOpen(false),
    'profile-avatar-photo'
  )

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

      {createPortal(
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-4"
              onClick={requestCloseMenu}
            >
              <motion.div
                initial={{ y: 24, opacity: 0.96 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 16, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 360 }}
                onClick={(e) => e.stopPropagation()}
                className="mb-[max(0.5rem,env(safe-area-inset-bottom))] w-full max-w-xs overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] shadow-2xl sm:mb-0"
              >
                <div className="border-b border-[color:var(--border-subtle)] px-4 py-2.5 text-center">
                  <p className="truncate text-sm font-semibold tracking-wide text-[color:var(--text-primary)]">
                    {name || 'Perfil'}
                  </p>
                </div>
                {hasStories && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm hover:bg-[color:var(--bg-muted)]"
                    onClick={() => {
                      requestCloseMenu()
                      // Wait for menu history entry to pop before opening story layer
                      window.setTimeout(() => onViewStory?.(), 100)
                    }}
                  >
                    <FiEye className="text-[color:var(--color-primary)]" size={18} /> Ver Historia
                  </button>
                )}
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 border-t border-[color:var(--border-subtle)] px-4 py-3 text-left text-sm hover:bg-[color:var(--bg-muted)]"
                  onClick={() => {
                    requestCloseMenu()
                    window.setTimeout(() => setPhotoOpen(true), 100)
                  }}
                >
                  <FiCamera className="text-[color:var(--color-accent)]" size={18} /> Ver foto
                </button>
                <button
                  type="button"
                  className="w-full border-t border-[color:var(--border-subtle)] px-4 py-2.5 text-sm text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
                  onClick={requestCloseMenu}
                >
                  Cancelar
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {photoOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 p-4"
              onClick={requestClosePhoto}
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
                onClick={requestClosePhoto}
                aria-label="Cerrar"
              >
                <FiX size={22} />
              </button>
              <div
                className="relative max-h-[80vh] max-w-lg select-none"
                data-protected-media="1"
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
              >
                {avatar && (avatar.startsWith('data:') || avatar.startsWith('http')) ? (
                  <ProtectedMedia
                    src={avatar}
                    alt=""
                    className="max-h-[80vh] w-full rounded-2xl object-contain"
                    style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                  />
                ) : (
                  <div className="pointer-events-none">
                    <Avatar avatar={avatar} name={name} size="xl" className="!h-64 !w-64 !text-7xl" />
                  </div>
                )}
                <div
                  className="absolute inset-0 cursor-default"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
