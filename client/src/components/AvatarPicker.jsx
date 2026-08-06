import { useState, useRef, useEffect, useCallback } from 'react'
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
const VIEWPORT = 280

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

export default function AvatarPicker({ isOpen, onClose, onSave }) {
  const { user, refreshUser } = useAuthStore()
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState('pick') // 'pick' | 'crop'
  const [cropSrc, setCropSrc] = useState(null)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  const viewportRef = useRef(null)
  const objectUrlRef = useRef(null)
  const dragRef = useRef(null)
  const pinchRef = useRef(null)
  const offsetRef = useRef(offset)
  const zoomRef = useRef(zoom)
  const imgSizeRef = useRef(imgSize)

  offsetRef.current = offset
  zoomRef.current = zoom
  imgSizeRef.current = imgSize

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
  }, [isOpen, user?.avatar])

  useEffect(() => {
    if (isOpen) resetCrop()
  }, [isOpen, resetCrop])

  useEffect(() => () => revokeObjectUrl(), [revokeObjectUrl])

  const applyZoom = useCallback((nextZoom, focusX, focusY) => {
    const { w, h } = imgSizeRef.current
    if (!w || !h) return
    const z = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    const base = coverScale(w, h, VIEWPORT)
    const prevScale = base * zoomRef.current
    const nextScale = base * z
    const prev = offsetRef.current

    // Zoom toward focal point inside viewport (defaults to center)
    const fx = focusX ?? VIEWPORT / 2
    const fy = focusY ?? VIEWPORT / 2
    const imgX = (fx - prev.x) / prevScale
    const imgY = (fy - prev.y) / prevScale
    let nx = fx - imgX * nextScale
    let ny = fy - imgY * nextScale
    const clamped = clampOffset(nx, ny, w, h, nextScale, VIEWPORT)
    setZoom(z)
    setOffset(clamped)
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

    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const base = coverScale(w, h, VIEWPORT)
      const center = centeredOffset(w, h, base, VIEWPORT)
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
    return coverScale(w, h, VIEWPORT) * zoomRef.current
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
    setOffset(clampOffset(nx, ny, w, h, scale, VIEWPORT))
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
      setOffset(clampOffset(nx, ny, w, h, scale, VIEWPORT))
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

  const onWheel = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = viewportRef.current?.getBoundingClientRect()
    const fx = e.clientX - (rect?.left ?? 0)
    const fy = e.clientY - (rect?.top ?? 0)
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    applyZoom(zoomRef.current + delta, fx, fy)
  }

  useEffect(() => {
    const el = viewportRef.current
    if (!el || step !== 'crop') return
    const handler = (e) => onWheel(e)
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [step, cropSrc])

  const exportCroppedImage = () => {
    const { w, h } = imgSize
    const canvas = canvasRef.current
    if (!canvas || !cropSrc || !w || !h) return null

    const scale = coverScale(w, h, VIEWPORT) * zoom
    const srcSize = VIEWPORT / scale
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
    // Sync path via already-loaded blob URL — draw after brief load
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

  const handleUsePhoto = async () => {
    try {
      setSaving(true)
      const dataUrl = await exportCroppedImage()
      if (!dataUrl) {
        toast.error('Error al procesar la imagen')
        return
      }
      setSelectedAvatar(dataUrl)
      resetCrop()
    } catch (error) {
      console.error('Error exporting crop:', error)
      toast.error('Error al procesar la imagen')
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
      await api.put('/users/profile', { avatar: selectedAvatar })
      await refreshUser()
      toast.success('Avatar actualizado correctamente')
      onSave?.(selectedAvatar)
      onClose()
      setSelectedAvatar('')
      resetCrop()
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

  const absScale = imgSize.w ? coverScale(imgSize.w, imgSize.h, VIEWPORT) * zoom : 1
  const selectedIcon = selectedAvatar?.startsWith('icon:')
    ? exerciseAvatars.find((a) => a.id === selectedAvatar.replace('icon:', ''))
    : null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Seleccionar avatar"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]">
            <h2 className="font-display text-xl sm:text-2xl text-[color:var(--text-primary)]">
              {step === 'crop' ? 'Ajustar foto' : 'Seleccionar Avatar'}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-lg text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] transition-colors"
              aria-label="Cerrar"
            >
              <FiX size={24} />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            {step === 'crop' ? (
              <div className="flex flex-col items-center gap-5">
                <p className="text-sm text-center text-[color:var(--text-secondary)]">
                  Arrastra para mover · pellizca o usa el control para acercar
                </p>

                <div
                  ref={viewportRef}
                  className="relative touch-none select-none cursor-grab active:cursor-grabbing rounded-full overflow-hidden bg-black shadow-lg ring-2 ring-[color:var(--border-subtle)]"
                  style={{ width: VIEWPORT, height: VIEWPORT, maxWidth: '100%' }}
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
                      className="absolute top-0 left-0 max-w-none pointer-events-none"
                      style={{
                        width: imgSize.w * absScale,
                        height: imgSize.h * absScale,
                        transform: `translate(${offset.x}px, ${offset.y}px)`
                      }}
                    />
                  )}
                  {/* Soft edge hint */}
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

                <div className="flex w-full gap-3">
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
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <FiCheck size={20} />
                    {saving ? 'Procesando...' : 'Usar foto'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Preview */}
                <div className="text-center mb-6">
                  <div className="inline-block relative">
                    {selectedIcon ? (
                      <div
                        className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br ${selectedIcon.gradient} flex items-center justify-center mb-2`}
                      >
                        {(() => {
                          const PreviewIcon = selectedIcon.Icon
                          return <PreviewIcon size={48} className="text-white" />
                        })()}
                      </div>
                    ) : selectedAvatar?.startsWith('data:') || selectedAvatar?.startsWith('http') ? (
                      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden mb-2 ring-2 ring-[color:var(--border-subtle)]">
                        <img src={selectedAvatar} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-4xl font-bold mb-2">
                        {user?.name?.charAt(0) || 'U'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Exercise Avatars Grid */}
                <div className="mb-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 text-[color:var(--text-primary)]">
                    Iconos de Ejercicio
                  </h3>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 sm:gap-4">
                    {exerciseAvatars.map((avatar) => {
                      const IconComponent = avatar.Icon
                      const isSelected = selectedAvatar === `icon:${avatar.id}`
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => handleAvatarSelect(avatar.id)}
                          className={`relative aspect-square w-full max-w-[4.5rem] mx-auto rounded-full bg-gradient-to-br ${avatar.gradient} flex items-center justify-center transition-all hover:scale-105 ${
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
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-[color:var(--color-primary)] rounded-full flex items-center justify-center shadow-lg">
                              <FiCheck size={12} className="text-white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Upload Image */}
                <div className="mb-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 text-[color:var(--text-primary)]">
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
                    className="btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    <FiUpload size={20} />
                    Subir Foto
                  </button>
                  <p className="mt-2 text-xs text-center text-[color:var(--text-muted)]">
                    Máximo 15MB · se exporta hasta 1024×1024
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!selectedAvatar || saving}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <FiCheck size={20} />
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Hidden canvas for export */}
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
