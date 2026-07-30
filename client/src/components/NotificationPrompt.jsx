import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiBell, FiX } from 'react-icons/fi'
import { subscribeToPush, isPushSupported } from '../utils/push'
import toast from 'react-hot-toast'

export default function NotificationPrompt({ onAccept, onDecline }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const prompted = localStorage.getItem('notificationPrompted')
    ;(async () => {
      if (prompted) return
      if (!(await isPushSupported())) return
      if (Notification.permission !== 'default') return
      setTimeout(() => setShow(true), 2000)
    })()
  }, [])

  const handleAccept = async () => {
    localStorage.setItem('notificationPrompted', 'true')
    setShow(false)

    try {
      await subscribeToPush()
      onAccept?.()
      toast.success('Notificaciones push activadas')
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      toast.error(error.message || 'No se pudieron activar las notificaciones')
    }
  }

  const handleDecline = () => {
    localStorage.setItem('notificationPrompted', 'true')
    setShow(false)
    onDecline?.()
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50"
        >
          <div className="glass rounded-2xl p-5 border border-primary-500/30 shadow-xl">
            <button
              onClick={handleDecline}
              className="absolute top-3 right-3 text-gray-400 hover:text-white"
            >
              <FiX size={20} />
            </button>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <FiBell className="text-primary-500" size={24} />
              </div>

              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">¿Activar notificaciones?</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Recibe alertas de seguidores, mensajes, publicaciones, retos y clases.
                </p>

                <div className="flex gap-2">
                  <button onClick={handleDecline} className="btn-secondary py-2 px-4 text-sm flex-1">
                    Ahora no
                  </button>
                  <button onClick={handleAccept} className="btn-primary py-2 px-4 text-sm flex-1">
                    Activar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
