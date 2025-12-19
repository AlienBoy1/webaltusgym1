import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FiX, FiUpload, FiCheck, FiActivity, FiTarget, FiZap, FiTrendingUp, 
  FiAward, FiStar, FiHeart, FiShield, FiUser, FiCoffee, FiSun
} from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import api from '../utils/api'
import toast from 'react-hot-toast'

// Exercise-themed avatars with icon components and gradient backgrounds
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

export default function AvatarPicker({ isOpen, onClose, onSave }) {
  const { user, refreshUser } = useAuthStore()
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)

  // Update selectedAvatar when user changes or modal opens
  useEffect(() => {
    if (isOpen && user?.avatar) {
      setSelectedAvatar(user.avatar)
    } else if (isOpen && !user?.avatar) {
      setSelectedAvatar('')
    }
  }, [isOpen, user?.avatar])

  const handleAvatarSelect = (avatarId) => {
    const avatar = exerciseAvatars.find(a => a.id === avatarId)
    if (avatar) {
      // Store as icon identifier instead of emoji
      setSelectedAvatar(`icon:${avatarId}`)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 5MB')
      return
    }

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const img = new Image()
        img.onload = () => {
          const canvas = canvasRef.current
          if (!canvas) return

          const size = Math.min(img.width, img.height)
          const x = (img.width - size) / 2
          const y = (img.height - size) / 2

          canvas.width = 200
          canvas.height = 200
          const ctx = canvas.getContext('2d')

          // Draw circular avatar
          ctx.beginPath()
          ctx.arc(100, 100, 100, 0, 2 * Math.PI)
          ctx.clip()

          ctx.drawImage(img, x, y, size, size, 0, 0, 200, 200)

          const dataUrl = canvas.toDataURL('image/png')
          setSelectedAvatar(dataUrl)
          setUploading(false)
        }
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error processing image:', error)
      toast.error('Error al procesar la imagen')
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedAvatar) {
      toast.error('Por favor selecciona un avatar')
      return
    }

    try {
      setUploading(true)
      const { data } = await api.put('/users/profile', { avatar: selectedAvatar })
      await refreshUser()
      toast.success('Avatar actualizado correctamente')
      onSave?.(selectedAvatar)
      onClose()
      setSelectedAvatar('')
    } catch (error) {
      console.error('Error saving avatar:', error)
      toast.error(error.response?.data?.message || 'Error al guardar avatar')
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl">Seleccionar Avatar</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>

          {/* Preview */}
          <div className="text-center mb-6">
            <div className="inline-block relative">
              {selectedAvatar?.startsWith('icon:') ? (
                <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${
                  exerciseAvatars.find(a => a.id === selectedAvatar.replace('icon:', ''))?.gradient || 'from-primary-500 to-primary-700'
                } flex items-center justify-center mb-4`}>
                  {(() => {
                    const avatar = exerciseAvatars.find(a => a.id === selectedAvatar.replace('icon:', ''))
                    const IconComponent = avatar?.Icon || FiUser
                    return <IconComponent size={48} className="text-white" />
                  })()}
                </div>
              ) : selectedAvatar?.startsWith('data:') || selectedAvatar?.startsWith('http') ? (
                <div className="w-32 h-32 rounded-full overflow-hidden mb-4">
                  <img src={selectedAvatar} alt="Avatar" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-4xl font-bold mb-4">
                  {user?.name?.charAt(0) || 'U'}
                </div>
              )}
            </div>
          </div>

          {/* Exercise Avatars Grid */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Iconos de Ejercicio</h3>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
              {exerciseAvatars.map((avatar) => {
                const IconComponent = avatar.Icon
                const isSelected = selectedAvatar === `icon:${avatar.id}`
                return (
                  <button
                    key={avatar.id}
                    onClick={() => handleAvatarSelect(avatar.id)}
                    className={`relative w-16 h-16 rounded-full bg-gradient-to-br ${avatar.gradient} flex items-center justify-center transition-all hover:scale-110 ${
                      isSelected ? 'ring-4 ring-primary-500 ring-offset-2 ring-offset-dark-900 shadow-lg' : ''
                    }`}
                    title={avatar.label}
                  >
                    <IconComponent size={28} className="text-white" />
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center shadow-lg">
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
            <h3 className="text-lg font-semibold mb-4">Subir Imagen</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <FiUpload size={20} />
              {uploading ? 'Procesando...' : 'Subir Foto'}
            </button>
          </div>

          {/* Hidden canvas for image processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedAvatar || uploading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <FiCheck size={20} />
              Guardar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

