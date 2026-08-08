import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiUsers, FiShare2, FiPlusSquare, FiTarget } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { buildNativePostShareImage } from '../utils/buildNativePostShareImage'
import { buildChallengeSharePayload } from '../utils/challengeUtils'
import {
  buildChallengeInviteShareText,
  getChallengesUrl,
  getInviteUrl
} from '../utils/appLinks'
import { useAuthStore } from '../store/authStore'
import api from '../utils/api'

/**
 * Build a synthetic community-post shape so the native share canvas
 * can render the challenge invite card (same pipeline as posts).
 */
export function challengeToSharePost(challenge, user) {
  if (!challenge) return null
  const payload = buildChallengeSharePayload(challenge, { shareMode: 'invite' })
  return {
    postType: 'challenge',
    content: payload.content,
    workoutData: payload.workoutData,
    user: user
      ? {
          _id: user._id || user.id,
          id: user.id || user._id,
          name: user.name,
          avatar: user.avatar,
          username: user.username
        }
      : null,
    createdAt: new Date().toISOString()
  }
}

/**
 * Native share sheet for challenges:
 * - Comunidad → publish invite post in feed
 * - Invitar al reto → external share with generated story image (WA / FB / IG / OS)
 */
export default function ShareChallengeSheet({ open, challenge, onClose }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [publishing, setPublishing] = useState(false)
  const [sharingExternal, setSharingExternal] = useState(false)
  const [step, setStep] = useState('menu') // menu | external

  useEffect(() => {
    if (!open) setStep('menu')
  }, [open])

  const sharePost = challengeToSharePost(challenge, user)
  const challengeUrl = getChallengesUrl()
  const inviteUrl = getInviteUrl(user?.id || user?._id)

  const publishCommunity = async () => {
    if (!challenge) return
    setPublishing(true)
    try {
      const payload = buildChallengeSharePayload(challenge, { shareMode: 'invite' })
      await api.post('/social', payload)
      toast.success('Invitación publicada en Comunidad')
      onClose?.()
      navigate('/social')
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo publicar en Comunidad')
    } finally {
      setPublishing(false)
    }
  }

  const shareExternal = async () => {
    if (!challenge || !sharePost) return
    setSharingExternal(true)
    const text = buildChallengeInviteShareText({
      challengeTitle: challenge.title,
      goalLabel: sharePost.workoutData?.challengeGoal,
      unit: sharePost.workoutData?.challengeUnit,
      xp: challenge.reward?.xp || sharePost.workoutData?.rewardXp,
      inviteUrl: challengeUrl || inviteUrl
    })
    try {
      let file
      try {
        const dataUrl = await buildNativePostShareImage(sharePost)
        if (dataUrl) {
          const blob = await (await fetch(dataUrl)).blob()
          file = new File([blob], 'qyntra-reto.png', { type: 'image/png' })
        }
      } catch {
        /* text-only fallback */
      }

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text,
          title: `Reto: ${challenge.title}`,
          url: challengeUrl || inviteUrl
        })
      } else if (navigator.share) {
        await navigator.share({
          text,
          title: `Reto: ${challenge.title}`,
          url: challengeUrl || inviteUrl
        })
      } else {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          '_blank',
          'noopener,noreferrer'
        )
      }
      onClose?.()
    } catch (error) {
      if (error?.name !== 'AbortError') {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          '_blank',
          'noopener,noreferrer'
        )
      }
    } finally {
      setSharingExternal(false)
    }
  }

  const shareWhatsApp = async () => {
    if (!challenge || !sharePost) return
    setSharingExternal(true)
    const text = buildChallengeInviteShareText({
      challengeTitle: challenge.title,
      goalLabel: sharePost.workoutData?.challengeGoal,
      unit: sharePost.workoutData?.challengeUnit,
      xp: challenge.reward?.xp || sharePost.workoutData?.rewardXp,
      inviteUrl: challengeUrl || inviteUrl
    })
    try {
      let file
      try {
        const dataUrl = await buildNativePostShareImage(sharePost)
        if (dataUrl) {
          const blob = await (await fetch(dataUrl)).blob()
          file = new File([blob], 'qyntra-reto.png', { type: 'image/png' })
        }
      } catch {
        /* ignore */
      }

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text,
          title: 'Qyntra Gym',
          url: challengeUrl || inviteUrl
        })
      } else {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          '_blank',
          'noopener,noreferrer'
        )
      }
      onClose?.()
    } catch (error) {
      if (error?.name !== 'AbortError') {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          '_blank',
          'noopener,noreferrer'
        )
      }
    } finally {
      setSharingExternal(false)
    }
  }

  const addToStories = async () => {
    if (!challenge || !sharePost) return
    try {
      const mediaUrl = await buildNativePostShareImage(sharePost)
      if (!mediaUrl) {
        toast.error('No se pudo preparar la imagen del reto')
        return
      }
      sessionStorage.setItem(
        'qyntra:storyDraft',
        JSON.stringify({
          mediaUrl,
          mediaType: 'image',
          caption: `¡Únete al reto "${challenge.title}"! 🎯`,
          fromChallengeId: challenge._id || challenge.id,
          authorName: user?.name || 'Usuario',
          snippet: challenge.title
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
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && challenge && (
        <motion.div
          className="app-overlay-sheet fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
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
            className="app-bottom-sheet-panel relative w-full sm:max-w-md overflow-hidden rounded-t-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
              {step === 'external' ? (
                <button
                  type="button"
                  className="text-sm text-primary-500"
                  onClick={() => setStep('menu')}
                >
                  Atrás
                </button>
              ) : (
                <span className="w-12" />
              )}
              <h3 className="font-display text-lg">
                {step === 'external' ? 'Invitar al reto' : 'Compartir reto'}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 hover:bg-[color:var(--bg-muted)]"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-yellow/15 text-accent-yellow">
                  <FiTarget size={20} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[color:var(--text-primary)]">
                    {challenge.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[color:var(--text-secondary)]">
                    {challenge.description || 'Invita a la comunidad a unirse a este reto'}
                  </p>
                </div>
              </div>
            </div>

            {step === 'menu' ? (
              <div className="space-y-1 p-3">
                <button
                  type="button"
                  disabled={publishing}
                  onClick={publishCommunity}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[color:var(--bg-muted)] disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] text-primary-500">
                    <FiUsers size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Comunidad</span>
                    <span className="block text-xs text-[color:var(--text-secondary)]">
                      Publicar invitación en el feed
                    </span>
                  </span>
                  <FiShare2 className="ml-auto opacity-30" size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setStep('external')}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[color:var(--bg-muted)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] text-accent-yellow">
                    <FiShare2 size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Invitar al reto</span>
                    <span className="block text-xs text-[color:var(--text-secondary)]">
                      Imagen para historia en WA, FB, IG u otras apps
                    </span>
                  </span>
                  <FiShare2 className="ml-auto opacity-30" size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-1 p-3">
                <button
                  type="button"
                  disabled={sharingExternal}
                  onClick={shareExternal}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[color:var(--bg-muted)] disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] text-primary-500">
                    <FiShare2 size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {sharingExternal ? 'Preparando…' : 'Compartir imagen'}
                    </span>
                    <span className="block text-xs text-[color:var(--text-secondary)]">
                      Abre el menú nativo (WhatsApp, Instagram, Facebook…)
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={sharingExternal}
                  onClick={shareWhatsApp}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[color:var(--bg-muted)] disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] text-green-500">
                    <FaWhatsapp size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">WhatsApp</span>
                    <span className="block text-xs text-[color:var(--text-secondary)]">
                      Diseño nativo Qyntra del reto
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={addToStories}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[color:var(--bg-muted)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] text-accent-yellow">
                    <FiPlusSquare size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Añadir a historias</span>
                    <span className="block text-xs text-[color:var(--text-secondary)]">
                      Como historia en Comunidad Qyntra
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
