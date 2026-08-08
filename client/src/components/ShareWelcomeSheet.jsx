import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiShare2, FiPlusSquare } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { buildNativeWelcomeShareImage } from '../utils/buildNativeWelcomeShareImage'
import { buildInviteMessage, getInviteUrl } from '../utils/appLinks'
import { useAuthStore } from '../store/authStore'

/**
 * Share dashboard welcome card → Historia Qyntra / apps externas.
 */
export default function ShareWelcomeSheet({
  open,
  onClose,
  greeting,
  motivation,
  motivation2,
  followers = 0,
  following = 0
}) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [step, setStep] = useState('menu')
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [busy, setBusy] = useState(false)

  const inviteUrl = getInviteUrl(user?.id || user?._id)
  const shareText = buildInviteMessage({
    inviterName: user?.name,
    inviteUrl
  })

  const payloadBase = {
    greeting,
    name: user?.name || 'Atleta',
    username: user?.username || '',
    followers,
    following,
    motivation,
    motivation2
  }

  useEffect(() => {
    if (!open) {
      setStep('menu')
      setPreview(null)
      return
    }
  }, [open])

  useEffect(() => {
    if (!open || step !== 'external') return
    let cancelled = false
    setLoadingPreview(true)
    ;(async () => {
      try {
        const dataUrl = await buildNativeWelcomeShareImage({
          ...payloadBase,
          mode: 'external'
        })
        if (!cancelled) setPreview(dataUrl)
      } catch {
        if (!cancelled) setPreview(null)
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, greeting, motivation, motivation2, followers, following, user?.name, user?.username])

  const toFile = async (dataUrl, filename = 'qyntra-bienvenida.png') => {
    if (!dataUrl) return null
    const blob = await (await fetch(dataUrl)).blob()
    return new File([blob], filename, { type: 'image/png' })
  }

  const shareNative = async () => {
    setBusy(true)
    try {
      const dataUrl =
        preview ||
        (await buildNativeWelcomeShareImage({ ...payloadBase, mode: 'external' }))
      const file = await toFile(dataUrl)
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: shareText,
          title: 'Qyntra Gym',
          url: inviteUrl
        })
        onClose?.()
        return
      }
      if (navigator.share) {
        await navigator.share({ text: shareText, title: 'Qyntra Gym', url: inviteUrl })
        onClose?.()
        return
      }
      await navigator.clipboard.writeText(shareText)
      toast.success('Invitación copiada')
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('No se pudo compartir')
    } finally {
      setBusy(false)
    }
  }

  const shareWhatsApp = async () => {
    setBusy(true)
    try {
      const dataUrl =
        preview ||
        (await buildNativeWelcomeShareImage({ ...payloadBase, mode: 'external' }))
      const file = await toFile(dataUrl)
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: shareText,
          title: 'Qyntra Gym',
          url: inviteUrl
        })
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')
      }
      onClose?.()
    } catch (error) {
      if (error?.name !== 'AbortError') {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')
      }
    } finally {
      setBusy(false)
    }
  }

  const addToStories = async () => {
    setBusy(true)
    try {
      const mediaUrl = await buildNativeWelcomeShareImage({
        ...payloadBase,
        mode: 'story'
      })
      if (!mediaUrl) {
        toast.error('No se pudo preparar la historia')
        return
      }
      sessionStorage.setItem(
        'qyntra:storyDraft',
        JSON.stringify({
          mediaUrl,
          mediaType: 'image',
          caption: '¡Sigámonos y hagamos crecer la comunidad Qyntra! 💪',
          fromWelcome: true,
          authorName: user?.name || 'Usuario',
          snippet: motivation
        })
      )
      onClose?.()
      if (!window.location.pathname.includes('/social')) {
        navigate('/social')
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('qyntra:open-story-compose'))
        }, 220)
      } else {
        window.dispatchEvent(new CustomEvent('qyntra:open-story-compose'))
      }
    } catch {
      toast.error('No se pudo añadir a historias')
    } finally {
      setBusy(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-overlay-sheet fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4"
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
            exit={{ y: 36, opacity: 0 }}
            className="app-bottom-sheet-panel relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:max-w-md sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
              {step === 'external' ? (
                <button
                  type="button"
                  className="text-sm font-medium text-primary-500"
                  onClick={() => setStep('menu')}
                >
                  Atrás
                </button>
              ) : (
                <span className="w-12" />
              )}
              <h3 className="font-display text-lg">
                {step === 'external' ? 'Compartir fuera' : 'Compartir bienvenida'}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 hover:bg-[color:var(--bg-muted)]"
              >
                <FiX size={18} />
              </button>
            </div>

            {step === 'menu' ? (
              <div className="space-y-1 p-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={addToStories}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[color:var(--bg-muted)] disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] text-primary-500">
                    <FiPlusSquare size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Historia Qyntra</span>
                    <span className="block text-xs text-[color:var(--text-secondary)]">
                      Con Seguir+ e invitación a seguirse
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep('external')}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[color:var(--bg-muted)] disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] text-primary-500">
                    <FiShare2 size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Otras apps</span>
                    <span className="block text-xs text-[color:var(--text-secondary)]">
                      WhatsApp, Instagram, Messenger…
                    </span>
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-black/30">
                  {loadingPreview ? (
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-primary-500" />
                  ) : preview ? (
                    <img
                      src={preview}
                      alt="Vista previa"
                      className="max-h-[48vh] w-full object-contain"
                    />
                  ) : (
                    <p className="p-4 text-center text-sm text-[color:var(--text-muted)]">
                      Sin vista previa
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy || loadingPreview}
                  onClick={shareNative}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[color:var(--bg-muted)] disabled:opacity-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] text-primary-500">
                    <FiShare2 size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Compartir</span>
                    <span className="block text-xs text-[color:var(--text-secondary)]">
                      Con logo e invitación a unirse
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy || loadingPreview}
                  onClick={shareWhatsApp}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[color:var(--bg-muted)] disabled:opacity-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                    <FaWhatsapp size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">WhatsApp</span>
                    <span className="block text-xs text-[color:var(--text-secondary)]">
                      Enviar card + enlace
                    </span>
                  </span>
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
