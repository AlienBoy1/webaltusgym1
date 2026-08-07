import { useEffect, useRef, useState } from 'react'
import api from '../utils/api'
import ProtectedMedia from './ProtectedMedia'

/**
 * Renders feed images. If the list payload omitted heavy base64, hydrates
 * when the card approaches the viewport (or immediately if eager).
 */
export default function FeedPostImages({
  postId,
  images: initialImages = [],
  imagesOmitted = false,
  eager = false,
  onHydrated,
  onOpenViewer
}) {
  const rootRef = useRef(null)
  const fetchedRef = useRef(false)
  const [images, setImages] = useState(() =>
    Array.isArray(initialImages) ? initialImages : []
  )
  const [loading, setLoading] = useState(
    Boolean(imagesOmitted && !(initialImages && initialImages.length))
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (Array.isArray(initialImages) && initialImages.length) {
      setImages(initialImages)
      setLoading(false)
      setFailed(false)
    }
  }, [initialImages])

  useEffect(() => {
    if (!imagesOmitted || images.length || fetchedRef.current) return undefined

    const fetchImages = async () => {
      if (fetchedRef.current) return
      fetchedRef.current = true
      setLoading(true)
      try {
        const { data } = await api.get(`/social/${postId}/images`, { timeout: 22000 })
        const next = Array.isArray(data?.images) ? data.images : []
        setImages(next)
        setFailed(false)
        onHydrated?.(postId, next)
      } catch {
        setFailed(true)
        fetchedRef.current = false
      } finally {
        setLoading(false)
      }
    }

    if (eager) {
      fetchImages()
      return undefined
    }

    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      fetchImages()
      return undefined
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          obs.disconnect()
          fetchImages()
        }
      },
      { root: null, rootMargin: '280px 0px', threshold: 0.01 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [postId, imagesOmitted, images.length, eager, onHydrated])

  if (!imagesOmitted && !images.length) return null

  if (loading && !images.length) {
    return (
      <div
        ref={rootRef}
        className="mb-3 sm:mb-4 h-44 sm:h-56 animate-pulse rounded-xl bg-[color:var(--bg-elevated)]"
        aria-hidden
      />
    )
  }

  if (failed && !images.length) {
    return (
      <div ref={rootRef} className="mb-3 sm:mb-4">
        <button
          type="button"
          onClick={() => {
            fetchedRef.current = false
            setFailed(false)
            setLoading(true)
            api
              .get(`/social/${postId}/images`, { timeout: 22000 })
              .then(({ data }) => {
                const next = Array.isArray(data?.images) ? data.images : []
                fetchedRef.current = true
                setImages(next)
                onHydrated?.(postId, next)
              })
              .catch(() => setFailed(true))
              .finally(() => setLoading(false))
          }}
          className="flex w-full items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-4 py-6 text-sm text-[color:var(--text-secondary)]"
        >
          Reintentar carga de fotos
        </button>
      </div>
    )
  }

  if (!images.length) return <div ref={rootRef} />

  return (
    <div
      ref={rootRef}
      data-no-post-open
      className={`mb-3 sm:mb-4 grid gap-1.5 sm:gap-2 ${
        images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
      }`}
    >
      {images.map((img, idx) => (
        <button
          key={idx}
          type="button"
          data-protected-media="1"
          onClick={() => onOpenViewer?.(idx, images)}
          className="group relative overflow-hidden rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ProtectedMedia
            src={img}
            alt={`Post ${idx + 1}`}
            loading="lazy"
            decoding="async"
            className={`w-full object-cover transition duration-300 group-hover:scale-[1.02] ${
              images.length === 1 ? 'max-h-[280px] sm:max-h-[400px]' : 'h-36 sm:h-48'
            }`}
          />
          <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
        </button>
      ))}
    </div>
  )
}
