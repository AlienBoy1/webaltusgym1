import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiX,
  FiUsers,
  FiMessageCircle,
  FiShare2,
  FiPlusSquare,
  FiSearch,
  FiCheck
} from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import api from '../utils/api'
import { Avatar } from '../utils/avatarUtils'
import toast from 'react-hot-toast'
import ShareComposerModal from './ShareComposerModal'
import {
  buildNativeQySiShareImage,
  buildQySiShareText
} from '../utils/buildNativeQySiShareImage'
import { getInviteUrl, getProfileUrl } from '../utils/appLinks'
import { useAuthStore } from '../store/authStore'
import { QISI_HANDLE, QISI_MEANING, QISI_NAME, QISI_USERNAME } from '../utils/qisi'
import { QYSI_AVATAR_SRC } from './QySiAvatar'
import { buildQySiSharePayload } from './QySiShareCard'
import { useHistoryBackLayer } from '../hooks/useHistoryBackLayer'

/**
 * Native share sheet for QySi profile: community / DMs / WhatsApp / stories / other apps.
 */
export default function ShareQySiSheet({ open, onClose, qysiUser }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [step, setStep] = useState('menu') // menu | community | users | external
  const [contacts, setContacts] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sharingCommunity, setSharingCommunity] = useState(false)

  const inviteUrl = getInviteUrl(user?.id || user?._id)
  const profileKey = qysiUser?.username || QISI_USERNAME
  const profileUrl = getProfileUrl(profileKey)
  const shareText = buildQySiShareText({
    sharerName: user?.name,
    profileUrl,
    inviteUrl
  })

  const defaultCommunityCopy =
    `Conocí a ${QISI_NAME} (@${QISI_HANDLE}) en Qyntra Gym 🤖\n\n` +
    `${QISI_MEANING}.\n` +
    `5 variantes listas según tu nivel — ábrelo en Entrenamientos (burbuja inferior derecha).`

  const qysiSharePayload = buildQySiSharePayload(qysiUser)

  useHistoryBackLayer(open, () => onClose?.(), 'share-qysi')

  useEffect(() => {
    if (!open) {
      setStep('menu')
      setSelected([])
      setMessage('')
      setQuery('')
      setPreview(null)
      setBusy(false)
      setSharingCommunity(false)
    }
  }, [open])

  useEffect(() => {
    if (step !== 'users') return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/users/search?q=&filter=following')
        if (!cancelled) setContacts(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setContacts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step])

  useEffect(() => {
    if (!open || step !== 'external') return undefined
    let cancelled = false
    setLoadingPreview(true)
    ;(async () => {
      try {
        const dataUrl = await buildNativeQySiShareImage({
          mode: 'external',
          sharerName: user?.name,
          avatarSrc: QYSI_AVATAR_SRC
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
  }, [open, step, user?.name])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) => {
      const name = String(c.name || '').toLowerCase()
      const username = String(c.username || '').toLowerCase()
      return name.includes(q) || username.includes(q)
    })
  }, [contacts, query])

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toFile = async (dataUrl, filename = 'qyntra-qysi.png') => {
    if (!dataUrl) return null
    const blob = await (await fetch(dataUrl)).blob()
    return new File([blob], filename, { type: 'image/png' })
  }

  const sendToUsers = async () => {
    if (selected.length === 0) return
    setSending(true)
    const caption =
      message.trim() ||
      `Te recomiendo a ${QISI_NAME} (@${QISI_HANDLE}) en Entrenamientos 🤖`
    const attachment = {
      type: 'profile',
      ...qysiSharePayload
    }
    try {
      await Promise.all(
        selected.map((to) =>
          api.post('/chat/send', {
            to,
            content: caption,
            attachment
          })
        )
      )
      toast.success(
        selected.length === 1
          ? `${QISI_NAME} enviado por chat`
          : `Enviado a ${selected.length} personas`
      )
      onClose?.()
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo enviar')
    } finally {
      setSending(false)
    }
  }

  const publishCommunity = async ({ content, mood, poll }) => {
    setSharingCommunity(true)
    try {
      await api.post('/social', {
        content: (content || defaultCommunityCopy).trim(),
        mood,
        poll,
        postType: 'workout',
        workoutData: qysiSharePayload
      })
      toast.success('Publicado en la comunidad')
      onClose?.()
      if (!window.location.pathname.includes('/social')) {
        navigate('/social')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo publicar')
      throw error
    } finally {
      setSharingCommunity(false)
    }
  }

  const shareWhatsApp = async () => {
    setBusy(true)
    try {
      const dataUrl =
        preview ||
        (await buildNativeQySiShareImage({
          mode: 'external',
          sharerName: user?.name,
          avatarSrc: QYSI_AVATAR_SRC
        }))
      const file = await toFile(dataUrl)
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: shareText,
          title: `${QISI_NAME} · Qyntra Gym`,
          url: profileUrl
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

  const shareNative = async () => {
    setBusy(true)
    try {
      const dataUrl =
        preview ||
        (await buildNativeQySiShareImage({
          mode: 'external',
          sharerName: user?.name,
          avatarSrc: QYSI_AVATAR_SRC
        }))
      const file = await toFile(dataUrl)
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: shareText,
          title: `${QISI_NAME} · Qyntra Gym`,
          url: profileUrl
        })
        onClose?.()
        return
      }
      if (navigator.share) {
        await navigator.share({
          text: shareText,
          title: `${QISI_NAME} · Qyntra Gym`,
          url: profileUrl
        })
        onClose?.()
        return
      }
      await navigator.clipboard.writeText(shareText)
      toast.success('Texto copiado')
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('No se pudo compartir')
    } finally {
      setBusy(false)
    }
  }

  const addToStories = async () => {
    setBusy(true)
    try {
      const mediaUrl = await buildNativeQySiShareImage({
        mode: 'story',
        sharerName: user?.name,
        avatarSrc: QYSI_AVATAR_SRC
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
          caption: `Conoce a ${QISI_NAME} (@${QISI_HANDLE}) · trainer inteligente en Entrenamientos 🤖`,
          fromQySi: true,
          authorName: QISI_NAME,
          snippet: QISI_MEANING
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

  if (typeof document === 'undefined' || !open) return null

  return createPortal(
    <>
      <AnimatePresence>
        {open && step === 'menu' && (
          <motion.div
            key="qysi-share-menu"
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
              className="app-bottom-sheet-panel relative w-full overflow-hidden rounded-t-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:max-w-md sm:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <img
                    src={QYSI_AVATAR_SRC}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-[rgba(var(--color-primary-rgb),0.45)]"
                  />
                  <div className="min-w-0">
                    <h3 className="font-display text-lg leading-tight">Compartir {QISI_NAME}</h3>
                    <p className="truncate text-[11px] text-[color:var(--text-secondary)]">
                      @{QISI_HANDLE} · Qyntra Gym
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 hover:bg-[color:var(--bg-muted)]"
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="space-y-1 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {[
                  {
                    id: 'community',
                    icon: FiUsers,
                    label: 'Compartir con la comunidad',
                    desc: 'Post promocional en tu feed',
                    color: 'text-primary-500',
                    action: () => setStep('community')
                  },
                  {
                    id: 'users',
                    icon: FiMessageCircle,
                    label: 'Enviar a un usuario',
                    desc: 'Como mensaje directo',
                    color: 'text-accent-cyan',
                    action: () => setStep('users')
                  },
                  {
                    id: 'stories',
                    icon: FiPlusSquare,
                    label: 'Historia premium',
                    desc: `Arte nativo con ${QISI_NAME}`,
                    color: 'text-accent-yellow',
                    action: addToStories
                  },
                  {
                    id: 'whatsapp',
                    icon: FaWhatsapp,
                    label: 'WhatsApp',
                    desc: 'Diseño nativo Qyntra',
                    color: 'text-green-500',
                    action: shareWhatsApp
                  },
                  {
                    id: 'external',
                    icon: FiShare2,
                    label: 'Otras apps',
                    desc: 'Instagram, Messenger, más…',
                    color: 'text-primary-500',
                    action: () => setStep('external')
                  }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={item.action}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[color:var(--bg-muted)] disabled:opacity-60"
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] ${item.color}`}
                    >
                      <item.icon size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block text-xs text-[color:var(--text-secondary)]">
                        {item.desc}
                      </span>
                    </span>
                    <FiShare2 className="ml-auto opacity-30" size={16} />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ShareComposerModal
        open={open && step === 'community'}
        onClose={() => {
          if (!sharingCommunity) {
            setStep('menu')
          }
        }}
        onSubmit={publishCommunity}
        title={`Compartir ${QISI_NAME}`}
        subtitle="Edita el mensaje · la tarjeta lleva al perfil"
        initialContent={defaultCommunityCopy}
        submitLabel="Publicar"
        loading={sharingCommunity}
        attachmentPreview={{
          kind: 'qysi',
          authorName: QISI_NAME,
          snippet: `${QISI_MEANING} · @${QISI_HANDLE}`,
          data: qysiSharePayload
        }}
      />

      <AnimatePresence>
        {open && step === 'users' && (
          <motion.div
            key="qysi-share-users"
            className="app-overlay-sheet fixed inset-0 z-[125] flex items-end justify-center p-0 sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setStep('menu')}
              aria-label="Cerrar"
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="app-bottom-sheet-panel relative flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:max-w-md sm:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
                <button
                  type="button"
                  className="text-sm text-primary-500"
                  onClick={() => setStep('menu')}
                >
                  Atrás
                </button>
                <h3 className="font-display text-lg">Enviar {QISI_NAME}</h3>
                <span className="w-12" />
              </div>
              <div className="border-b border-[color:var(--border-subtle)] px-3 py-2">
                <div className="relative">
                  <FiSearch
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]"
                    size={16}
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar contactos…"
                    className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--color-primary)]"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-[color:var(--text-muted)]">
                    No hay contactos
                  </p>
                ) : (
                  filtered.map((c) => {
                    const cid = c._id || c.id
                    const on = selected.includes(cid)
                    return (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => toggle(cid)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                          on ? 'bg-[rgba(var(--color-primary-rgb),0.12)]' : 'hover:bg-[color:var(--bg-muted)]'
                        }`}
                      >
                        <Avatar avatar={c.avatar} name={c.name} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.name}</span>
                          {c.username && (
                            <span className="block truncate text-xs text-[color:var(--text-secondary)]">
                              @{c.username}
                            </span>
                          )}
                        </span>
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                            on
                              ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-black'
                              : 'border-[color:var(--border-strong)]'
                          }`}
                        >
                          {on && <FiCheck size={14} />}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
              <div className="space-y-2 border-t border-[color:var(--border-subtle)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="overflow-hidden rounded-xl border border-[rgba(var(--color-primary-rgb),0.25)] bg-[color:var(--bg-muted)]/80 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                    Se enviará
                  </p>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <img
                      src={QYSI_AVATAR_SRC}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-[rgba(var(--color-primary-rgb),0.4)]"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                        {QISI_NAME}
                      </p>
                      <p className="truncate text-[11px] text-[color:var(--color-primary)]">
                        @{QISI_HANDLE} · Ver perfil
                      </p>
                    </div>
                  </div>
                </div>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Mensaje opcional…"
                  className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)]"
                />
                <button
                  type="button"
                  disabled={sending || selected.length === 0}
                  onClick={sendToUsers}
                  className="btn-primary w-full py-3 disabled:opacity-50"
                >
                  {sending
                    ? 'Enviando…'
                    : selected.length
                      ? `Enviar (${selected.length})`
                      : 'Selecciona contactos'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && step === 'external' && (
          <motion.div
            key="qysi-share-external"
            className="app-overlay-sheet fixed inset-0 z-[125] flex items-end justify-center p-0 sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setStep('menu')}
              aria-label="Cerrar"
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 36, opacity: 0 }}
              className="app-bottom-sheet-panel relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl sm:max-w-md sm:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
                <button
                  type="button"
                  className="text-sm font-medium text-primary-500"
                  onClick={() => setStep('menu')}
                >
                  Atrás
                </button>
                <h3 className="font-display text-lg">Compartir fuera</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 hover:bg-[color:var(--bg-muted)]"
                >
                  <FiX size={18} />
                </button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
                  disabled={busy}
                  onClick={shareWhatsApp}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 disabled:opacity-60"
                >
                  <FaWhatsapp size={18} /> WhatsApp
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={shareNative}
                  className="btn-secondary flex w-full items-center justify-center gap-2 py-3.5 disabled:opacity-60"
                >
                  <FiShare2 size={18} /> Compartir en otras apps
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}
