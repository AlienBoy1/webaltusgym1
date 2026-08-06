import { useEffect, useMemo, useState } from 'react'
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

function postSnippet(post) {
  if (!post) return 'Publicación de Qyntra Gym'
  if (post.workoutData?.name) return post.workoutData.name
  if (post.badgeData?.name) return `Insignia: ${post.badgeData.name}`
  if (post.content) {
    return String(post.content)
      .replace(/\[workout\][\s\S]*?\[\/workout\]/g, '')
      .trim()
      .slice(0, 160)
  }
  return 'Publicación de Qyntra Gym'
}

function postAuthorName(post) {
  if (typeof post?.user === 'object') return post.user?.name || 'Usuario'
  return 'Usuario'
}

async function buildWhatsAppCard(post) {
  const w = 720
  const h = 1280
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#0A0A0F')
  grad.addColorStop(0.45, '#16121A')
  grad.addColorStop(1, '#FF6B35')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.arc(w - 60, 100, 160, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 44px system-ui, sans-serif'
  ctx.fillText('QYNTRA GYM', 48, 88)

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '24px system-ui, sans-serif'
  ctx.fillText('Publicación compartida', 48, 128)

  const cardX = 36
  const cardY = 170
  const cardW = w - 72
  const cardH = 860
  ctx.fillStyle = 'rgba(16,16,22,0.94)'
  roundRect(ctx, cardX, cardY, cardW, cardH, 32)
  ctx.fill()

  // Brand accent bar
  ctx.fillStyle = '#FF6B35'
  roundRect(ctx, cardX, cardY, 10, cardH, 8)
  ctx.fill()

  const author = postAuthorName(post)
  const typeLabel =
    post.postType === 'workout' || post.workoutData
      ? 'Entrenamiento'
      : post.postType === 'challenge' || post.workoutData?.shareKind === 'challenge'
        ? 'Reto'
        : post.postType === 'badge' || post.badgeData
          ? 'Insignia'
          : post.postType === 'poll' || post.poll
            ? 'Encuesta'
            : 'Publicación'

  ctx.fillStyle = 'rgba(255,107,53,0.22)'
  roundRect(ctx, cardX + 36, cardY + 28, 180, 36, 18)
  ctx.fill()
  ctx.fillStyle = '#FFB089'
  ctx.font = 'bold 18px system-ui, sans-serif'
  ctx.fillText(typeLabel.toUpperCase(), cardX + 52, cardY + 52)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 34px system-ui, sans-serif'
  ctx.fillText(author.slice(0, 28), cardX + 36, cardY + 110)

  let y = cardY + 160
  const content = postSnippet(post)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = '28px system-ui, sans-serif'
  wrapText(ctx, content, cardX + 36, y, cardW - 72, 38)
  y += Math.min(160, Math.ceil(content.length / 28) * 38 + 20)

  const wd = post.workoutData
  if (wd) {
    const stats = [
      wd.name ? `💪 ${wd.name}` : null,
      wd.completedExercises != null
        ? `${wd.completedExercises}/${wd.totalExercises || wd.completedExercises} ejercicios`
        : null,
      wd.totalSets != null ? `${wd.totalSets} series` : null,
      wd.durationSeconds != null
        ? `${Math.floor((wd.durationSeconds || 0) / 60)} min`
        : null,
      wd.xpAwarded != null ? `+${wd.xpAwarded} XP` : null,
      wd.challengeGoal != null
        ? `Meta: ${wd.challengeGoal}${wd.challengeUnit ? ` ${wd.challengeUnit}` : ''}`
        : null
    ].filter(Boolean)

    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    roundRect(ctx, cardX + 28, y, cardW - 56, Math.max(120, stats.length * 42 + 36), 20)
    ctx.fill()

    ctx.fillStyle = '#FFFFFF'
    ctx.font = '24px system-ui, sans-serif'
    stats.forEach((line, idx) => {
      ctx.fillText(line.slice(0, 40), cardX + 48, y + 48 + idx * 42)
    })
    y += Math.max(120, stats.length * 42 + 56)
  }

  if (post.badgeData?.name) {
    ctx.fillStyle = 'rgba(234,179,8,0.18)'
    roundRect(ctx, cardX + 28, y, cardW - 56, 90, 20)
    ctx.fill()
    ctx.fillStyle = '#FACC15'
    ctx.font = 'bold 28px system-ui, sans-serif'
    ctx.fillText(`${post.badgeData.icon || '🏅'} ${post.badgeData.name}`, cardX + 48, y + 55)
    y += 110
  }

  if (post.mood) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '22px system-ui, sans-serif'
    ctx.fillText(`Estado: ${post.mood}`, cardX + 36, y + 10)
    y += 40
  }

  if (post.poll?.question) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = '24px system-ui, sans-serif'
    wrapText(ctx, `📊 ${post.poll.question}`, cardX + 36, y + 10, cardW - 72, 34)
    y += 80
  }

  const imageSrc = post.images?.[0]
  if (imageSrc && y < cardY + cardH - 240) {
    try {
      const img = await loadImage(imageSrc)
      const ih = Math.min(280, cardY + cardH - y - 40)
      const iw = cardW - 72
      ctx.save()
      roundRect(ctx, cardX + 36, y, iw, ih, 18)
      ctx.clip()
      ctx.drawImage(img, cardX + 36, y, iw, ih)
      ctx.restore()
    } catch {
      /* ignore image */
    }
  } else if (!wd && !post.badgeData && !imageSrc) {
    // Fill empty space with Qyntra message so card never looks blank
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    roundRect(ctx, cardX + 28, Math.min(y + 20, cardY + cardH - 220), cardW - 56, 180, 20)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = '26px system-ui, sans-serif'
    wrapText(
      ctx,
      content || 'Mira esta publicación en la comunidad de Qyntra Gym.',
      cardX + 52,
      Math.min(y + 80, cardY + cardH - 150),
      cardW - 104,
      36
    )
  }

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '22px system-ui, sans-serif'
  ctx.fillText('Abre Qyntra Gym para ver más', 48, h - 70)

  return canvas.toDataURL('image/png')
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(/\s+/)
  let line = ''
  let yy = y
  let lines = 0
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      line = word
      yy += lineHeight
      lines += 1
      if (lines >= 4) {
        ctx.fillText(`${line}…`, x, yy)
        return
      }
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yy)
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function postAttachment(post) {
  return {
    type: 'post',
    kind: 'share',
    postId: post._id || post.id,
    authorName: postAuthorName(post),
    snippet: postSnippet(post),
    image: post.images?.[0] || null,
    postType: post.postType || 'text'
  }
}

