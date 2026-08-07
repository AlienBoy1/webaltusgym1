import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiUpload, FiCheck, FiImage } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../utils/api'
import ProtectedMedia from './ProtectedMedia'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_OUTPUT = 1024
const JPEG_QUALITY = 0.92
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const DEFAULT_VIEWPORT = 260

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function coverScale(imgW, imgH, viewport) {
  return viewport / Math.min(imgW, imgH)
}

function clampOffset(ox, oy, imgW, imgH, scale, viewport) {
  const drawW = imgW * scale
  const drawH = imgH * scale
  const minX = viewport - drawW
  const minY = viewport - drawH
  return {
    x: clamp(ox, Math.min(0, minX), Math.max(0, minX)),
    y: clamp(oy, Math.min(0, minY), Math.max(0, minY))
  }
}

function centeredOffset(imgW, imgH, scale, viewport) {
  return {
    x: (viewport - imgW * scale) / 2,
    y: (viewport - imgH * scale) / 2
  }
}

function pinchDistance(t1, t2) {
  const dx = t1.clientX - t2.clientX
  const dy = t1.clientY - t2.clientY
  return Math.hypot(dx, dy)
}

function computeViewportSize() {
  if (typeof window === 'undefined') return DEFAULT_VIEWPORT
  const byWidth = window.innerWidth - 48
  const byHeight = Math.floor(window.innerHeight * 0.34)
  return Math.max(180, Math.min(DEFAULT_VIEWPORT, byWidth, byHeight))
}

/**
 * Circle crop / pick cover for a favorites album — same UX as avatar picker.
 */
