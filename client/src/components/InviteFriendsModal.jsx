import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiX,
  FiShare2,
  FiCopy,
  FiCheck,
  FiMessageSquare
} from 'react-icons/fi'
import { FaWhatsapp, FaTelegramPlane, FaFacebookMessenger, FaInstagram } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { buildInviteMessage, getInviteUrl } from '../utils/appLinks'

/**
 * Preview invitation + native share sheet / channel fallbacks.
 */
export default function InviteFriendsModal({ open, onClose, user }) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const inviteUrl = useMemo(
    () => getInviteUrl(user?.id || user?._id),
    [user?.id, user?._id]
  )

  const inviteText = useMemo(
    () =>
      buildInviteMessage({
        inviterName: user?.name,
        inviteUrl
      }),
    [user?.name, inviteUrl]
  )

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success('Vínculo copiado')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar el vínculo')
    }
  }

  const shareNative = async () => {
    setSharing(true)
    try {
      if (navigator.share) {
        const payload = {
          title: 'Únete a Qyntra Gym',
          text: inviteText,
          url: inviteUrl
        }
        if (navigator.canShare?.(payload) !== false) {
          await navigator.share(payload)
          onClose?.()
          return
        }
      }
      await copyLink()
      toast('Comparte el vínculo desde tus apps favoritas', { icon: '🔗' })
    } catch (error) {
      if (error?.name !== 'AbortError') {
        toast.error('No se pudo abrir el menú de compartir')
      }
    } finally {
      setSharing(false)
    }
  }

  const openExternal = (href) => {
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const channels = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: FaWhatsapp,
      color: 'text-green-500',
      onClick: () =>
        openExternal(`https://wa.me/?text=${encodeURIComponent(inviteText)}`)
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: FaTelegramPlane,
      color: 'text-sky-400',
      onClick: () =>
        openExternal(
          `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(
            inviteText.replace(inviteUrl, '').trim()
          )}`
        )
    },
    {
      id: 'messenger',
      label: 'Messenger',
      icon: FaFacebookMessenger,
      color: 'text-blue-400',
      onClick: () => {
        // Mobile deep link; desktop falls back to copy
        const deep = `fb-messenger://share/?link=${encodeURIComponent(inviteUrl)}`
        window.location.href = deep
        window.setTimeout(() => {
          copyLink()
        }, 600)
      }
    },
    {
      id: 'sms',
      label: 'Mensaje',
      icon: FiMessageSquare,
      color: 'text-accent-cyan',
      onClick: () => {
        openExternal(`sms:?&body=${encodeURIComponent(inviteText)}`)
      }
    },
    {
      id: 'instagram',
      label: 'Instagram',
      icon: FaInstagram,
      color: 'text-pink-400',
      onClick: async () => {
        await copyLink()
        toast('Vínculo copiado: pégalo en Instagram', { icon: '📷' })
      }
    },
    {
      id: 'copy',
      label: 'Copiar vínculo',
      icon: copied ? FiCheck : FiCopy,
      color: copied ? 'text-green-500' : 'text-primary-500',
      onClick: copyLink
    }
  ]

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
            className="relative w-full sm:max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-subtle)]">
              <h3 className="font-display text-lg">Invitar a amigos</h3>
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
                Vista previa de tu invitación. Compártela por la app o canal que prefieras.
              </p>

              <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] p-4 space-y-3">
                <p className="text-xs uppercase tracking-wide text-primary-500 font-semibold">
                  Qyntra Gym
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{inviteText}</p>
                <p className="text-xs text-primary-500 break-all font-medium">{inviteUrl}</p>
              </div>

              <button
                type="button"
                disabled={sharing}
                onClick={shareNative}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FiShare2 size={18} />
                {sharing ? 'Abriendo…' : 'Compartir invitación'}
              </button>

              <div>
                <p className="text-xs text-[color:var(--text-muted)] mb-2 px-0.5">
                  O elige un canal
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {channels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={ch.onClick}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[color:var(--border-subtle)] hover:bg-[color:var(--bg-muted)] transition"
                    >
                      <ch.icon size={22} className={ch.color} />
                      <span className="text-[11px] text-center leading-tight">{ch.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
