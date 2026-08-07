import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiUpload, FiCheck } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import api from '../utils/api'
import toast from 'react-hot-toast'

/** Matches profile hero banner (~full width × 168–236px). */
const COVER_ASPECT = 2.4
const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_OUTPUT_W = 1600
const JPEG_QUALITY = 0.88
const MIN_ZOOM = 1
const MAX_ZOOM = 4

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function coverScale(imgW, imgH, frameW, frameH) {
  return Math.max(frameW / imgW, frameH / imgH)
}

function clampOffset(ox, oy, imgW, imgH, scale, frameW, frameH) {
  const drawW = imgW * scale
  const drawH = imgH * scale
  const minX = frameW - drawW
  const minY = frameH - drawH
  return {
    x: clamp(ox, Math.min(0, minX), Math.max(0, minX)),
    y: clamp(oy, Math.min(0, minY), Math.max(0, minY))
  }
}

function centeredOffset(imgW, imgH, scale, frameW, frameH) {
  return {
    x: (frameW - imgW * scale) / 2,
    y: (frameH - imgH * scale) / 2
  }
}

function pinchDistance(t1, t2) {
  const dx = t1.clientX - t2.clientX
  const dy = t1.clientY - t2.clientY
  return Math.hypot(dx, dy)
}

function computeFrameSize() {
  if (typeof window === 'undefined') return { w: 360, h: Math.round(360 / COVER_ASPECT) }
  const maxW = Math.min(window.innerWidth - 32, 520)
  const maxH = Math.floor(window.innerHeight * 0.3)
  let w = maxW
  let h = w / COVER_ASPECT
  if (h > maxH) {
    h = Math.max(120, maxH)
    w = h * COVER_ASPECT
  }
  return { w: Math.round(w), h: Math.round(h) }
}