export default function AlbumCoverPicker({
  isOpen,
  onClose,
  albumId,
  albumItems = [],
  onSaved
}) {
  const [step, setStep] = useState('pick') // pick | crop
  const [saving, setSaving] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [viewportSize, setViewportSize] = useState(DEFAULT_VIEWPORT)

  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  const viewportRef = useRef(null)
  const objectUrlRef = useRef(null)
  const dragRef = useRef(null)
  const pinchRef = useRef(null)
  const offsetRef = useRef(offset)
  const zoomRef = useRef(zoom)
  const imgSizeRef = useRef(imgSize)
  const viewportSizeRef = useRef(viewportSize)

  offsetRef.current = offset
  zoomRef.current = zoom
  imgSizeRef.current = imgSize
  viewportSizeRef.current = viewportSize

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    revokeObjectUrl()
    setCropSrc(null)
    setImgSize({ w: 0, h: 0 })
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setStep('pick')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [revokeObjectUrl])

  useEffect(() => {
    if (!isOpen) return
    setViewportSize(computeViewportSize())
    reset()
  }, [isOpen, reset])

  useEffect(() => () => revokeObjectUrl(), [revokeObjectUrl])

  useEffect(() => {
    if (!isOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const applyZoom = useCallback((nextZoom, focusX, focusY) => {
    const { w, h } = imgSizeRef.current
    const vp = viewportSizeRef.current
    if (!w || !h) return
    const z = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    const base = coverScale(w, h, vp)
    const prevScale = base * zoomRef.current
    const nextScale = base * z
    const prev = offsetRef.current
    const fx = focusX ?? vp / 2
    const fy = focusY ?? vp / 2
    const imgX = (fx - prev.x) / prevScale
    const imgY = (fy - prev.y) / prevScale
    const nx = fx - imgX * nextScale
    const ny = fy - imgY * nextScale
    setZoom(z)
    setOffset(clampOffset(nx, ny, w, h, nextScale, vp))
  }, [])

  const beginCropFromUrl = (url, revokeLater = false) => {
    const vp = computeViewportSize()
    setViewportSize(vp)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const base = coverScale(w, h, vp)
      setImgSize({ w, h })
      setZoom(1)
      setOffset(centeredOffset(w, h, base, vp))
      setCropSrc(url)
      setStep('crop')
    }
    img.onerror = () => {
      toast.error('No se pudo cargar la imagen')
      if (revokeLater) revokeObjectUrl()
    }
    img.src = url
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen válida')
      e.target.value = ''
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error('La imagen debe ser menor a 15MB')
      e.target.value = ''
      return
    }
    revokeObjectUrl()
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    beginCropFromUrl(url, true)
  }

  const pickAlbumItem = async (item) => {
    if (!item?.mediaUrl) return
    if (item.mediaType === 'video') {
      try {
        setSaving(true)
        await api.patch(`/stories/favorites/albums/${albumId}`, {
          favoriteId: item._id || item.id
        })
        toast.success('Portada actualizada')
        onSaved?.(item.mediaUrl)
        reset()
        onClose()
      } catch (err) {
        toast.error(err.response?.data?.message || 'No se pudo guardar')
      } finally {
        setSaving(false)
      }
      return
    }
    beginCropFromUrl(item.mediaUrl)
  }

  const getAbsoluteScale = () => {
    const { w, h } = imgSizeRef.current
    return coverScale(w, h, viewportSizeRef.current) * zoomRef.current
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'touch') return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: offsetRef.current.x,
      origY: offsetRef.current.y
    }
  }

  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const { w, h } = imgSizeRef.current
    const scale = getAbsoluteScale()
    setOffset(
      clampOffset(
        drag.origX + (e.clientX - drag.startX),
        drag.origY + (e.clientY - drag.startY),
        w,
        h,
        scale,
        viewportSizeRef.current
      )
    )
  }

  const onPointerUp = (e) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      dragRef.current = null
      pinchRef.current = {
        dist: pinchDistance(e.touches[0], e.touches[1]),
        zoom: zoomRef.current
      }
      return
    }
    if (e.touches.length === 1) {
      pinchRef.current = null
      const t = e.touches[0]
      dragRef.current = {
        pointerId: 'touch',
        startX: t.clientX,
        startY: t.clientY,
        origX: offsetRef.current.x,
        origY: offsetRef.current.y
      }
    }
  }

  const applyTouchMove = useCallback(
    (e) => {
      if (e.touches.length === 2 && pinchRef.current) {
        const dist = pinchDistance(e.touches[0], e.touches[1])
        const ratio = dist / pinchRef.current.dist
        const rect = viewportRef.current?.getBoundingClientRect()
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - (rect?.left ?? 0)
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - (rect?.top ?? 0)
        applyZoom(pinchRef.current.zoom * ratio, cx, cy)
        return
      }
      if (e.touches.length === 1 && dragRef.current?.pointerId === 'touch') {
        const t = e.touches[0]
        const { w, h } = imgSizeRef.current
        const scale = getAbsoluteScale()
        setOffset(
          clampOffset(
            dragRef.current.origX + (t.clientX - dragRef.current.startX),
            dragRef.current.origY + (t.clientY - dragRef.current.startY),
            w,
            h,
            scale,
            viewportSizeRef.current
          )
        )
      }
    },
    [applyZoom]
  )

  const onTouchEnd = (e) => {
    if (e.touches.length < 2) pinchRef.current = null
    if (e.touches.length === 0) dragRef.current = null
    if (e.touches.length === 1) {
      const t = e.touches[0]
      dragRef.current = {
        pointerId: 'touch',
        startX: t.clientX,
        startY: t.clientY,
        origX: offsetRef.current.x,
        origY: offsetRef.current.y
      }
    }
  }

  useEffect(() => {
    const el = viewportRef.current
    if (!el || step !== 'crop') return undefined
    const onTouchMoveNative = (e) => {
      e.preventDefault()
      applyTouchMove(e)
    }
    el.addEventListener('touchmove', onTouchMoveNative, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMoveNative)
  }, [step, cropSrc, applyTouchMove])

  const exportCropped = () => {
    const { w, h } = imgSize
    const canvas = canvasRef.current
    if (!canvas || !cropSrc || !w || !h) return null
    const scale = coverScale(w, h, viewportSize) * zoom
    const srcSize = viewportSize / scale
    const sx = -offset.x / scale
    const sy = -offset.y / scale
    const out = Math.min(MAX_OUTPUT, Math.max(1, Math.round(srcSize)))
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, out, out)
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(out / 2, out / 2, out / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, out, out)
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error('export'))
      img.src = cropSrc
    })
  }

  const handleSaveCrop = async () => {
    try {
      setSaving(true)
      const dataUrl = await exportCropped()
      if (!dataUrl) {
        toast.error('Error al procesar la imagen')
        return
      }
      await api.patch(`/stories/favorites/albums/${albumId}`, { coverUrl: dataUrl })
      toast.success('Portada actualizada')
      onSaved?.(dataUrl)
      reset()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const absScale = imgSize.w ? coverScale(imgSize.w, imgSize.h, viewportSize) * zoom : 1
  const imageItems = (albumItems || []).filter((i) => i.mediaUrl)

  const modal = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4">
        <button type="button" className="absolute inset-0" aria-label="Cerrar" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:rounded-2xl"
          style={{ maxHeight: 'min(92dvh, 100%)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
            <h2 className="font-display text-xl text-[color:var(--text-primary)]">
              {step === 'crop' ? 'Ajustar portada' : 'Editar portada'}
            </h2>
            <button
              type="button"
              onClick={() => {
                reset()
                onClose()
              }}
              className="rounded-lg p-2 text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]"
            >
              <FiX size={22} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {step === 'crop' ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-center text-sm text-[color:var(--text-secondary)]">
                  Arrastra para mover · pellizca para acercar
                </p>
                <div
                  ref={viewportRef}
                  className="relative touch-none select-none cursor-grab overflow-hidden rounded-full bg-black shadow-lg ring-2 ring-[color:var(--border-subtle)] active:cursor-grabbing"
                  style={{ width: viewportSize, height: viewportSize }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onTouchStart={onTouchStart}
                  onTouchEnd={onTouchEnd}
                  onTouchCancel={onTouchEnd}
                >
                  {cropSrc && imgSize.w > 0 && (
                    <img
                      src={cropSrc}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute left-0 top-0 max-w-none"
                      style={{
                        width: imgSize.w * absScale,
                        height: imgSize.h * absScale,
                        transform: `translate(${offset.x}px, ${offset.y}px)`
                      }}
                    />
                  )}
                </div>
                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => applyZoom(Number(e.target.value))}
                  className="w-full max-w-sm accent-[color:var(--color-primary)]"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary flex w-full items-center justify-center gap-2"
                >
                  <FiUpload size={18} />
                  Subir desde galería
                </button>
                {imageItems.length > 0 && (
                  <>
                    <p className="flex items-center gap-1.5 text-sm text-[color:var(--text-secondary)]">
                      <FiImage size={14} />
                      O elige una del álbum
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {imageItems.map((item) => (
                        <button
                          key={item._id || item.id}
                          type="button"
                          disabled={saving}
                          onClick={() => pickAlbumItem(item)}
                          className="aspect-square overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-black"
                        >
                          {item.mediaType === 'video' ? (
                            <ProtectedMedia
                              as="video"
                              src={item.mediaUrl}
                              muted
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ProtectedMedia
                              src={item.mediaUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[color:var(--border-subtle)] px-4 py-3">
            {step === 'crop' ? (
              <div className="flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={() => setStep('pick')} disabled={saving}>
                  Atrás
                </button>
                <button
                  type="button"
                  className="btn-primary flex flex-1 items-center justify-center gap-2"
                  onClick={handleSaveCrop}
                  disabled={saving}
                >
                  <FiCheck size={18} />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            ) : (
              <button type="button" className="btn-secondary w-full" onClick={onClose}>
                Cancelar
              </button>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        </motion.div>
      </div>
    </AnimatePresence>
  )

  return createPortal(modal, document.body)
}
