import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiShare2, FiCopy, FiCheck } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { buildNativeProfileShareImage } from '../utils/buildNativeProfileShareImage'
import { getInviteUrl } from '../utils/appLinks'

function profileShareText(user, inviteUrl) {
  const name = user?.name || 'Usuario'
  return (
    `🏋️ Mira mi perfil en Qyntra Gym\n` +
    `${name}\n\n` +
    `Únete a la comunidad:\n${inviteUrl}`
  )
}

/**
 * Share own profile card (image + invite link) via native sheet / WhatsApp.
 */
export default function ShareProfileSheet({ open, onClose, user }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const inviteUrl = getInviteUrl(user?.id || user?._id)
  const text = profileShareText(user, inviteUrl)

  useEffect(() => {
    if (!open || !user) {
      setPreview(null)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const dataUrl = await buildNativeProfileShareImage(user)
        if (!cancelled) setPreview(dataUrl)
      } catch {
        if (!cancelled) {
          setPreview(null)
          toast.error('No se pudo preparar la imagen del perfil')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, user])

  const toFile = async () => {
    if (!preview) return null
    const blob = await (await fetch(preview)).blob()
    return new File([blob], 'qyntra-perfil.png', { type: 'image/png' })
  }

  const shareNative = async () => {
    setSharing(true)
    try {
      const file = await toFile()
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text,
          title: 'Mi perfil · Qyntra Gym',
          url: inviteUrl
        })
        onClose?.()
        return
      }
      if (navigator.share) {
        await navigator.share({ text, title: 'Mi perfil · Qyntra Gym', url: inviteUrl })
        onClose?.()
        return
      }
      await navigator.clipboard.writeText(text)
      toast.success('Invitación copiada')
    } catch (error) {
      if (error?.name !== 'AbortError') {
        toast.error('No se pudo compartir')
      }
    } finally {
      setSharing(false)
    }
  }

  const shareWhatsApp = async () => {
    setSharing(true)
    try {
      const file = await toFile()
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text,
          title: 'Mi perfil · Qyntra Gym',
          url: inviteUrl
        })
        onClose?.()
        return
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
      onClose?.()
    } catch (error) {
      if (error?.name !== 'AbortError') {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
      }
    } finally {
      setSharing(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success('Vínculo copiado')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Cerrar"
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="relative w-full sm:max-w-md max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-subtle)]">
              <h3 className="font-display text-lg">Compartir perfil</h3>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[color:var(--bg-muted)]"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-sm text-[color:var(--text-secondary)]">
                Así se verá tu perfil al compartirlo. Incluye el vínculo para unirse a Qyntra Gym.
              </p>

              <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-black/40 overflow-hidden flex items-center justify-center min-h-[220px]">
                {loading ? (
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-primary-500" />
                ) : preview ? (
                  <img src={preview} alt="Vista previa del perfil" className="w-full h-auto max-h-[52vh] object-contain" />
                ) : (
                  <p className="text-sm text-[color:var(--text-muted)] p-6 text-center">
                    No hay vista previa disponible
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  disabled={sharing || loading || !preview}
                  onClick={shareNative}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[color:var(--bg-muted)] transition text-left disabled:opacity-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] text-primary-500">
                    <FiShare2 size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-sm">Compartir</span>
                    <span className="block text-xs text-[color:var(--text-secondary)]">
                      WhatsApp, Messenger, SMS y más
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={sharing || loading}
                  onClick={shareWhatsApp}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[color:var(--bg-muted)] transition text-left disabled:opacity-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] text-green-500">
                    <FaWhatsapp size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-sm">WhatsApp</span>
                    <span className="block text-xs text-[color:var(--text-secondary)]">
                      Imagen + vínculo de invitación
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={copyLink}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[color:var(--bg-muted)] transition text-left"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] text-accent-cyan">
                    {copied ? <FiCheck size={20} /> : <FiCopy size={20} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-sm">Copiar vínculo</span>
                    <span className="block text-xs text-[color:var(--text-secondary)] truncate">
                      {inviteUrl}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
