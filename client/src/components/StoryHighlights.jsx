import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiStar, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function StoryHighlights({ userId }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null) // { album, index }

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      try {
        setLoading(true)
        const { data } = await api.get(`/stories/favorites/albums?userId=${userId}`)
        setAlbums(data || [])
      } catch {
        setAlbums([])
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  const openAlbum = async (album) => {
    try {
      const { data } = await api.get(`/stories/favorites/albums/${album._id || album.id}`)
      if (!data.items?.length) {
        toast('Este álbum aún no tiene estados')
        return
      }
      setActive({ album: data, index: 0 })
    } catch {
      toast.error('No se pudo abrir el álbum')
    }
  }

  const item = active?.album?.items?.[active.index]

  if (loading) {
    return (
      <div className="card">
        <div className="py-6 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-dark-100 border-t-primary-500" />
        </div>
      </div>
    )
  }

  if (!albums.length) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="card"
      >
        <div className="mb-4 flex items-center gap-2">
          <FiStar className="text-accent-yellow" />
          <h2 className="font-display text-xl">Favoritos</h2>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide">
          {albums.map((album) => (
            <button
              key={album._id || album.id}
              type="button"
              onClick={() => openAlbum(album)}
              className="flex w-[76px] shrink-0 flex-col items-center gap-1.5"
            >
              <div className="rounded-full bg-gradient-to-tr from-primary-500 to-accent-cyan p-[2px]">
                <div className="rounded-full bg-dark-500 p-[2px]">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-dark-200 sm:h-16 sm:w-16">
                    {album.coverUrl ? (
                      album.coverType === 'video' ? (
                        <video src={album.coverUrl} muted className="h-full w-full object-cover" />
                      ) : (
                        <img src={album.coverUrl} alt="" className="h-full w-full object-cover" />
                      )
                    ) : (
                      <FiStar className="text-accent-yellow" size={18} />
                    )}
                  </div>
                </div>
              </div>
              <span className="w-full truncate text-center text-[11px] text-gray-300">{album.name}</span>
            </button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence>
        {active && item && (
          <div className="story-viewer force-dark fixed inset-0 z-[90] flex items-center justify-center bg-black">
            <div className="relative flex h-full w-full max-w-lg flex-col">
              <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white drop-shadow">{active.album.name}</p>
                  <p className="text-xs text-white/60">
                    {active.index + 1}/{active.album.items.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  className="rounded-full bg-black/40 p-2 text-white"
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="relative flex flex-1 items-center justify-center">
                <button
                  type="button"
                  className="absolute left-2 z-10 rounded-full bg-black/40 p-2 text-white disabled:opacity-30"
                  disabled={active.index <= 0}
                  onClick={() => setActive((a) => ({ ...a, index: a.index - 1 }))}
                >
                  <FiChevronLeft />
                </button>
                <button
                  type="button"
                  className="absolute right-2 z-10 rounded-full bg-black/40 p-2 text-white disabled:opacity-30"
                  disabled={active.index >= active.album.items.length - 1}
                  onClick={() => setActive((a) => ({ ...a, index: a.index + 1 }))}
                >
                  <FiChevronRight />
                </button>
                {item.mediaType === 'video' ? (
                  <video
                    key={item.id}
                    src={item.mediaUrl}
                    controls
                    playsInline
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <img src={item.mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
                )}
              </div>

              {(item.caption || item.authorName) && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 text-center">
                  {item.authorName && (
                    <p className="text-xs text-white/50">{item.authorName}</p>
                  )}
                  {item.caption && <p className="mt-1 text-sm text-white">{item.caption}</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