export default function CoverPicker({ isOpen, onClose, onSave, currentCover = null }) {
  const { user, refreshUser, updateUser } = useAuthStore()
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState('pick') // 'pick' | 'crop'
  const [cropSrc, setCropSrc] = useState(null)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [frame, setFrame] = useState(() => computeFrameSize())

  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  const viewportRef = useRef(null)
  const objectUrlRef = useRef(null)
  const dragRef = useRef(null)
  const pinchRef = useRef(null)
  const offsetRef = useRef(offset)
  const zoomRef = useRef(zoom)
  const imgSizeRef = useRef(imgSize)
  const frameRef = useRef(frame)

  offsetRef.current = offset
  zoomRef.current = zoom
  imgSizeRef.current = imgSize
  frameRef.current = frame

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const resetCrop = useCallback(() => {
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
    setPreview(null)
    setFrame(computeFrameSize())
    resetCrop()
  }, [isOpen, resetCrop])

  useEffect(() => () => revokeObjectUrl(), [revokeObjectUrl])

  useEffect(() => {
    if (!isOpen) return undefined
    const onResize = () => setFrame(computeFrameSize())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [isOpen])

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
    const { w: fw, h: fh } = frameRef.current
    if (!w || !h) return
    const z = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    const base = coverScale(w, h, fw, fh)
    const prevScale = base * zoomRef.current
    const nextScale = base * z
    const prev = offsetRef.current
    const fx = focusX ?? fw / 2
    const fy = focusY ?? fh / 2
    const imgX = (fx - prev.x) / prevScale
    const imgY = (fy - prev.y) / prevScale
    const nx = fx - imgX * nextScale
    const ny = fy - imgY * nextScale
    setZoom(z)
    setOffset(clampOffset(nx, ny, w, h, nextScale, fw, fh))
  }, [])

  const handleImageUpload = (e) => {
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
    const nextFrame = computeFrameSize()
    setFrame(nextFrame)

    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const base = coverScale(w, h, nextFrame.w, nextFrame.h)
      const center = centeredOffset(w, h, base, nextFrame.w, nextFrame.h)
      setImgSize({ w, h })
      setZoom(1)
      setOffset(center)
      setCropSrc(url)
      setStep('crop')
    }
    img.onerror = () => {
      toast.error('Error al cargar la imagen')
      revokeObjectUrl()
      e.target.value = ''
    }
    img.src = url
  }

  const getAbsoluteScale = useCallback(() => {
    const { w, h } = imgSizeRef.current
    const { w: fw, h: fh } = frameRef.current
    return coverScale(w, h, fw, fh) * zoomRef.current
  }, [])

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
    const { w: fw, h: fh } = frameRef.current
    const scale = getAbsoluteScale()
    const nx = drag.origX + (e.clientX - drag.startX)
    const ny = drag.origY + (e.clientY - drag.startY)
    setOffset(clampOffset(nx, ny, w, h, scale, fw, fh))
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

  const onTouchMove = (e) => {
    e.preventDefault()
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = pinchDistance(e.touches[0], e.touches[1])
      const ratio = dist / pinchRef.current.dist
      const rect = viewportRef.current?.getBoundingClientRect()
      const cx = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - (rect?.left ?? 0)
      const cy = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - (rect?.top ?? 0)
      applyZoom(pinchRef.current.zoom * ratio, cx, cy)
      return
    }
    if (e.touches.length === 1 && dragRef.current?.pointerId === 'touch') {
      const t = e.touches[0]
      const { w, h } = imgSizeRef.current
      const { w: fw, h: fh } = frameRef.current
      const scale = getAbsoluteScale()
      const nx = dragRef.current.origX + (t.clientX - dragRef.current.startX)
      const ny = dragRef.current.origY + (t.clientY - dragRef.current.startY)
      setOffset(clampOffset(nx, ny, w, h, scale, fw, fh))
    }
  }

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
    const handler = (e) => {
      e.preventDefault()
      e.stopPropagation()
      const rect = viewportRef.current?.getBoundingClientRect()
      const fx = e.clientX - (rect?.left ?? 0)
      const fy = e.clientY - (rect?.top ?? 0)
      applyZoom(zoomRef.current + (e.deltaY > 0 ? -0.08 : 0.08), fx, fy)
    }
    el.addEventListener('wheel', handler, { Passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [step, cropSrc, applyZoom])

  const exportCroppedImage = () => {
    const { w, h } = imgSize
    const { w: fw, h: fh } = frame
    const canvas = canvasRef.current
    if (!canvas || !cropSrc || !w || !h) return null

    const scale = coverScale(w, h, fw, fh) * zoom
    const srcW = fw / scale
    const srcH = fh / scale
    const sx = -offset.x / scale
    const sy = -offset.y / scale
    const outW = Math.min(MAX_OUTPUT_W, Math.max(1, Math.round(srcW)))
    const outH = Math.max(1, Math.round(outW / COVER_ASPECT))

    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, outW, outH)
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, outW, outH)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, outW, outH)
          let dataUrl
          try {
            dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
          } catch {
            dataUrl = canvas.toDataURL('image/png')
          }
          resolve(dataUrl)
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error('No se pudo exportar la imagen'))
      img.src = cropSrc
    })
  }

  const persistCover = async (coverUrl) => {
    const { data } = await api.put('/users/profile', {
      profile: { ...(user?.profile || {}), coverUrl }
    })
    if (data?.user) updateUser(data.user)
    else await refreshUser()
    onSave?.(coverUrl)
    toast.success('Portada actualizada')
    setPreview(null)
    resetCrop()
    onClose()
  }

  const handleUsePhoto = async () => {
    try {
      setSaving(true)
      const dataUrl = await exportCroppedImage()
      if (!dataUrl) {
        toast.error('Error al procesar la imagen')
        return
      }
      revokeObjectUrl()
      setCropSrc(null)
      setImgSize({ w: 0, h: 0 })
      setZoom(1)
      setOffset({ x: 0, y: 0 })
      setPreview(dataUrl)
      setStep('pick')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      console.error(error)
      toast.error('Error al procesar la imagen')
    } finally {
      setSaving(false)
    }
  }

  const handleCropAndSave = async () => {
    try {
      setSaving(true)
      const dataUrl = await exportCroppedImage()
      if (!dataUrl) {
        toast.error('Error al procesar la imagen')
        return
      }
      await persistCover(dataUrl)
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Error al guardar portada')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!preview) {
      toast.error('Sube y ajusta una foto primero')
      return
    }
    try {
      setSaving(true)
      await persistCover(preview)
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Error al guardar portada')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setPreview(null)
    resetCrop()
    onClose()
  }

  if (!isOpen) return null

  const absScale = imgSize.w
    ? coverScale(imgSize.w, imgSize.h, frame.w, frame.h) * zoom
    : 1
  const displayPreview = preview || currentCover

  const modal = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4">
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label="Cerrar"
          onClick={handleClose}
        />
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28 }}
          className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:rounded-2xl"
          style={{
            maxHeight: 'min(92dvh, 100%)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)'
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Ajustar foto de portada"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
            <h2 className="font-display text-xl text-[color:var(--text-primary)]">
              {step === 'crop' ? 'Ajustar portada' : 'Foto de portada'}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-2 text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-muted)]"
              aria-label="Cerrar"
            >
              <FiX size={22} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {step === 'crop' ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-center text-sm text-[color:var(--text-secondary)]">
                  Arrastra para mover · pellizca o usa el control para acercar
                </p>

                <div
                  ref={viewportRef}
                  className="relative touch-none select-none cursor-grab overflow-hidden rounded-xl bg-black shadow-lg ring-2 ring-[color:var(--border-subtle)] active:cursor-grabbing"
                  style={{ width: frame.w, height: frame.h, maxWidth: '100%' }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
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
                  <div
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }}
                  />
                </div>

                <div className="w-full max-w-sm space-y-2">
                  <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)]">
                    <span>Alejar</span>
                    <span>Zoom {zoom.toFixed(1)}×</span>
                    <span>Acercar</span>
                  </div>
                  <input
                    type="range"
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => applyZoom(Number(e.target.value))}
                    className="w-full accent-[color:var(--color-primary)]"
                    aria-label="Zoom"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-center text-sm text-[color:var(--text-secondary)]">
                    Previsualización
                  </p>
                  <div
                    className="mx-auto overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]"
                    style={{
                      width: '100%',
                      maxWidth: frame.w,
                      aspectRatio: `${COVER_ASPECT} / 1`
                    }}
                  >
                    {displayPreview ? (
                      <img
                        src={displayPreview}
                        alt="Portada"
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-[color:var(--text-muted)]">
                        Sin portada
                      </div>
                    )}
                  </div>
                  {preview && (
                    <p className="mt-2 text-center text-xs font-medium text-primary-500">
                      Nueva foto lista · pulsa Guardar para aplicar
                    </p>
                  )}
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className="btn-secondary flex w-full items-center justify-center gap-2"
                  >
                    <FiUpload size={20} />
                    {displayPreview ? 'Elegir otra foto' : 'Subir foto'}
                  </button>
                  <p className="mt-2 text-center text-xs text-[color:var(--text-muted)]">
                    Máximo 15MB · se adapta al banner del perfil
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-4 py-3">
            {step === 'crop' ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={resetCrop}
                  disabled={saving}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUsePhoto}
                  disabled={saving}
                  className="btn-secondary flex-1"
                >
                  Vista previa
                </button>
                <button
                  type="button"
                  onClick={handleCropAndSave}
                  disabled={saving}
                  className="btn-primary flex flex-1 items-center justify-center gap-2"
                >
                  <FiCheck size={18} />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button type="button" onClick={handleClose} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!preview || saving}
                  className="btn-primary flex flex-1 items-center justify-center gap-2"
                >
                  <FiCheck size={18} />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        </motion.div>
      </div>
    </AnimatePresence>
  )

  return createPortal(modal, document.body)
}
