import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiStar, FiX, FiEdit2 } from 'react-icons/fi'
import api from '../utils/api'
import toast from 'react-hot-toast'
import ProtectedMedia from './ProtectedMedia'
import AlbumCoverPicker from './AlbumCoverPicker'
import { useAuthStore } from '../store/authStore'

const IMAGE_MS = 5500
const MAX_VIDEO_MS = 30000

export default function StoryHighlights({ userId, isOwner = false }) {
  const me = useAuthStore((s) => s.user)
  const owner = isOwner || String(me?.id || me?._id || '') === String(userId || '')

  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null) // { album, index }
  const [mediaReady, setMediaReady] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [menuAlbum, setMenuAlbum] = useState(null)
  const [coverEditor, setCoverEditor] = useState(null) // { albumId, items }

  const timerRef = useRef(null)
  const startedAtRef = useRef(null)
  const remainingRef = useRef(null)
  const durationRef = useRef(IMAGE_MS)
  const progressRafRef = useRef(null)
  const longPressRef = useRef(null)
  const longFiredRef = useRef(false)
  const pressMovedRef = useRef(false)

  const reloadAlbums = useCallback(async () => {
    if (!userId) return
    try {
      const { data } = await api.get(`/stories/favorites/albums?userId=${userId}`)
      setAlbums(data || [])
    } catch {
      setAlbums([])
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      try {
        setLoading(true)
        await reloadAlbums()
      } finally {
        setLoading(false)
      }
    })()
  }, [userId, reloadAlbums])

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
  const paused = Boolean(menuAlbum) || transitioning

  const goNext = useCallback(() => {
    setActive((a) => {
      if (!a) return null
      if (a.index >= a.album.items.length - 1) return null
      setTransitioning(true)
      setMediaReady(false)
      setProgressPct(0)
      window.setTimeout(() => setTransitioning(false), 280)
      return { ...a, index: a.index + 1 }
    })
  }, [])

  const goPrev = useCallback(() => {
    setActive((a) => {
      if (!a || a.index <= 0) return a
      setTransitioning(true)
      setMediaReady(false)
      setProgressPct(0)
      window.setTimeout(() => setTransitioning(false), 280)
      return { ...a, index: a.index - 1 }
    })
  }, [])

  useEffect(() => {
    if (!item) return undefined
    durationRef.current = item.mediaType === 'video' ? MAX_VIDEO_MS : IMAGE_MS
    remainingRef.current = durationRef.current
    startedAtRef.current = null
    setMediaReady(false)
    setProgressPct(0)
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [item?.id, item?._id, active?.index])

  useEffect(() => {
    if (!item) return undefined
    const blocking = !mediaReady || transitioning

    if (paused || blocking) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (startedAtRef.current != null) {
        const elapsed = Date.now() - startedAtRef.current
        const base = remainingRef.current ?? durationRef.current
        remainingRef.current = Math.max(0, base - elapsed)
        startedAtRef.current = null
      }
      return undefined
    }

    const wait = remainingRef.current ?? durationRef.current
    if (wait <= 0) {
      goNext()
      return undefined
    }
    startedAtRef.current = Date.now()
    timerRef.current = window.setTimeout(() => {
      remainingRef.current = null
      startedAtRef.current = null
      goNext()
    }, wait)
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [item?.id, item?._id, mediaReady, transitioning, paused, goNext])

  useEffect(() => {
    if (!item) {
      setProgressPct(0)
      return undefined
    }
    const compute = () => {
      const total = durationRef.current || IMAGE_MS
      const rem = remainingRef.current ?? total
      const t0 = startedAtRef.current
      let elapsed = total - rem
      if (t0 != null) elapsed += Date.now() - t0
      return Math.min(100, Math.max(0, (elapsed / total) * 100))
    }
    if (paused || !mediaReady || transitioning) {
      setProgressPct(compute())
      return undefined
    }
    const tick = () => {
      setProgressPct(compute())
      progressRafRef.current = requestAnimationFrame(tick)
    }
    progressRafRef.current = requestAnimationFrame(tick)
    return () => {
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current)
    }
  }, [item?.id, item?._id, mediaReady, transitioning, paused])

  const clearLongPress = () => {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  const onBubblePointerDown = (album) => {
    if (!owner) return
    pressMovedRef.current = false
    longFiredRef.current = false
    clearLongPress()
    longPressRef.current = window.setTimeout(() => {
      longPressRef.current = null
      longFiredRef.current = true
      setMenuAlbum(album)
      if (navigator.vibrate) navigator.vibrate(12)
    }, 420)
  }

  const onBubblePointerMove = () => {
    pressMovedRef.current = true
    clearLongPress()
  }

  const onBubblePointerUp = (album) => {
    clearLongPress()
    if (longFiredRef.current) {
      longFiredRef.current = false
      return
    }
    if (pressMovedRef.current) return
    openAlbum(album)
  }

  const openCoverEditor = async () => {
    const album = menuAlbum
    setMenuAlbum(null)
    if (!album) return
    try {
      const { data } = await api.get(`/stories/favorites/albums/${album._id || album.id}`)
      setCoverEditor({
        albumId: album._id || album.id,
        items: data.items || []
      })
    } catch {
      toast.error('No se pudo abrir el editor de portada')
    }
  }

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

  const items = active?.album?.items || []

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
              onPointerDown={() => onBubblePointerDown(album)}
              onPointerMove={onBubblePointerMove}
              onPointerUp={() => onBubblePointerUp(album)}
              onClick={(e) => {
                // Non-owner: open on click; owner uses pointerUp to avoid double-open after long-press
                if (owner) {
                  e.preventDefault()
                  return
                }
                openAlbum(album)
              }}
              onPointerCancel={clearLongPress}
              onContextMenu={(e) => {
                if (!owner) return
                e.preventDefault()
                setMenuAlbum(album)
              }}
              className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 select-none"
            >
              <div className="rounded-full bg-gradient-to-tr from-primary-500 to-accent-cyan p-[2px]">
                <div className="rounded-full bg-dark-500 p-[2px]">
                  <div
                    data-protected-media="1"
                    className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-dark-200 sm:h-16 sm:w-16"
                  >
                    {album.coverUrl ? (
                      album.coverType === 'video' ? (
                        <ProtectedMedia
                          as="video"
                          src={album.coverUrl}
                          muted
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ProtectedMedia src={album.coverUrl} alt="" className="h-full w-full object-cover" />
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
        {menuAlbum && (
          <div className="fixed inset-0 z-[92] flex items-end justify-center bg-black/50 sm:items-center">
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Cerrar"
              onClick={() => setMenuAlbum(null)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:rounded-2xl"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
                <p className="font-semibold text-[color:var(--text-primary)]">{menuAlbum.name}</p>
                <p className="text-xs text-[color:var(--text-muted)]">Opciones del álbum</p>
              </div>
              <button
                type="button"
                onClick={openCoverEditor}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-muted)]"
              >
                <FiEdit2 size={18} className="text-primary-500" />
                Editar portada
              </button>
              <button
                type="button"
                onClick={() => setMenuAlbum(null)}
                className="w-full border-t border-[color:var(--border-subtle)] px-4 py-3.5 text-center text-sm text-[color:var(--text-secondary)]"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AlbumCoverPicker
        isOpen={Boolean(coverEditor)}
        albumId={coverEditor?.albumId}
        albumItems={coverEditor?.items || []}
        onClose={() => setCoverEditor(null)}
        onSaved={() => {
          reloadAlbums()
          setCoverEditor(null)
        }}
      />

      <AnimatePresence>
        {active && item && (
          <div className="story-viewer force-dark fixed inset-0 z-[90] flex items-center justify-center bg-black">
            <div className="relative flex h-full w-full max-w-lg flex-col">
              <div className="absolute left-0 right-0 top-0 z-20 space-y-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="flex gap-1">
                  {items.map((it, i) => (
                    <div
                      key={it.id || it._id || i}
                      className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25"
                    >
                      <div
                        className="h-full bg-white transition-[width] duration-75 ease-linear"
                        style={{
                          width:
                            i < active.index
                              ? '100%'
                              : i === active.index
                                ? `${progressPct}%`
                                : '0%'
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white drop-shadow">
                      {active.album.name}
                    </p>
                    <p className="text-xs text-white/60">
                      {active.index + 1}/{items.length}
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
              </div>

              <div className="relative flex flex-1 items-center justify-center">
                <button
                  type="button"
                  className="absolute inset-y-0 left-0 z-10 w-1/3"
                  aria-label="Anterior"
                  onClick={goPrev}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 z-10 w-1/3"
                  aria-label="Siguiente"
                  onClick={goNext}
                />

                {(transitioning || !mediaReady) && (
                  <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black/40">
                    <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  </div>
                )}

                {item.mediaType === 'video' ? (
                  <ProtectedMedia
                    as="video"
                    key={item.id || item._id}
                    src={item.mediaUrl}
                    autoPlay
                    muted
                    playsInline
                    className="max-h-full max-w-full object-contain"
                    onLoadedMetadata={(e) => {
                      const d = e.currentTarget?.duration
                      if (Number.isFinite(d) && d > 0.2) {
                        const ms = Math.min(30, d) * 1000
                        durationRef.current = ms
                        remainingRef.current = ms
                      }
                      setMediaReady(true)
                    }}
                    onCanPlay={() => setMediaReady(true)}
                    onEnded={goNext}
                  />
                ) : (
                  <ProtectedMedia
                    key={item.id || item._id}
                    src={item.mediaUrl}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    onLoad={() => {
                      durationRef.current = IMAGE_MS
                      remainingRef.current = IMAGE_MS
                      setMediaReady(true)
                    }}
                    onError={() => setMediaReady(true)}
                  />
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
