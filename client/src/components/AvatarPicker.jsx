import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiX, FiUpload, FiCheck, FiActivity, FiTarget, FiZap, FiTrendingUp,
  FiAward, FiStar, FiHeart, FiShield, FiUser, FiCoffee, FiSun
} from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import api from '../utils/api'
import toast from 'react-hot-toast'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_OUTPUT = 1024
const JPEG_QUALITY = 0.92
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const DEFAULT_VIEWPORT = 260

const exerciseAvatars = [
  { id: 'muscle', Icon: FiActivity, gradient: 'from-orange-500 to-red-600', label: 'Fuerza' },
  { id: 'target', Icon: FiTarget, gradient: 'from-blue-500 to-cyan-600', label: 'Objetivo' },
  { id: 'energy', Icon: FiZap, gradient: 'from-green-500 to-emerald-600', label: 'Energía' },
  { id: 'trending', Icon: FiTrendingUp, gradient: 'from-purple-500 to-pink-600', label: 'Progreso' },
  { id: 'award', Icon: FiAward, gradient: 'from-indigo-500 to-blue-600', label: 'Logro' },
  { id: 'star', Icon: FiStar, gradient: 'from-red-500 to-orange-600', label: 'Estrella' },
  { id: 'heart', Icon: FiHeart, gradient: 'from-cyan-500 to-blue-600', label: 'Pasión' },
  { id: 'shield', Icon: FiShield, gradient: 'from-amber-500 to-yellow-600', label: 'Fuerza' },
  { id: 'user', Icon: FiUser, gradient: 'from-yellow-500 to-orange-600', label: 'Atleta' },
  { id: 'coffee', Icon: FiCoffee, gradient: 'from-red-600 to-pink-600', label: 'Motivación' },
  { id: 'sun', Icon: FiSun, gradient: 'from-yellow-400 to-amber-500', label: 'Vitalidad' },
  { id: 'activity2', Icon: FiActivity, gradient: 'from-gray-600 to-gray-800', label: 'Activo' }
]

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