/**
 * Share sheet: community / DMs / WhatsApp / add to stories
 */
export default function SharePostSheet({
  open,
  post,
  onClose,
  onShareCommunity,
  sharingCommunity = false
}) {
  const navigate = useNavigate()
  const [step, setStep] = useState('menu') // menu | community | users
  const [contacts, setContacts] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [whatsLoading, setWhatsLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep('menu')
      setSelected([])
      setMessage('')
      setQuery('')
      return
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) => String(c.name || '').toLowerCase().includes(q))
  }, [contacts, query])

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const sendToUsers = async () => {
    if (!post || selected.length === 0) return
    setSending(true)
    const attachment = postAttachment(post)
    try {
      await Promise.all(
        selected.map((to) =>
          api.post('/chat/send', {
            to,
            content: message.trim(),
            attachment
          })
        )
      )
      toast.success(
        selected.length === 1
          ? 'Publicación enviada'
          : `Publicación enviada a ${selected.length} personas`
      )
      onClose?.()
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo enviar')
    } finally {
      setSending(false)
    }
  }

  const shareWhatsApp = async () => {
    if (!post) return
    setWhatsLoading(true)
    try {
      const text = `🏋️ Qyntra Gym\n${postAuthorName(post)}: ${postSnippet(post)}\n\nÚnete a la comunidad en Qyntra Gym.`
      let file
      try {
        const dataUrl = await buildWhatsAppCard(post)
        if (dataUrl) {
          const blob = await (await fetch(dataUrl)).blob()
          file = new File([blob], 'qyntra-post.png', { type: 'image/png' })
        }
      } catch {
        /* text only */
      }

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: 'Qyntra Gym' })
      } else if (navigator.share) {
        await navigator.share({ text, title: 'Qyntra Gym' })
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
      }
      onClose?.()
    } catch (error) {
      if (error?.name !== 'AbortError') {
        const text = `🏋️ Qyntra Gym\n${postAuthorName(post)}: ${postSnippet(post)}`
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
      }
    } finally {
      setWhatsLoading(false)
    }
  }

  const addToStories = async () => {
    if (!post) return
    try {
      // Always use branded card so shared stories look complete (like WhatsApp share)
      const mediaUrl = await buildWhatsAppCard(post)
      if (!mediaUrl) {
        toast.error('No se pudo preparar la miniatura')
        return
      }
      sessionStorage.setItem(
        'qyntra:storyDraft',
        JSON.stringify({
          mediaUrl,
          mediaType: 'image',
          caption: '',
          fromPostId: post._id || post.id,
          authorName: postAuthorName(post),
          snippet: postSnippet(post)
        })
      )
      onClose?.()
      // Ensure we are on a screen with StoryViewerProvider; then open compose
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

  return (
    <>
      <AnimatePresence>
        {open && step === 'menu' && (
          <motion.div
            className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-subtle)]">
                <h3 className="font-display text-lg">Compartir publicación</h3>
                <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[color:var(--bg-muted)]">
                  <FiX size={18} />
                </button>
              </div>
              <div className="p-3 space-y-1">
                {[
                  { id: 'community', icon: FiUsers, label: 'Compartir con la comunidad', desc: 'Publícala en tu feed', color: 'text-primary-500' },
                  { id: 'users', icon: FiMessageCircle, label: 'Enviar a un usuario', desc: 'Como mensaje directo', color: 'text-accent-cyan' },
                  { id: 'whatsapp', icon: FaWhatsapp, label: 'WhatsApp', desc: 'Diseño nativo Qyntra', color: 'text-green-500' },
                  { id: 'stories', icon: FiPlusSquare, label: 'Añadir a historias', desc: 'Miniatura de la publicación', color: 'text-accent-yellow' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.id === 'whatsapp' && whatsLoading}
                    onClick={() => {
                      if (item.id === 'community') setStep('community')
                      else if (item.id === 'users') setStep('users')
                      else if (item.id === 'whatsapp') shareWhatsApp()
                      else if (item.id === 'stories') addToStories()
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[color:var(--bg-muted)] transition text-left"
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)] ${item.color}`}>
                      <item.icon size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-sm">{item.label}</span>
                      <span className="block text-xs text-[color:var(--text-secondary)]">{item.desc}</span>
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
            onClose?.()
          }
        }}
        onSubmit={async (payload) => {
          await onShareCommunity?.(payload)
          setStep('menu')
        }}
        title="Compartir con la comunidad"
        subtitle="Tu comentario + la publicación original adjunta"
        initialContent=""
        submitLabel="Compartir"
        loading={sharingCommunity}
        attachmentPreview={
          post
            ? {
                authorName: postAuthorName(post),
                snippet: postSnippet(post)
              }
            : null
        }
      />

      <AnimatePresence>
        {open && step === 'users' && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4"
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
              className="relative w-full sm:max-w-md max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-subtle)]">
                <button type="button" className="text-sm text-primary-500" onClick={() => setStep('menu')}>
                  Atrás
                </button>
                <h3 className="font-display text-lg">Enviar a</h3>
                <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[color:var(--bg-muted)]">
                  <FiX size={18} />
                </button>
              </div>

              <div className="p-3 border-b border-[color:var(--border-subtle)]">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar usuarios..."
                    className="input-field w-full pl-9 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <p className="text-center text-sm text-[color:var(--text-secondary)] py-8">
                    No hay usuarios para mostrar
                  </p>
                ) : (
                  filtered.map((c) => {
                    const id = c._id || c.id
                    const on = selected.includes(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggle(id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${
                          on ? 'bg-[rgba(var(--color-primary-rgb),0.12)]' : 'hover:bg-[color:var(--bg-muted)]'
                        }`}
                      >
                        <Avatar avatar={c.avatar} name={c.name} size="sm" />
                        <span className="font-medium text-sm truncate">{c.name}</span>
                        {on && <FiCheck className="ml-auto text-primary-500" size={18} />}
                      </button>
                    )
                  })
                )}
              </div>

              <div className="p-3 border-t border-[color:var(--border-subtle)] space-y-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Mensaje adicional (opcional)"
                  className="input-field w-full text-sm"
                />
                <button
                  type="button"
                  disabled={selected.length === 0 || sending}
                  onClick={sendToUsers}
                  className="btn-primary w-full py-2.5 disabled:opacity-50"
                >
                  {sending ? 'Enviando…' : `Enviar${selected.length ? ` (${selected.length})` : ''}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