export default function AvatarPicker({ isOpen, onClose, onSave }) {
  const { user, refreshUser } = useAuthStore()
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState('pick') // 'pick' | 'crop'
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
    setSelectedAvatar(user?.avatar || '')
    setViewportSize(computeViewportSize())
  }, [isOpen, user?.avatar])

  useEffect(() => {
    if (isOpen) resetCrop()
  }, [isOpen, resetCrop])

  useEffect(() => () => revokeObjectUrl(), [revokeObjectUrl])

  useEffect(() => {
    if (!isOpen) return undefined
    const onResize = () => setViewportSize(computeViewportSize())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [isOpen])

  // Lock body scroll while open
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

  const handleAvatarSelect = (avatarId) => {
    setSelectedAvatar(`icon:${avatarId}`)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida')
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
    const vp = computeViewportSize()
    setViewportSize(vp)

    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const base = coverScale(w, h, vp)
      const center = centeredOffset(w, h, base, vp)
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
    return coverScale(w, h, viewportSizeRef.current) * zoomRef.current
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
    const scale = getAbsoluteScale()
    const nx = drag.origX + (e.clientX - drag.startX)
    const ny = drag.origY + (e.clientY - drag.startY)
    setOffset(clampOffset(nx, ny, w, h, scale, viewportSizeRef.current))
  }

  const onPointerUp = (e) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
    }
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
      const scale = getAbsoluteScale()
      const nx = dragRef.current.origX + (t.clientX - dragRef.current.startX)
      const ny = dragRef.current.origY + (t.clientY - dragRef.current.startY)
      setOffset(clampOffset(nx, ny, w, h, scale, viewportSizeRef.current))
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
      const delta = e.deltaY > 0 ? -0.08 : 0.08
      applyZoom(zoomRef.current + delta, fx, fy)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [step, cropSrc, applyZoom])

  const exportCroppedImage = () => {
    const { w, h } = imgSize
    const canvas = canvasRef.current
    const vp = viewportSize
    if (!canvas || !cropSrc || !w || !h) return null

    const scale = coverScale(w, h, vp) * zoom
    const srcSize = vp / scale
    const sx = -offset.x / scale
    const sy = -offset.y / scale
    const outSize = Math.min(MAX_OUTPUT, Math.max(1, Math.round(srcSize)))

    canvas.width = outSize
    canvas.height = outSize
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, outSize, outSize)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, outSize, outSize)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, outSize, outSize)
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

  const persistAvatar = async (avatarValue) => {
    await api.put('/users/profile', { avatar: avatarValue })
    await refreshUser()
    onSave?.(avatarValue)
    toast.success('Avatar actualizado correctamente')
    setSelectedAvatar('')
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
      setSelectedAvatar(dataUrl)
      setStep('pick')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      console.error('Error exporting crop:', error)
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
      await persistAvatar(dataUrl)
    } catch (error) {
      console.error('Error saving cropped avatar:', error)
      toast.error(error.response?.data?.message || 'Error al guardar avatar')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!selectedAvatar) {
      toast.error('Por favor selecciona un avatar')
      return
    }
    try {
      setSaving(true)
      await persistAvatar(selectedAvatar)
    } catch (error) {
      console.error('Error saving avatar:', error)
      toast.error(error.response?.data?.message || 'Error al guardar avatar')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    resetCrop()
    onClose()
  }

  if (!isOpen) return null

  const absScale = imgSize.w ? coverScale(imgSize.w, imgSize.h, viewportSize) * zoom : 1
  const selectedIcon = selectedAvatar?.startsWith('icon:')
    ? exerciseAvatars.find((a) => a.id === selectedAvatar.replace('icon:', ''))
    : null

  const modal = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4">
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
          className="relative z-10 flex w-full sm:max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl"
          style={{
            maxHeight: 'min(92dvh, 100%)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)'
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Seleccionar avatar"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
            <h2 className="font-display text-xl text-[color:var(--text-primary)]">
              {step === 'crop' ? 'Ajustar foto' : 'Seleccionar Avatar'}
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

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {step === 'crop' ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-center text-sm text-[color:var(--text-secondary)]">
                  Arrastra para mover · pellizca o usa el control para acercar
                </p>

                <div
                  ref={viewportRef}
                  className="relative touch-none select-none cursor-grab overflow-hidden rounded-full bg-black shadow-lg ring-2 ring-[color:var(--border-subtle)] active:cursor-grabbing"
                  style={{ width: viewportSize, height: viewportSize, maxWidth: '100%' }}
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
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{ boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.25)' }}
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
              <>
                <div className="mb-5 text-center">
                  <div className="inline-block relative">
                    {selectedIcon ? (
                      <div
                        className={`mb-2 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br sm:h-32 sm:w-32 ${selectedIcon.gradient}`}
                      >
                        {(() => {
                          const PreviewIcon = selectedIcon.Icon
                          return <PreviewIcon size={48} className="text-white" />
                        })()}
                      </div>
                    ) : selectedAvatar?.startsWith('data:') || selectedAvatar?.startsWith('http') ? (
                      <div className="mb-2 h-28 w-28 overflow-hidden rounded-full ring-2 ring-[color:var(--border-subtle)] sm:h-32 sm:w-32">
                        <img src={selectedAvatar} alt="Avatar" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="mb-2 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-4xl font-bold sm:h-32 sm:w-32">
                        {user?.name?.charAt(0) || 'U'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-5">
                  <h3 className="mb-3 text-base font-semibold text-[color:var(--text-primary)]">
                    Iconos de Ejercicio
                  </h3>
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 sm:gap-4">
                    {exerciseAvatars.map((avatar) => {
                      const IconComponent = avatar.Icon
                      const isSelected = selectedAvatar === `icon:${avatar.id}`
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => handleAvatarSelect(avatar.id)}
                          className={`relative mx-auto flex aspect-square w-full max-w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-br transition-all hover:scale-105 ${avatar.gradient} ${
                            isSelected
                              ? 'ring-4 ring-[color:var(--color-primary)] ring-offset-2 ring-offset-[color:var(--bg-elevated)] shadow-lg'
                              : ''
                          }`}
                          title={avatar.label}
                          aria-label={avatar.label}
                          aria-pressed={isSelected}
                        >
                          <IconComponent size={28} className="text-white" />
                          {isSelected && (
                            <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--color-primary)] shadow-lg">
                              <FiCheck size={12} className="text-white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mb-2">
                  <h3 className="mb-3 text-base font-semibold text-[color:var(--text-primary)]">
                    Subir Imagen
                  </h3>
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
                    Subir Foto
                  </button>
                  <p className="mt-2 text-center text-xs text-[color:var(--text-muted)]">
                    Máximo 15MB · se exporta hasta 1024×1024
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Sticky footer — always visible */}
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
                  disabled={!selectedAvatar || saving}
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
