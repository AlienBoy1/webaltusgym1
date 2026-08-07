import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiSend,
  FiSearch,
  FiArrowLeft,
  FiPlus,
  FiX,
  FiSmile,
  FiMessageCircle,
  FiImage,
  FiPaperclip,
  FiMic,
  FiMoreVertical,
  FiUser,
  FiTrash2,
  FiBookmark,
  FiFile,
  FiActivity,
  FiCornerUpLeft,
  FiLink
} from 'react-icons/fi'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import { onChatEvent, sendTyping, showNotification, requestNotificationPermission } from '../../utils/socket'
import { Avatar } from '../../utils/avatarUtils'
import toast from 'react-hot-toast'
import { useStoryViewer } from '../../components/StoryViewerContext'
import PresenceDot from '../../components/PresenceDot'
import { getPresenceMeta, PRESENCE_STATUS, usePresenceStatus } from '../../utils/presence'
import { useAppDialog } from '../../components/AppDialog'
import ChatEmojiPicker from '../../components/ChatEmojiPicker'
import ProtectedMedia from '../../components/ProtectedMedia'
import ChatWallpaper, {
  CHAT_WALLPAPER_NONE,
  CHAT_WALLPAPER_STYLES,
  getChatWallpaper,
  isStyledWallpaper,
  setChatWallpaper
} from '../../components/ChatWallpaper'
import UserNoteBadge from '../../components/UserNoteBadge'
import VoiceNotePlayer from '../../components/VoiceNotePlayer'
import ChatVoiceComposer from '../../components/ChatVoiceComposer'
import ChatImageComposer from '../../components/ChatImageComposer'
import { ViewOnceAttachmentBubble } from '../../components/ViewOnceMedia'
import SwipeToReply from '../../components/SwipeToReply'
import { buildReplyPayload } from '../../utils/chatMessage'
import { useChatStore } from '../../store/chatStore'
import TutorialHelpButton from '../../components/TutorialHelpButton'
import { TUTORIAL_IDS } from '../../tutorials/registry'
import { addChatShortcut } from '../../utils/chatShortcuts'
import { compressImageFile } from '../../utils/compressImage'

const MESSAGING_DISABLED_COPY =
  'Este usuario tiene la mensajería desactivada por ahora. Podrás escribirle cuando la active; inténtalo de nuevo más tarde.'

function isMessagingDisabledUser(u) {
  if (!u) return false
  if (u.allowMessages === false) return true
  if (u.settings?.privacy?.allowMessages === false) return true
  return false
}

function isRenderableAvatar(avatar) {
  if (!avatar || typeof avatar !== 'string') return false
  if (avatar.startsWith('data:') || avatar.startsWith('http') || avatar.startsWith('icon:')) return true
  // Single letter / emoji placeholders are NOT real photos
  return false
}

const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_AUDIO_SEC = 60

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

function formatRecordingTime(sec) {
  const s = Math.floor(sec || 0)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function attachmentPreviewLabel(attachment) {
  if (!attachment) return ''
  if (attachment.viewOnce) {
    if (attachment.opened || !attachment.url) {
      return attachment.type === 'audio' ? '🎤 Audio abierto' : '📷 Foto abierta'
    }
    return attachment.type === 'audio' ? '🎤 Audio · 1 vista' : '📷 Foto · 1 vista'
  }
  if (attachment.type === 'image') return '📷 Imagen'
  if (attachment.type === 'file') return attachment.name ? `📎 ${attachment.name}` : '📎 Archivo'
  if (attachment.type === 'audio') return '🎤 Audio'
  return ''
}

function ReplyQuote({ reply, isMe, compact = false, onClick }) {
  if (!reply?.id) return null
  const typeHint =
    reply.attachmentType === 'image'
      ? '📷 Foto'
      : reply.attachmentType === 'audio'
        ? '🎤 Audio'
        : reply.attachmentType === 'file'
          ? '📎 Archivo'
          : reply.attachmentType === 'post'
            ? '📝 Publicación'
            : reply.attachmentType === 'story'
              ? '📸 Estado'
              : null
  return (
    <button
      type="button"
      data-no-swipe
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(reply.id)
      }}
      className={`mb-2 w-full overflow-hidden rounded-lg border-l-[3px] px-2.5 py-1.5 text-left transition ${
        compact ? 'text-[12px]' : 'text-[13px]'
      } ${
        isMe
          ? 'border-white/80 bg-black/15 text-white/90 hover:bg-black/20'
          : 'border-[color:var(--color-primary)] bg-black/5 text-[color:var(--text-primary)] hover:bg-black/10'
      }`}
    >
      <span className={`block truncate font-semibold ${isMe ? 'text-white' : 'text-[color:var(--color-primary)]'}`}>
        {reply.senderName || 'Usuario'}
      </span>
      <span className={`block truncate ${isMe ? 'text-white/75' : 'text-[color:var(--text-secondary)]'}`}>
        {reply.text || typeHint || 'Mensaje'}
      </span>
    </button>
  )
}

function MessageTicks({ status, isMe }) {
  if (!status) return null
  const read = status === 'read'
  const delivered = status === 'delivered' || read
  return (
    <span
      className="ml-1 inline-flex items-end text-[11px] leading-none tracking-tighter"
      style={{
        color: read
          ? '#53bdeb'
          : isMe
            ? 'rgba(255,255,255,0.72)'
            : 'var(--text-muted)'
      }}
      title={read ? 'Leído' : delivered ? 'Entregado' : 'Enviado'}
    >
      {delivered ? '✓✓' : '✓'}
    </span>
  )
}

function PostAttachmentBubble({ attachment, isMe, hasText, onOpen }) {
  if (!attachment || attachment.type !== 'post') return null
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.(attachment)
      }}
      className={`w-full overflow-hidden rounded-xl text-left transition hover:opacity-95 active:scale-[0.99] ${
        hasText ? 'mb-2' : ''
      } ${isMe ? 'bg-black/15' : 'bg-black/30'}`}
    >
      <div className="flex items-stretch gap-0">
        <div
          data-protected-media="1"
          className="relative h-[72px] w-[54px] shrink-0 overflow-hidden bg-gradient-to-br from-primary-500/40 to-black sm:h-20 sm:w-[60px]"
        >
          {attachment.image ? (
            <ProtectedMedia src={attachment.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg">📝</div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-2">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isMe ? 'text-white/65' : 'text-gray-400'}`}>
            {isMe ? 'Compartiste una publicación' : 'Te compartió una publicación'}
          </p>
          <p className={`mt-0.5 text-xs font-medium ${isMe ? 'text-white/90' : 'text-gray-200'}`}>
            {attachment.authorName || 'Usuario'}
          </p>
          <p className={`mt-0.5 line-clamp-2 text-xs leading-snug ${isMe ? 'text-white/75' : 'text-gray-300'}`}>
            {attachment.snippet || 'Publicación de Qyntra'}
          </p>
          <p className={`mt-1 text-[10px] font-medium ${isMe ? 'text-white/80' : 'text-primary-400'}`}>
            Tocar para ver →
          </p>
        </div>
      </div>
    </button>
  )
}

function StoryAttachmentBubble({ attachment, isMe, hasText, onOpen }) {
  if (!attachment || attachment.type !== 'story') return null
  const isReply = attachment.kind === 'reply' || hasText
  const label = isMe
    ? isReply
      ? 'Respondiste a un estado'
      : 'Compartiste un estado'
    : isReply
      ? 'Respondió a tu estado'
      : 'Te compartió un estado'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.(attachment)
      }}
      className={`w-full overflow-hidden rounded-xl text-left transition hover:opacity-95 active:scale-[0.99] ${
        hasText ? 'mb-2' : ''
      } ${isMe ? 'bg-black/15' : 'bg-black/30'}`}
    >
      <div className="flex items-stretch gap-0">
        <div
          data-protected-media="1"
          className="relative h-[72px] w-[54px] shrink-0 overflow-hidden bg-black sm:h-20 sm:w-[60px]"
        >
          {attachment.mediaType === 'video' ? (
            <>
              <ProtectedMedia
                as="video"
                src={attachment.mediaUrl}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 text-[10px] font-bold text-white">
                ▶
              </span>
            </>
          ) : (
            <ProtectedMedia
              src={attachment.mediaUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/20" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-2">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isMe ? 'text-white/65' : 'text-gray-400'}`}>
            {label}
          </p>
          <p className={`mt-0.5 line-clamp-2 text-xs leading-snug ${isMe ? 'text-white/90' : 'text-gray-200'}`}>
            {attachment.caption?.trim() || 'Estado de Qyntra'}
          </p>
          <p className={`mt-1 text-[10px] ${isMe ? 'text-white/50' : 'text-primary-300'}`}>
            Toca para ver el estado
          </p>
        </div>
      </div>
    </button>
  )
}

function ImageAttachmentBubble({ attachment, isMe, hasText }) {
  if (!attachment || attachment.type !== 'image') return null
  if (attachment.viewOnce) return null
  if (!attachment.url) return null
  return (
    <div className={`overflow-hidden rounded-xl ${hasText ? 'mb-2' : ''} ${isMe ? 'bg-black/10' : 'bg-black/20'}`}>
      {String(attachment.url).startsWith('data:') ? (
        <img src={attachment.url} alt="" className="max-h-64 max-w-full object-cover" />
      ) : (
        <ProtectedMedia src={attachment.url} alt="" className="max-h-64 max-w-full object-cover" />
      )}
    </div>
  )
}

function FileAttachmentBubble({ attachment, isMe, hasText }) {
  if (!attachment || attachment.type !== 'file' || !attachment.url) return null
  const sizeKb = attachment.size ? `${Math.round(attachment.size / 1024)} KB` : null
  return (
    <a
      href={attachment.url}
      download={attachment.name || 'archivo'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition hover:opacity-95 ${
        hasText ? 'mb-2' : ''
      } ${isMe ? 'bg-black/15 text-white' : 'bg-black/30 text-[color:var(--text-primary)]'}`}
    >
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isMe ? 'bg-white/15' : 'bg-[color:var(--bg-muted)]'}`}>
        <FiFile size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{attachment.name || 'Archivo'}</span>
        {sizeKb && (
          <span className={`text-[11px] ${isMe ? 'text-white/65' : 'text-[color:var(--text-muted)]'}`}>{sizeKb}</span>
        )}
      </span>
    </a>
  )
}

function AudioAttachmentBubble({ attachment, isMe, hasText, avatar, name }) {
  if (!attachment || attachment.type !== 'audio') return null
  if (attachment.viewOnce) return null
  if (!attachment.url) return null
  return (
    <div className={hasText ? 'mb-2' : ''}>
      <VoiceNotePlayer
        src={attachment.url}
        durationSec={attachment.durationSec}
        isMe={isMe}
        avatar={avatar}
        name={name}
      />
    </div>
  )
}

function ChatBottomSheet({ open, onClose, title, children }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3.5">
              <h2 className="font-display text-xl text-[color:var(--text-primary)]">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
                aria-label="Cerrar"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default function Chat() {
  const { user } = useAuthStore()
  const dialog = useAppDialog()
  const navigate = useNavigate()
  const location = useLocation()
  const { openUserStory, openStoryById } = useStoryViewer()
  const conversations = useChatStore((s) => s.conversations)
  const setConversations = useChatStore((s) => s.setConversations)
  const listLoading = useChatStore((s) => s.loading)
  const listLoaded = useChatStore((s) => s.loaded)
  const prefetchConversations = useChatStore((s) => s.prefetch)
  const [selectedChat, setSelectedChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [search, setSearch] = useState('')
  const [storyUsers, setStoryUsers] = useState(() => new Set())
  const [showNewChat, setShowNewChat] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [userFilter, setUserFilter] = useState('all')
  const [sending, setSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [peerTyping, setPeerTyping] = useState(false)
  const [wallpaperId, setWallpaperId] = useState(CHAT_WALLPAPER_NONE)
  const [showThreadMenu, setShowThreadMenu] = useState(false)
  const [showSharedSheet, setShowSharedSheet] = useState(false)
  const [showRoutinesSheet, setShowRoutinesSheet] = useState(false)
  const [showWallpaperSheet, setShowWallpaperSheet] = useState(false)
  const [sharedItems, setSharedItems] = useState([])
  const [sharedLoading, setSharedLoading] = useState(false)
  const [sharedFilter, setSharedFilter] = useState('posts') // posts | files | links
  const [publicRoutines, setPublicRoutines] = useState([])
  const [routinesLoading, setRoutinesLoading] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState(null)
  const [imageDraft, setImageDraft] = useState(null)
  const [voiceSession, setVoiceSession] = useState(false)
  const [voiceMode, setVoiceMode] = useState('recording') // recording | paused
  const [voiceViewOnce, setVoiceViewOnce] = useState(false)
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(null)
  const [recording, setRecording] = useState(false)
  const [recordingSec, setRecordingSec] = useState(0)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const replyToRef = useRef(null)
  const [msgAction, setMsgAction] = useState(null) // { msg, x, y } for long-press
  const messagesEndRef = useRef(null)
  const messagesScrollRef = useRef(null)
  const inputRef = useRef(null)
  const imageInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const threadMenuRef = useRef(null)
  const threadMenuDropdownRef = useRef(null)
  const selectedChatRef = useRef(null)
  const pendingStoryReply = useRef(null)
  const typingClearRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordingTimerRef = useRef(null)
  const recordingChunksRef = useRef([])
  const recordingSecRef = useRef(0)
  const durationAtStopRef = useRef(0)
  const streamRef = useRef(null)
  const mimeRef = useRef('')
  const stopActionRef = useRef('preview') // preview | send | discard
  const voiceViewOnceRef = useRef(false)
  const selectedPresence = usePresenceStatus(selectedChat?.otherId)

  useEffect(() => {
    replyToRef.current = replyTo
  }, [replyTo])

  useEffect(() => {
    selectedChatRef.current = selectedChat
  }, [selectedChat])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/stories/feed')
        if (cancelled) return
        const ids = new Set(
          (data?.groups || [])
            .filter((g) => g.stories?.length)
            .map((g) => g.user?._id || g.user)
            .filter(Boolean)
        )
        setStoryUsers(ids)
      } catch {
        if (!cancelled) setStoryUsers(new Set())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user?._id) return

    const handleNewMessage = (data) => {
      // Ack delivery; mark read if this thread is open
      if (data.from) {
        if (selectedChatRef.current?.otherId === data.from) {
          api.post(`/chat/read/${data.from}`).catch(() => {})
        } else {
          api.post(`/chat/delivered/${data.from}`).catch(() => {})
        }
      }
      showNotification(`${data.fromName}`, data.message, {
        tag: `msg-${data.from}`,
        onClick: () => navigate('/chat')
      })

      if (selectedChatRef.current?.otherId !== data.from) {
        toast.success(`${data.fromName}: ${data.message}`, { duration: 4000 })
      }

      if (selectedChatRef.current?.otherId === data.from) {
        setMessages((prev) => {
          if (data.id && prev.some((m) => m.id === data.id)) return prev
          return [
            ...prev,
            {
              id: data.id || Date.now(),
              sender: 'other',
              text: data.text ?? data.message ?? '',
              attachment: data.attachment || null,
              reply: data.reply || null,
              time: new Date(data.timestamp || Date.now()).toLocaleTimeString('es', {
                hour: '2-digit',
                minute: '2-digit'
              })
            }
          ]
        })
      }

      setConversations((prev) => {
        const existing = prev.find((c) => c.otherId === data.from)
        if (existing) {
          return prev.map((c) =>
            c.otherId === data.from
              ? {
                  ...c,
                  lastMessage: data.message,
                  time: 'Ahora',
                  lastFromMe: false,
                  unread:
                    selectedChatRef.current?.otherId === data.from
                      ? 0
                      : (Number(c.unread) || 0) + 1
                }
              : c
          )
        }
        return [
          {
            id: data.from,
            otherId: data.from,
            name: data.fromName,
            avatar: data.fromName?.charAt(0) || '👤',
            lastMessage: data.message,
            time: 'Ahora',
            lastFromMe: false,
            unread: 1
          },
          ...prev
        ]
      })
    }

    const handleMessageStatus = (data) => {
      if (!data?.id) return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id
            ? {
                ...m,
                delivered: data.delivered ?? m.delivered,
                read: data.read ?? m.read,
                status: data.status || (data.read ? 'read' : data.delivered ? 'delivered' : m.status || 'sent'),
                ...(data.contentUpdated
                  ? {
                      text: data.text ?? m.text,
                      attachment: data.attachment !== undefined ? data.attachment : m.attachment,
                      reply: data.reply !== undefined ? data.reply : m.reply
                    }
                  : null)
              }
            : m
        )
      )
    }

    const unsubMessage = onChatEvent('newMessage', handleNewMessage)
    const unsubStatus = onChatEvent('messageStatus', handleMessageStatus)

    const handleTyping = (payload) => {
      const from = payload?.from
      if (!from || selectedChatRef.current?.otherId !== from) return
      setPeerTyping(true)
      if (typingClearRef.current) window.clearTimeout(typingClearRef.current)
      typingClearRef.current = window.setTimeout(() => setPeerTyping(false), 2200)
    }
    const unsubTyping = onChatEvent('userTyping', handleTyping)

    requestNotificationPermission()
    fetchConversations()

    return () => {
      unsubMessage()
      unsubStatus()
      unsubTyping()
      if (typingClearRef.current) window.clearTimeout(typingClearRef.current)
    }
  }, [user?._id, navigate])

  useEffect(() => {
    if (selectedChat?.otherId) {
      document.body.dataset.chatThread = '1'
      if (isStyledWallpaper(wallpaperId)) {
        document.body.dataset.chatStyled = '1'
      } else {
        delete document.body.dataset.chatStyled
      }
      window.dispatchEvent(new CustomEvent('qyntra:chat-thread'))
    } else {
      delete document.body.dataset.chatThread
      delete document.body.dataset.chatStyled
      window.dispatchEvent(new CustomEvent('qyntra:chat-thread'))
    }
    return () => {
      delete document.body.dataset.chatThread
      delete document.body.dataset.chatStyled
      window.dispatchEvent(new CustomEvent('qyntra:chat-thread'))
    }
  }, [selectedChat?.otherId, wallpaperId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (selectedChat?.otherId) {
      fetchMessages(selectedChat.otherId)
    }
  }, [selectedChat?.otherId])

  // Fill missing conversation avatars after inbox loads
  useEffect(() => {
    const missing = (conversations || []).filter((c) => c.otherId && !isRenderableAvatar(c.avatar))
    if (!missing.length) return
    let cancelled = false
    ;(async () => {
      const updates = {}
      await Promise.all(
        missing.slice(0, 20).map(async (c) => {
          try {
            const { data } = await api.get(`/users/${c.otherId}`)
            if (isRenderableAvatar(data?.avatar)) {
              updates[c.otherId] = {
                avatar: data.avatar,
                name: data.name || c.name,
                username: data.username || c.username
              }
            }
          } catch {
            /* ignore */
          }
        })
      )
      if (cancelled || !Object.keys(updates).length) return
      setConversations((list) =>
        list.map((c) => (updates[c.otherId] ? { ...c, ...updates[c.otherId] } : c))
      )
      setSelectedChat((prev) =>
        prev?.otherId && updates[prev.otherId] ? { ...prev, ...updates[prev.otherId] } : prev
      )
    })()
    return () => {
      cancelled = true
    }
    // Only re-check when partner set / avatar presence changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length, conversations.filter((c) => !isRenderableAvatar(c.avatar)).map((c) => c.otherId).join(',')])

  useEffect(() => {
    if (!showThreadMenu) return
    const onDocClick = (e) => {
      const inTrigger = threadMenuRef.current?.contains(e.target)
      const inMenu = threadMenuDropdownRef.current?.contains(e.target)
      if (!inTrigger && !inMenu) {
        setShowThreadMenu(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('touchstart', onDocClick)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
    }
  }, [showThreadMenu])

  const fetchConversations = async () => {
    await prefetchConversations()
  }

  const fetchMessages = async (otherId) => {
    try {
      const { data } = await api.get(`/chat/messages/${otherId}`)
      setMessages(data)
      setConversations((convs) =>
        convs.map((c) => (c.otherId === otherId ? { ...c, unread: 0 } : c))
      )

      const pending = pendingStoryReply.current
      if (pending && pending.to === otherId) {
        pendingStoryReply.current = null
        try {
          const { data: sent } = await api.post('/chat/send', {
            to: otherId,
            content: pending.text || '',
            attachment: pending.attachment
          })
          setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]))
          setConversations((convs) =>
            convs.map((c) =>
              c.otherId === otherId
                ? {
                    ...c,
                    lastMessage: pending.text?.trim() || '📸 Estado de Qyntra',
                    time: 'Ahora'
                  }
                : c
            )
          )
        } catch (error) {
          toast.error(error.response?.data?.message || 'No se pudo enviar la respuesta')
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
      setMessages([])
    }
  }

  const handleSelectChat = (conv) => {
    setShowEmoji(false)
    setPeerTyping(false)
    const next = { ...conv, otherId: conv.otherId || conv.oderId }
    setSelectedChat(next)
    // Hydrate full profile photo if the list had a slim / missing avatar
    if (next.otherId && !isRenderableAvatar(next.avatar)) {
      ;(async () => {
        try {
          const { data } = await api.get(`/users/${next.otherId}`)
          const avatar = data?.avatar || data?.user?.avatar || null
          if (!isRenderableAvatar(avatar)) return
          setSelectedChat((prev) =>
            prev?.otherId === next.otherId ? { ...prev, avatar, name: data?.name || prev.name, username: data?.username || prev.username } : prev
          )
          setConversations((list) =>
            list.map((c) =>
              c.otherId === next.otherId
                ? { ...c, avatar, name: data?.name || c.name, username: data?.username || c.username }
                : c
            )
          )
        } catch {
          /* keep fallback initial */
        }
      })()
    }
  }

  const handleBack = () => {
    setShowEmoji(false)
    setShowAttachMenu(false)
    setPeerTyping(false)
    setSelectedChat(null)
  }

  const insertEmoji = (emoji) => {
    const el = inputRef.current
    const value = newMessage || ''
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = value.slice(0, start) + emoji + value.slice(end)
      setNewMessage(next)
      window.requestAnimationFrame(() => {
        el.focus()
        const pos = start + emoji.length
        el.setSelectionRange(pos, pos)
      })
    } else {
      setNewMessage(value + emoji)
      inputRef.current?.focus()
    }
  }

  const handleSend = async (e) => {
    e?.preventDefault?.()
    const msgText = newMessage.trim()
    const attachment = pendingAttachment
    if ((!msgText && !attachment) || !selectedChat || sending || recording || voiceSession) return
    await sendChatPayload({ text: msgText, attachment, reply: replyToRef.current || replyTo })
  }

  const sendChatPayload = async ({ text = '', attachment = null, reply = null } = {}) => {
    const msgText = String(text || '').trim()
    if ((!msgText && !attachment) || !selectedChat || sending) return false

    const activeReply = reply || replyToRef.current || replyTo
    const tempId = `temp-${Date.now()}`
    setNewMessage('')
    setShowEmoji(false)
    setPendingAttachment(null)
    setImageDraft(null)
    setReplyTo(null)
    replyToRef.current = null
    setSending(true)

    const previewText = msgText || attachmentPreviewLabel(attachment)
    const tempMsg = {
      id: tempId,
      sender: 'me',
      text: msgText,
      attachment: attachment || null,
      reply: activeReply || null,
      status: 'sent',
      time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    }
    setMessages((prev) => [...prev, tempMsg])

    try {
      const { data } = await api.post('/chat/send', {
        to: selectedChat.otherId,
        content: msgText,
        attachment: attachment || undefined,
        reply: activeReply || undefined
      })
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...data } : m)))
      setConversations((convs) =>
        convs.map((c) =>
          c.otherId === selectedChat.otherId
            ? {
                ...c,
                lastMessage: previewText,
                time: 'Ahora',
                lastFromMe: true
              }
            : c
        )
      )
      return true
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      if (!attachment) setNewMessage(msgText)
      if (attachment?.type === 'image') setImageDraft(attachment)
      else if (attachment) setPendingAttachment(attachment)
      if (activeReply) {
        setReplyTo(activeReply)
        replyToRef.current = activeReply
      }
      const apiMsg = error.response?.data?.message || ''
      const messagingBlocked =
        error.response?.status === 403 ||
        /no acepta mensajes/i.test(apiMsg) ||
        /allowMessages/i.test(apiMsg)
      if (messagingBlocked) {
        await dialog.alert(MESSAGING_DISABLED_COPY, {
          title: 'Mensajería no disponible',
          confirmLabel: 'Entendido',
          tone: 'info'
        })
      } else {
        toast.error(apiMsg || 'Error al enviar mensaje')
      }
      return false
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const beginReply = (msg) => {
    const payload = buildReplyPayload(msg, {
      myName: 'Tú',
      otherName: selectedChat?.name || 'Usuario'
    })
    if (!payload) {
      toast.error('Espera a que se envíe el mensaje para responder')
      return
    }
    setMsgAction(null)
    setReplyTo(payload)
    replyToRef.current = payload
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  const scrollToMessage = (messageId) => {
    if (!messageId) return
    const safe = String(messageId).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const el = document.querySelector(`[data-msg-id="${safe}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('chat-msg-flash')
    window.setTimeout(() => el.classList.remove('chat-msg-flash'), 1200)
  }

  const openViewOnce = async (messageId) => {
    try {
      const { data } = await api.post(`/chat/view-once/${messageId}`)
      if (data?.message) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...data.message } : m)))
      }
      return data?.media || null
    } catch (error) {
      const status = error.response?.status
      if (status === 410) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.attachment
              ? { ...m, attachment: { ...m.attachment, opened: true, url: null } }
              : m
          )
        )
        return null
      }
      toast.error(error.response?.data?.message || 'No se pudo abrir')
      return null
    }
  }

  const notifyViewOnceUsed = async (type) => {
    const isAudio = type === 'audio'
    await dialog.alert(
      isAudio
        ? 'Este audio se envió para escucharse una sola vez y ya fue abierto.'
        : 'Esta foto se envió para verse una sola vez y ya fue abierta.',
      {
        title: isAudio ? 'Audio de una sola vez' : 'Foto de una sola vez',
        confirmLabel: 'Entendido',
        tone: 'info'
      }
    )
  }

  const markViewOnceOpened = (messageId) => {
    if (!messageId) return
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.attachment?.viewOnce) return m
        if (m.sender === 'me') {
          // Sender consumed their one local preview; keep media so peer can still open once
          return {
            ...m,
            attachment: { ...m.attachment, viewedByMe: true }
          }
        }
        return {
          ...m,
          attachment: {
            ...m.attachment,
            opened: true,
            url: null
          }
        }
      })
    )
  }

  const handleTyping = () => {
    if (selectedChat?.otherId && user?._id) {
      sendTyping(selectedChat.otherId, user._id)
    }
  }

  const clearVoiceTimer = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const releaseMicStream = () => {
    streamRef.current?.getTracks?.().forEach((t) => t.stop())
    streamRef.current = null
  }

  const resetVoiceUi = () => {
    clearVoiceTimer()
    mediaRecorderRef.current = null
    recordingChunksRef.current = []
    recordingSecRef.current = 0
    durationAtStopRef.current = 0
    setRecording(false)
    setRecordingSec(0)
    setVoiceSession(false)
    setVoiceMode('recording')
    setVoicePreviewUrl(null)
    setVoiceViewOnce(false)
    voiceViewOnceRef.current = false
    releaseMicStream()
  }

  const buildRecorder = (stream) => {
    const mimeType =
      mimeRef.current ||
      (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '')
    mimeRef.current = mimeType
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    recorder.ondataavailable = (e) => {
      if (e.data?.size) recordingChunksRef.current.push(e.data)
    }
    recorder.onstop = async () => {
      const action = stopActionRef.current
      const durationSec = Math.max(1, durationAtStopRef.current || recordingSecRef.current || 1)
      const blob = new Blob(recordingChunksRef.current, {
        type: recorder.mimeType || mimeRef.current || 'audio/webm'
      })

      if (action === 'discard') {
        resetVoiceUi()
        return
      }

      if (!blob.size) {
        if (action === 'send') toast.error('No se capturó audio')
        resetVoiceUi()
        return
      }

      try {
        const url = await fileToDataUrl(blob)
        if (action === 'send') {
          const ok = await sendChatPayload({
            attachment: {
              type: 'audio',
              url,
              mime: blob.type || 'audio/webm',
              durationSec,
              viewOnce: Boolean(voiceViewOnceRef.current)
            },
            reply: replyToRef.current
          })
          resetVoiceUi()
          if (!ok) {
            /* sendChatPayload already restored UI for images; for audio keep silent */
          }
          return
        }

        // preview / paused
        setVoicePreviewUrl(url)
        setVoiceMode('paused')
        setRecording(false)
        mediaRecorderRef.current = null
      } catch {
        toast.error('No se pudo procesar el audio')
        resetVoiceUi()
      }
    }
    return recorder
  }

  const startVoiceTimer = () => {
    clearVoiceTimer()
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSec((prev) => {
        const next = prev + 1
        recordingSecRef.current = next
        if (next >= MAX_AUDIO_SEC) {
          finalizeVoiceSend()
        }
        return next
      })
    }, 1000)
  }

  const startRecording = async () => {
    if (recording || voiceSession || pendingAttachment || imageDraft || !selectedChat) return
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Tu navegador no soporta grabación de audio')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      recordingChunksRef.current = []
      const recorder = buildRecorder(stream)
      mediaRecorderRef.current = recorder
      stopActionRef.current = 'preview'
      recorder.start(250)
      setVoiceSession(true)
      setVoiceMode('recording')
      setVoicePreviewUrl(null)
      setRecording(true)
      setRecordingSec(0)
      recordingSecRef.current = 0
      durationAtStopRef.current = 0
      startVoiceTimer()
    } catch {
      toast.error('No se pudo acceder al micrófono')
      resetVoiceUi()
    }
  }

  const pauseVoice = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    clearVoiceTimer()
    durationAtStopRef.current = Math.max(1, recordingSecRef.current)
    stopActionRef.current = 'preview'
    try {
      recorder.requestData?.()
      recorder.stop()
    } catch {
      /* ignore */
    }
  }

  const resumeVoice = () => {
    if (!streamRef.current || voiceMode !== 'paused') return
    try {
      const recorder = buildRecorder(streamRef.current)
      mediaRecorderRef.current = recorder
      stopActionRef.current = 'preview'
      recorder.start(250)
      setVoiceMode('recording')
      setRecording(true)
      setVoicePreviewUrl(null)
      startVoiceTimer()
    } catch {
      toast.error('No se pudo continuar la grabación')
    }
  }

  const discardVoice = () => {
    clearVoiceTimer()
    const recorder = mediaRecorderRef.current
    stopActionRef.current = 'discard'
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        resetVoiceUi()
      }
    } else {
      resetVoiceUi()
    }
  }

  const finalizeVoiceSend = () => {
    clearVoiceTimer()
    durationAtStopRef.current = Math.max(1, recordingSecRef.current)
    voiceViewOnceRef.current = voiceViewOnce
    const recorder = mediaRecorderRef.current
    stopActionRef.current = 'send'

    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData?.()
        recorder.stop()
      } catch {
        toast.error('No se pudo enviar el audio')
        resetVoiceUi()
      }
      return
    }

    // Already paused with chunks ready
    ;(async () => {
      const blob = new Blob(recordingChunksRef.current, {
        type: mimeRef.current || 'audio/webm'
      })
      if (!blob.size) {
        toast.error('Graba al menos un segundo')
        return
      }
      try {
        const url = await fileToDataUrl(blob)
        await sendChatPayload({
          attachment: {
            type: 'audio',
            url,
            mime: blob.type || 'audio/webm',
            durationSec: Math.max(1, durationAtStopRef.current),
            viewOnce: Boolean(voiceViewOnce)
          },
          reply: replyToRef.current
        })
      } catch {
        toast.error('No se pudo enviar el audio')
      } finally {
        resetVoiceUi()
      }
    })()
  }

  const handleMicClick = () => {
    if (voiceSession) return
    startRecording()
  }

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      let url
      let mime = 'image/jpeg'
      try {
        url = await compressImageFile(file)
      } catch {
        url = await fileToDataUrl(file)
        mime = file.type || 'image/jpeg'
      }
      setPendingAttachment(null)
      setImageDraft({ type: 'image', url, mime })
    } catch {
      toast.error('No se pudo cargar la imagen')
    }
  }

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      toast.error('El archivo no puede superar 4 MB')
      return
    }
    try {
      const url = await fileToDataUrl(file)
      setPendingAttachment({
        type: 'file',
        url,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size
      })
    } catch {
      toast.error('No se pudo cargar el archivo')
    }
  }

  const loadSharedItems = async () => {
    if (!selectedChat?.otherId) return
    setSharedLoading(true)
    try {
      const { data } = await api.get(`/chat/shared/${selectedChat.otherId}`)
      setSharedItems(data || [])
    } catch {
      setSharedItems([])
      toast.error('No se pudieron cargar los archivos compartidos')
    } finally {
      setSharedLoading(false)
    }
  }

  const loadPublicRoutines = async () => {
    if (!selectedChat?.otherId) return
    setRoutinesLoading(true)
    try {
      const { data } = await api.get(`/chat/partner/${selectedChat.otherId}/public-routines`)
      setPublicRoutines(data || [])
    } catch {
      setPublicRoutines([])
      toast.error('No se pudieron cargar los entrenamientos')
    } finally {
      setRoutinesLoading(false)
    }
  }

  const handleClearChat = async () => {
    if (!selectedChat?.otherId) return
    setShowThreadMenu(false)
    const ok = await dialog.confirm(
      'Los mensajes se ocultarán solo para ti. El otro usuario seguirá viendo el historial.',
      {
        title: '¿Vaciar chat?',
        confirmLabel: 'Vaciar',
        cancelLabel: 'Cancelar',
        tone: 'danger'
      }
    )
    if (!ok) return
    try {
      await api.post(`/chat/clear/${selectedChat.otherId}`)
      setMessages([])
      setConversations((convs) =>
        convs.map((c) =>
          c.otherId === selectedChat.otherId ? { ...c, lastMessage: '', unread: 0 } : c
        )
      )
      toast.success('Chat vaciado')
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo vaciar el chat')
    }
  }

  const handleAddShortcut = () => {
    if (!user?._id || !selectedChat?.otherId) return
    setShowThreadMenu(false)
    addChatShortcut(user._id, {
      id: selectedChat.otherId,
      name: selectedChat.name,
      username: selectedChat.username,
      avatar: selectedChat.avatar
    })
    toast.success('Acceso directo creado')
  }

  const handleWallpaperSelect = (styleId) => {
    if (!selectedChat?.otherId) return
    setChatWallpaper(selectedChat.otherId, styleId)
    setWallpaperId(styleId)
    setShowWallpaperSheet(false)
    setShowThreadMenu(false)
    toast.success(
      styleId === CHAT_WALLPAPER_NONE || !styleId
        ? 'Estilo del chat restaurado'
        : 'Estilo del chat actualizado'
    )
  }

  const openSharedSheet = () => {
    setShowThreadMenu(false)
    setSharedFilter('posts')
    setShowSharedSheet(true)
    loadSharedItems()
  }

  const openRoutinesSheet = () => {
    setShowThreadMenu(false)
    setShowRoutinesSheet(true)
    loadPublicRoutines()
  }

  const openWallpaperSheet = () => {
    setShowThreadMenu(false)
    setShowWallpaperSheet(true)
  }

  useEffect(() => {
    if (selectedChat?.otherId) {
      setWallpaperId(getChatWallpaper(selectedChat.otherId))
      setPendingAttachment(null)
      setImageDraft(null)
      setReplyTo(null)
      replyToRef.current = null
      setMsgAction(null)
      setShowThreadMenu(false)
      discardVoice()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.otherId])

  useEffect(() => {
    return () => {
      discardVoice()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const searchUsers = async () => {
    setSearching(true)
    try {
      const query = userSearch.trim()
        ? `q=${encodeURIComponent(userSearch)}&filter=${userFilter}`
        : `filter=${userFilter}`
      const { data } = await api.get(`/users/search?${query}`)
      setSearchResults(data || [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (showNewChat) searchUsers()
  }, [userFilter, showNewChat])

  const startConversation = async (selectedUser) => {
    if (isMessagingDisabledUser(selectedUser)) {
      await dialog.alert(MESSAGING_DISABLED_COPY, {
        title: 'Mensajería no disponible',
        confirmLabel: 'Entendido',
        tone: 'info'
      })
      return
    }
    const uid = selectedUser._id || selectedUser.id
    setConversations((prev) => {
      const existingConv = prev.find((c) => c.otherId === uid)
      if (existingConv) {
        setSelectedChat(existingConv)
        return prev
      }
      const newConv = {
        id: uid,
        otherId: uid,
        name: selectedUser.name,
        username: selectedUser.username || null,
        avatar: isRenderableAvatar(selectedUser.avatar) ? selectedUser.avatar : null,
        lastMessage: '',
        time: 'Ahora',
        unread: 0
      }
      setSelectedChat(newConv)
      return [newConv, ...prev]
    })
    setShowNewChat(false)
    setUserSearch('')
    setSearchResults([])
    // Always hydrate media for new / existing selection
    ;(async () => {
      try {
        const { data } = await api.get(`/users/${uid}`)
        const avatar = data?.avatar || null
        if (!isRenderableAvatar(avatar) && !data?.name) return
        setSelectedChat((prev) =>
          prev?.otherId === uid
            ? {
                ...prev,
                avatar: isRenderableAvatar(avatar) ? avatar : prev.avatar,
                name: data?.name || prev.name,
                username: data?.username || prev.username
              }
            : prev
        )
        setConversations((list) =>
          list.map((c) =>
            c.otherId === uid
              ? {
                  ...c,
                  avatar: isRenderableAvatar(avatar) ? avatar : c.avatar,
                  name: data?.name || c.name,
                  username: data?.username || c.username
                }
              : c
          )
        )
      } catch {
        /* ignore */
      }
    })()
  }

  // Open chat from profile "Mensaje" button or story reply
  useEffect(() => {
    const startWith = location.state?.startWith
    const prefill = location.state?.prefill
    const storyReply = location.state?.storyReply
    if (!startWith?._id && !startWith?.id) return

    if (isMessagingDisabledUser(startWith)) {
      dialog.alert(MESSAGING_DISABLED_COPY, {
        title: 'Mensajería no disponible',
        confirmLabel: 'Entendido',
        tone: 'info'
      })
      navigate(location.pathname, { replace: true, state: {} })
      return
    }

    const to = startWith._id || startWith.id
    if (storyReply?.attachment) {
      pendingStoryReply.current = {
        to,
        text: storyReply.text || '',
        attachment: storyReply.attachment
      }
    } else {
      pendingStoryReply.current = null
      if (prefill) setNewMessage(String(prefill))
    }
    startConversation(startWith)
    navigate(location.pathname, { replace: true, state: {} })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.startWith?._id, location.state?.startWith?.id])

  const filteredConversations = conversations.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.username?.toLowerCase().includes(q)
    )
  })

  const selectedPresenceMeta = getPresenceMeta(selectedPresence || PRESENCE_STATUS.OFFLINE)
  const hasStyledWall = isStyledWallpaper(wallpaperId)
  const presenceStatusClass = peerTyping
    ? hasStyledWall
      ? 'text-cyan-300'
      : 'text-[color:var(--color-primary)]'
    : hasStyledWall && selectedPresenceMeta.textClass === 'text-gray-500'
      ? 'text-white/65'
      : selectedPresenceMeta.textClass

  return (
    <div
      className={
        selectedChat
          ? 'fixed inset-x-0 top-16 bottom-0 z-40 flex gap-0 overflow-hidden md:static md:inset-auto md:z-auto md:h-[calc(100dvh-8.5rem)] md:gap-3 md:-mx-0'
          : 'flex h-[calc(100dvh-10.5rem)] gap-0 -mx-3 sm:-mx-1 md:mx-0 md:h-[calc(100dvh-8.5rem)] md:gap-3'
      }
    >
      {/* Conversation list */}
      <div
        data-tour="tour-chat-inbox"
        className={`relative w-full md:w-[min(100%,24rem)] lg:w-[26rem] xl:w-[28rem] flex-shrink-0 overflow-hidden flex flex-col rounded-none md:rounded-[1.75rem] border-0 md:border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-none md:shadow-[0_20px_50px_-28px_var(--shadow-color)] ${
          selectedChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 0% -10%, rgba(var(--color-primary-rgb),0.14), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(var(--color-accent-rgb),0.08), transparent 50%)'
          }}
          aria-hidden
        />

        <div className="relative z-[1] px-4 pt-5 pb-3.5 sm:px-5 sm:pt-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                Inbox
              </p>
              <div className="mt-1 flex items-center gap-2">
                <h1 className="font-display text-[1.85rem] leading-none tracking-tight text-[color:var(--text-primary)] sm:text-[2.05rem]">
                  Mensajes
                </h1>
                <TutorialHelpButton
                  tutorialId={TUTORIAL_IDS.CHAT}
                  size="sm"
                  message="Hay un tutorial para sacarle el máximo provecho al chat: conversaciones, archivos y más."
                />
              </div>
              <p className="mt-1.5 max-w-[16rem] text-[13px] leading-snug text-[color:var(--text-muted)]">
                Conversaciones en tiempo real con tu comunidad
              </p>
            </div>
            <motion.button
              type="button"
              data-tour="tour-chat-new"
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowNewChat(true)}
              className="mt-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white shadow-[0_10px_28px_rgba(var(--color-primary-rgb),0.38)] ring-4 ring-[rgba(var(--color-primary-rgb),0.12)] transition hover:brightness-110"
              aria-label="Nueva conversación"
            >
              <FiPlus size={22} strokeWidth={2.5} />
            </motion.button>
          </div>
          <div className="relative">
            <FiSearch
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]"
              size={17}
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversación…"
              enterKeyHint="search"
              className="w-full rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/90 py-3 pl-10 pr-4 text-[15px] text-[color:var(--text-primary)] outline-none backdrop-blur-sm transition placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--color-primary)] focus:bg-[color:var(--bg-app)] focus:ring-4 focus:ring-[rgba(var(--color-primary-rgb),0.12)]"
            />
          </div>
        </div>

        <div className="relative z-[1] flex-1 overflow-y-auto overscroll-contain px-2 pb-3 sm:px-2.5">
          {!listLoaded ? (
            <div className="flex flex-col items-center justify-center px-5 py-20">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[color:var(--border-subtle)] border-t-[color:var(--color-primary)]" />
              <p className="text-sm font-medium text-[color:var(--text-primary)]">Cargando mensajes…</p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">Preparando tus conversaciones</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.1)] text-[color:var(--color-primary)] ring-1 ring-[rgba(var(--color-primary-rgb),0.18)]">
                <FiMessageCircle size={28} />
              </div>
              <p className="text-base font-semibold text-[color:var(--text-primary)]">Sin conversaciones aún</p>
              <p className="mx-auto mt-1.5 max-w-[14rem] text-sm leading-relaxed text-[color:var(--text-muted)]">
                Empieza un chat con alguien de la comunidad
              </p>
              <button
                type="button"
                onClick={() => setShowNewChat(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[rgba(var(--color-primary-rgb),0.25)]"
              >
                <FiPlus size={16} />
                Nueva conversación
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredConversations.map((conv) => {
                const active = selectedChat?.otherId === conv.otherId
                // Only real inbound unread — never style outbound previews as unread
                const unread = Number(conv.unread) > 0 && !conv.lastFromMe
                return (
                  <motion.button
                    key={conv.id || conv.otherId}
                    type="button"
                    layout
                    whileTap={{ scale: 0.985 }}
                    onClick={() => handleSelectChat(conv)}
                    className={`group relative w-full flex items-center gap-3 rounded-[1.25rem] px-3 py-3 text-left transition-colors sm:gap-3.5 sm:px-3.5 sm:py-3.5 ${
                      active
                        ? 'bg-[rgba(var(--color-primary-rgb),0.12)] shadow-[inset_0_0_0_1px_rgba(var(--color-primary-rgb),0.18)]'
                        : 'hover:bg-[color:var(--bg-muted)]/80'
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute left-1 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-[color:var(--color-primary)] sm:left-1.5"
                        aria-hidden
                      />
                    )}
                    <Link
                      to={`/user/${conv.otherId}`}
                      className="relative flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        className={
                          storyUsers.has(conv.otherId)
                            ? 'inline-flex rounded-full bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-accent)] p-[2px] shadow-[0_0_0_1px_rgba(var(--color-primary-rgb),0.15)]'
                            : ''
                        }
                      >
                        <span
                          className="rounded-full bg-[color:var(--bg-elevated)] p-[1.5px]"
                          onClick={(e) => {
                            if (!storyUsers.has(conv.otherId)) return
                            e.preventDefault()
                            e.stopPropagation()
                            openUserStory(conv.otherId)
                          }}
                          role={storyUsers.has(conv.otherId) ? 'button' : undefined}
                        >
                          <Avatar avatar={conv.avatar} name={conv.name} size="md" />
                        </span>
                      </span>
                      <UserNoteBadge userId={conv.otherId} />
                      <PresenceDot userId={conv.otherId} size="md" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className={`block truncate text-[15px] tracking-tight ${
                              unread
                                ? 'font-bold text-[color:var(--text-primary)]'
                                : 'font-semibold text-[color:var(--text-primary)]'
                            }`}
                          >
                            {conv.name}
                          </span>
                          {conv.username ? (
                            <span className="block truncate text-xs text-[color:var(--text-muted)]">
                              @{conv.username}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 text-[11px] tabular-nums ${
                            unread
                              ? 'font-semibold text-[color:var(--color-primary)]'
                              : 'text-[color:var(--text-muted)]'
                          }`}
                        >
                          {conv.time}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2.5">
                        <p
                          className={`truncate text-[13px] leading-snug sm:text-sm ${
                            unread
                              ? 'font-medium text-[color:var(--text-secondary)]'
                              : 'text-[color:var(--text-muted)]'
                          }`}
                        >
                          {conv.lastMessage || 'Nuevo chat'}
                        </p>
                        {unread && (
                          <span className="inline-flex h-5 min-w-[1.35rem] shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] px-1.5 text-[10px] font-bold text-white shadow-[0_4px_10px_rgba(var(--color-primary-rgb),0.35)]">
                            {conv.unread > 99 ? '99+' : conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Thread */}
      <AnimatePresence mode="wait">
        {selectedChat ? (
          <motion.div
            key={selectedChat.otherId}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={`relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-none md:rounded-2xl border-0 md:border border-[color:var(--border-subtle)] bg-transparent shadow-none md:shadow-[0_12px_40px_var(--shadow-color)] ${
              hasStyledWall ? 'chat-thread-chrome force-dark' : ''
            }`}
          >
            {/* chat wallpaper */}
            <ChatWallpaper styleId={wallpaperId} />

            <header
              className={`relative z-10 flex items-center gap-2 border-b px-3 py-3 backdrop-blur-md sm:gap-3 sm:px-4 ${
                hasStyledWall
                  ? 'border-white/10 bg-black/55'
                  : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]/90'
              }`}
            >
              <button
                type="button"
                onClick={handleBack}
                className={`rounded-xl p-2 md:hidden ${
                  hasStyledWall
                    ? 'text-white/85 hover:bg-white/10'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]'
                }`}
                aria-label="Volver"
              >
                <FiArrowLeft size={20} />
              </button>
              <Link
                to={`/user/${selectedChat.otherId}`}
                className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-90"
                onClick={(e) => {
                  if (storyUsers.has(selectedChat.otherId) && e.target.closest('[data-story-ring]')) {
                    e.preventDefault()
                    openUserStory(selectedChat.otherId)
                  }
                }}
              >
                <span className="relative flex-shrink-0" data-story-ring={storyUsers.has(selectedChat.otherId) ? '1' : undefined}>
                  <span
                    className={
                      storyUsers.has(selectedChat.otherId)
                        ? 'inline-flex rounded-full bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-accent)] p-[2px]'
                        : ''
                    }
                  >
                    <span
                      className={`rounded-full p-[1px] ${
                        hasStyledWall ? 'bg-black/40' : 'bg-[color:var(--bg-elevated)]'
                      }`}
                    >
                      <Avatar avatar={selectedChat.avatar} name={selectedChat.name} size="sm" />
                    </span>
                  </span>
                  <PresenceDot userId={selectedChat.otherId} size="sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <div
                    className={`truncate font-semibold ${
                      hasStyledWall ? 'text-white' : 'text-[color:var(--text-primary)]'
                    }`}
                  >
                    {selectedChat.name}
                  </div>
                  <div className={`truncate text-xs ${presenceStatusClass}`}>
                    {peerTyping ? 'escribiendo…' : selectedPresenceMeta.label}
                  </div>
                </span>
              </Link>
              <div className="relative shrink-0" ref={threadMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowThreadMenu((v) => !v)}
                  className={`rounded-xl p-2 ${
                    hasStyledWall
                      ? 'text-white/85 hover:bg-white/10'
                      : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]'
                  }`}
                  aria-label="Opciones del chat"
                  aria-expanded={showThreadMenu}
                >
                  <FiMoreVertical size={20} />
                </button>
                {showThreadMenu &&
                  createPortal(
                    <motion.div
                      ref={threadMenuDropdownRef}
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      className="fixed z-[130] min-w-[15.5rem] overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] py-1 shadow-[0_16px_40px_var(--shadow-color)]"
                      style={{
                        top: threadMenuRef.current
                          ? threadMenuRef.current.getBoundingClientRect().bottom + 8
                          : 56,
                        right: threadMenuRef.current
                          ? Math.max(12, window.innerWidth - threadMenuRef.current.getBoundingClientRect().right)
                          : 12
                      }}
                    >
                      {[
                        { icon: FiImage, label: 'Archivos y publicaciones', action: openSharedSheet },
                        { icon: FiActivity, label: 'Ver entrenamientos', action: openRoutinesSheet },
                        { icon: FiUser, label: 'Estilo del chat', action: openWallpaperSheet },
                        { icon: FiTrash2, label: 'Vaciar chat', action: handleClearChat, danger: true },
                        { icon: FiBookmark, label: 'Crear acceso directo', action: handleAddShortcut }
                      ].map(({ icon: Icon, label, action, danger }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={action}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-[color:var(--bg-muted)] ${
                            danger ? 'text-red-500' : 'text-[color:var(--text-primary)]'
                          }`}
                        >
                          <Icon size={17} className="shrink-0 opacity-80" />
                          {label}
                        </button>
                      ))}
                    </motion.div>,
                    document.body
                  )}
              </div>
            </header>

            <div
              ref={messagesScrollRef}
              className="relative z-10 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 sm:py-5"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(var(--color-primary-rgb),0.12)] text-3xl">
                    💬
                  </div>
                  <p className="font-medium text-[color:var(--text-primary)]">Inicia la conversación</p>
                  <p className="mt-1 max-w-xs text-sm text-[color:var(--text-muted)]">
                    Envía un mensaje a {selectedChat.name?.split(' ')[0] || 'este usuario'}
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.sender === 'me'
                  const prev = messages[idx - 1]
                  const showTail = !prev || prev.sender !== msg.sender
                  const viewOnce = Boolean(msg.attachment?.viewOnce)
                  const hideBodyText = viewOnce // caption only inside viewer, not in bubble
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', damping: 24, stiffness: 380 }}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${showTail ? 'mt-3' : ''}`}
                    >
                      <div className="w-fit max-w-[88%] sm:max-w-[72%]">
                      <SwipeToReply
                        enabled={!voiceSession && !sending}
                        onReply={() => beginReply(msg)}
                        onLongPress={() => setMsgAction({ msg })}
                      >
                        <div
                          data-msg-id={msg.id}
                          className={`relative px-3.5 py-2.5 shadow-sm transition-[box-shadow] ${
                            isMe
                              ? 'rounded-[1.15rem] rounded-br-md bg-[color:var(--color-primary)] text-white'
                              : 'rounded-[1.15rem] rounded-bl-md border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] text-[color:var(--text-primary)]'
                          }`}
                        >
                        <ReplyQuote
                          reply={msg.reply}
                          isMe={isMe}
                          onClick={scrollToMessage}
                        />
                        <StoryAttachmentBubble
                          attachment={msg.attachment}
                          isMe={isMe}
                          hasText={Boolean(msg.text?.trim()) && !hideBodyText}
                          onOpen={(att) => {
                            if (att?.storyId) {
                              openStoryById(att.storyId)
                              return
                            }
                            if (selectedChat?.otherId) {
                              openUserStory(selectedChat.otherId)
                              return
                            }
                            toast.error('No se pudo abrir este estado')
                          }}
                        />
                        <PostAttachmentBubble
                          attachment={msg.attachment}
                          isMe={isMe}
                          hasText={Boolean(msg.text?.trim()) && !hideBodyText}
                          onOpen={(att) => {
                            const id = att?.postId
                            if (!id) {
                              toast.error('No se pudo abrir esta publicación')
                              return
                            }
                            navigate(`/social?post=${encodeURIComponent(id)}`)
                          }}
                        />
                        <ViewOnceAttachmentBubble
                          messageId={msg.id}
                          attachment={msg.attachment}
                          isMe={isMe}
                          caption={msg.text || ''}
                          onOpenOnce={openViewOnce}
                          onAlreadyOpened={notifyViewOnceUsed}
                          onMarkOpened={markViewOnceOpened}
                        />
                        {!viewOnce && (
                          <>
                            <ImageAttachmentBubble
                              attachment={msg.attachment}
                              isMe={isMe}
                              hasText={Boolean(msg.text?.trim())}
                            />
                            <FileAttachmentBubble
                              attachment={msg.attachment}
                              isMe={isMe}
                              hasText={Boolean(msg.text?.trim())}
                            />
                            <AudioAttachmentBubble
                              attachment={msg.attachment}
                              isMe={isMe}
                              hasText={Boolean(msg.text?.trim())}
                              avatar={isMe ? user?.avatar : selectedChat?.avatar}
                              name={isMe ? user?.name : selectedChat?.name}
                            />
                          </>
                        )}
                        {!hideBodyText && msg.text ? (
                          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{msg.text}</p>
                        ) : null}
                        {!msg.text && !msg.attachment ? (
                          <p className="break-words opacity-70"> </p>
                        ) : null}
                        <p
                          className={`mt-1 flex items-center justify-end gap-0.5 text-[10px] ${
                            isMe ? 'text-white/70' : 'text-[color:var(--text-muted)]'
                          }`}
                        >
                          {msg.time}
                          {isMe && (
                            <MessageTicks
                              isMe
                              status={msg.status || (msg.read ? 'read' : msg.delivered ? 'delivered' : 'sent')}
                            />
                          )}
                        </p>
                        </div>
                      </SwipeToReply>
                      </div>
                    </motion.div>
                  )
                })
              )}
              <AnimatePresence>
                {peerTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="flex justify-start"
                  >
                    <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] px-3.5 py-2.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-[color:var(--text-muted)]"
                          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSend}
              className={`relative z-20 border-t px-2 pt-2 sm:px-3 sm:pt-2.5 ${
                voiceSession ? 'hidden' : ''
              } ${
                hasStyledWall
                  ? 'border-white/10 bg-black/60 backdrop-blur-md'
                  : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]'
              }`}
              style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  setShowAttachMenu(false)
                  handleImagePick(e)
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  setShowAttachMenu(false)
                  handleFilePick(e)
                }}
              />
              <ChatEmojiPicker
                open={showEmoji}
                onClose={() => setShowEmoji(false)}
                onPick={insertEmoji}
              />
              {replyTo && (
                <div
                  className={`mx-auto mb-2 flex max-w-3xl items-stretch gap-2 overflow-hidden rounded-2xl border ${
                    hasStyledWall
                      ? 'border-white/12 bg-white/10'
                      : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]'
                  }`}
                >
                  <div className="w-1 shrink-0 bg-[color:var(--color-primary)]" />
                  <button
                    type="button"
                    data-no-swipe
                    onClick={() => scrollToMessage(replyTo.id)}
                    className="min-w-0 flex-1 py-2 pr-1 text-left"
                  >
                    <p
                      className={`truncate text-xs font-semibold ${
                        hasStyledWall ? 'text-[color:var(--color-primary)]' : 'text-[color:var(--color-primary)]'
                      }`}
                    >
                      Respondiendo a {replyTo.senderName || 'mensaje'}
                    </p>
                    <p
                      className={`truncate text-sm ${
                        hasStyledWall ? 'text-white/75' : 'text-[color:var(--text-secondary)]'
                      }`}
                    >
                      {replyTo.text || 'Mensaje'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(null)
                      replyToRef.current = null
                    }}
                    className={`m-1.5 self-center rounded-xl p-2 ${
                      hasStyledWall
                        ? 'text-white/70 hover:bg-white/10'
                        : 'text-[color:var(--text-muted)] hover:bg-[color:var(--bg-elevated)]'
                    }`}
                    aria-label="Cancelar respuesta"
                  >
                    <FiX size={18} />
                  </button>
                </div>
              )}
              {pendingAttachment && pendingAttachment.type !== 'image' && pendingAttachment.type !== 'audio' && (
                <div
                  className={`mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-2xl border px-3 py-2 ${
                    hasStyledWall
                      ? 'border-white/12 bg-white/10'
                      : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]'
                  }`}
                >
                  <span
                    className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                      hasStyledWall
                        ? 'bg-white/10 text-white/80'
                        : 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]'
                    }`}
                  >
                    <FiFile size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        hasStyledWall ? 'text-white' : 'text-[color:var(--text-primary)]'
                      }`}
                    >
                      {pendingAttachment.name || 'Archivo'}
                    </p>
                    <p className={`text-xs ${hasStyledWall ? 'text-white/55' : 'text-[color:var(--text-muted)]'}`}>
                      Toca enviar para compartir
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    className={`rounded-xl p-2 ${
                      hasStyledWall
                        ? 'text-white/70 hover:bg-white/10'
                        : 'text-[color:var(--text-muted)] hover:bg-[color:var(--bg-elevated)]'
                    }`}
                    aria-label="Quitar adjunto"
                  >
                    <FiX size={18} />
                  </button>
                </div>
              )}

              <div className="relative mx-auto flex max-w-3xl items-end gap-2">
                <AnimatePresence>
                  {showAttachMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      className={`absolute bottom-[calc(100%+0.5rem)] left-0 z-30 w-44 overflow-hidden rounded-2xl border py-1 shadow-xl ${
                        hasStyledWall
                          ? 'border-white/12 bg-[#16161c] text-white'
                          : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={voiceSession || !!pendingAttachment || !!imageDraft}
                        className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm disabled:opacity-40 ${
                          hasStyledWall
                            ? 'text-white hover:bg-white/10'
                            : 'text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)]'
                        }`}
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                          <FiImage size={18} />
                        </span>
                        Foto
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={voiceSession || !!pendingAttachment || !!imageDraft}
                        className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm disabled:opacity-40 ${
                          hasStyledWall
                            ? 'text-white hover:bg-white/10'
                            : 'text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)]'
                        }`}
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-500">
                          <FiPaperclip size={18} />
                        </span>
                        Archivo
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* WhatsApp-style field: emoji + text + attach inside one pill */}
                <div
                  className={`flex min-w-0 flex-1 items-end rounded-[1.65rem] border pl-1.5 pr-1.5 shadow-sm focus-within:border-[color:var(--color-primary)]/50 focus-within:ring-2 focus-within:ring-[rgba(var(--color-primary-rgb),0.12)] ${
                    hasStyledWall
                      ? 'border-white/15 bg-white/10'
                      : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      setShowEmoji((v) => !v)
                    }}
                    className={`mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
                      showEmoji
                        ? 'text-[color:var(--color-primary)]'
                        : hasStyledWall
                          ? 'text-white/75 hover:bg-white/10'
                          : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
                    }`}
                    aria-label="Emojis"
                    aria-pressed={showEmoji}
                  >
                    <FiSmile size={22} />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value)
                      handleTyping()
                    }}
                    onFocus={() => {
                      setShowEmoji(false)
                      setShowAttachMenu(false)
                    }}
                    placeholder="Mensaje"
                    className={`min-w-0 flex-1 bg-transparent py-2.5 text-[15.5px] leading-snug outline-none ${
                      hasStyledWall
                        ? 'text-white placeholder:text-white/45'
                        : 'text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]'
                    }`}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmoji(false)
                      setShowAttachMenu((v) => !v)
                    }}
                    disabled={voiceSession}
                    className={`mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${
                      showAttachMenu
                        ? 'text-[color:var(--color-primary)]'
                        : hasStyledWall
                          ? 'text-white/75 hover:bg-white/10'
                          : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
                    }`}
                    aria-label="Adjuntar"
                    aria-expanded={showAttachMenu}
                  >
                    <FiPlus size={22} className={showAttachMenu ? 'rotate-45 transition' : 'transition'} />
                  </button>
                </div>

                {/* Outside: mic when empty, send when content (WhatsApp pattern) */}
                {newMessage.trim() || pendingAttachment ? (
                  <button
                    type="submit"
                    disabled={sending || voiceSession}
                    className="mb-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white shadow-[0_6px_16px_rgba(var(--color-primary-rgb),0.32)] transition enabled:active:scale-95 disabled:opacity-40"
                    aria-label="Enviar"
                  >
                    {sending ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <FiSend size={18} />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleMicClick}
                    disabled={!!pendingAttachment || !!imageDraft || voiceSession}
                    className="mb-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white shadow-[0_6px_16px_rgba(var(--color-primary-rgb),0.32)] transition enabled:active:scale-95 disabled:opacity-40"
                    aria-label="Grabar audio"
                  >
                    <FiMic size={20} />
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="empty-thread"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative hidden min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] md:flex"
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 50% 40%, rgba(var(--color-primary-rgb),0.12), transparent 55%)'
              }}
              aria-hidden
            />
            <div className="relative z-10 px-8 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-[rgba(var(--color-primary-rgb),0.12)] text-4xl">
                💬
              </div>
              <h2 className="font-display text-2xl tracking-wide text-[color:var(--text-primary)]">Tus mensajes</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-[color:var(--text-secondary)]">
                Selecciona una conversación o inicia una nueva para conectar con tu comunidad.
              </p>
              <button type="button" onClick={() => setShowNewChat(true)} className="btn-primary mt-5">
                Nueva conversación
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewChat && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3.5">
                <h2 className="font-display text-xl">Nueva conversación</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewChat(false)
                    setSearchResults([])
                    setUserSearch('')
                    setUserFilter('all')
                  }}
                  className="rounded-xl p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
                <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'with_conversation', label: 'Recientes' },
                    { id: 'following', label: 'Siguiendo' },
                    { id: 'not_following', label: 'Descubrir' }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setUserFilter(filter.id)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        userFilter === filter.id
                          ? 'bg-[color:var(--color-primary)] text-white'
                          : 'bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                    placeholder="Buscar por nombre o @username…"
                    className="min-w-0 flex-1 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)]"
                  />
                  <button
                    type="button"
                    onClick={searchUsers}
                    disabled={searching}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--color-primary)] text-white"
                  >
                    {searching ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <FiSearch size={18} />
                    )}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {searching ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-[color:var(--color-primary)]" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-[color:var(--text-muted)]">
                    {userSearch ? 'No se encontraron usuarios' : 'Elige un filtro o busca un usuario'}
                  </p>
                ) : (
                  searchResults.map((u) => (
                    <button
                      key={u._id || u.id}
                      type="button"
                      onClick={() => startConversation(u)}
                      className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-[color:var(--bg-muted)]"
                    >
                      <Avatar avatar={u.avatar} name={u.name} size="sm" className="flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-[color:var(--text-primary)]">{u.name}</div>
                        <div className="truncate text-sm text-[color:var(--text-muted)]">
                          {u.username ? `@${u.username}` : u.name}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatBottomSheet open={showSharedSheet} onClose={() => setShowSharedSheet(false)} title="Archivos y publicaciones">
        <div className="flex gap-1.5 border-b border-[color:var(--border-subtle)] px-3 pb-2 pt-1">
          {[
            { id: 'posts', label: 'Publicaciones' },
            { id: 'files', label: 'Archivos' },
            { id: 'links', label: 'Enlaces' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSharedFilter(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                sharedFilter === tab.id
                  ? 'bg-[color:var(--color-primary)] text-white'
                  : 'bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {sharedLoading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-[color:var(--color-primary)]" />
          </div>
        ) : (
          (() => {
            const filtered = (sharedItems || []).filter((item) => {
              const att = item.attachment
              if (!att || att.viewOnce || att.type === 'audio') return false
              const cat =
                item.category ||
                (att.type === 'post' ? 'posts' : att.type === 'link' ? 'links' : 'files')
              return cat === sharedFilter
            })
            if (filtered.length === 0) {
              const emptyCopy =
                sharedFilter === 'posts'
                  ? 'No hay publicaciones compartidas en este chat'
                  : sharedFilter === 'links'
                    ? 'No hay enlaces compartidos en este chat'
                    : 'No hay archivos compartidos en este chat'
              return <p className="px-4 py-12 text-center text-sm text-[color:var(--text-muted)]">{emptyCopy}</p>
            }
            if (sharedFilter === 'links') {
              return (
                <div className="space-y-1.5 p-3">
                  {filtered.map((item) => {
                    const url = item.attachment?.url
                    return (
                      <a
                        key={item.id}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-3 py-2.5 transition hover:border-[color:var(--color-primary)]/40"
                      >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--color-primary-rgb),0.12)] text-[color:var(--color-primary)]">
                          <FiLink size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[color:var(--text-primary)]">
                            {item.attachment?.name || url}
                          </span>
                          {item.text && item.text !== url ? (
                            <span className="block truncate text-[11px] text-[color:var(--text-muted)]">{item.text}</span>
                          ) : null}
                        </span>
                      </a>
                    )
                  })}
                </div>
              )
            }
            return (
              <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4">
                {filtered.map((item) => {
                  const att = item.attachment
                  if (att?.type === 'image') {
                    return (
                      <div key={item.id} className="aspect-square overflow-hidden rounded-xl bg-[color:var(--bg-muted)]">
                        {String(att.url).startsWith('data:') ? (
                          <img src={att.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ProtectedMedia src={att.url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                    )
                  }
                  if (att?.type === 'post') {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (att.postId) navigate(`/social?post=${encodeURIComponent(att.postId)}`)
                          setShowSharedSheet(false)
                        }}
                        className="aspect-square overflow-hidden rounded-xl bg-[color:var(--bg-muted)] p-2 text-left"
                      >
                        {att.image ? (
                          <ProtectedMedia src={att.image} alt="" className="mb-1 h-12 w-full rounded-lg object-cover" />
                        ) : (
                          <span className="mb-1 block text-lg">📝</span>
                        )}
                        <span className="line-clamp-2 text-[10px] text-[color:var(--text-secondary)]">
                          {att.snippet || 'Publicación'}
                        </span>
                      </button>
                    )
                  }
                  if (att?.type === 'file') {
                    return (
                      <a
                        key={item.id}
                        href={att.url}
                        download={att.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl bg-[color:var(--bg-muted)] p-2 text-center"
                      >
                        <FiFile size={22} className="text-[color:var(--text-secondary)]" />
                        <span className="line-clamp-2 text-[10px] text-[color:var(--text-secondary)]">
                          {att.name || 'Archivo'}
                        </span>
                      </a>
                    )
                  }
                  return null
                })}
              </div>
            )
          })()
        )}
      </ChatBottomSheet>

      <ChatBottomSheet open={showRoutinesSheet} onClose={() => setShowRoutinesSheet(false)} title="Entrenamientos públicos">
        {routinesLoading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-[color:var(--color-primary)]" />
          </div>
        ) : publicRoutines.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-[color:var(--text-muted)]">
            {selectedChat?.name?.split(' ')[0] || 'Este usuario'} no tiene rutinas públicas
          </p>
        ) : (
          <div className="space-y-1 p-2">
            {publicRoutines.map((routine) => (
              <div
                key={routine.id}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-[color:var(--bg-muted)]"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--color-primary-rgb),0.12)] text-[color:var(--color-primary)]">
                  <FiActivity size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[color:var(--text-primary)]">{routine.name}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    {routine.exerciseCount} ejercicio{routine.exerciseCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChatBottomSheet>

      <ChatBottomSheet open={showWallpaperSheet} onClose={() => setShowWallpaperSheet(false)} title="Estilo del chat">
        <p className="px-4 pt-1 text-xs text-[color:var(--text-muted)]">
          Por defecto el chat se adapta a tu tema claro u oscuro. Elige un estilo solo si quieres una atmósfera premium en esta conversación.
        </p>
        <div className="grid grid-cols-2 gap-2.5 p-3 sm:gap-3">
          <button
            type="button"
            onClick={() => handleWallpaperSelect(CHAT_WALLPAPER_NONE)}
            className={`relative overflow-hidden rounded-2xl border text-left transition ${
              !hasStyledWall
                ? 'border-[color:var(--color-primary)] ring-2 ring-[rgba(var(--color-primary-rgb),0.28)]'
                : 'border-[color:var(--border-subtle)] hover:border-[color:var(--color-primary)]/45'
            }`}
          >
            <div className="relative h-28 overflow-hidden bg-[color:var(--bg-muted)] sm:h-32">
              <div className="absolute inset-3 rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]" />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-[color:var(--text-secondary)]">
                Adaptativo
              </span>
            </div>
            <div className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[color:var(--text-primary)]">Sin estilo</span>
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-muted))' }}
                  aria-hidden
                />
              </div>
              <p className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">Tema claro / oscuro</p>
            </div>
            {!hasStyledWall && (
              <span className="absolute right-2 top-2 rounded-full bg-[color:var(--color-primary)] px-2 py-0.5 text-[10px] font-semibold text-white">
                Activo
              </span>
            )}
          </button>
          {CHAT_WALLPAPER_STYLES.map((style) => {
            const active = wallpaperId === style.id
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => handleWallpaperSelect(style.id)}
                className={`relative overflow-hidden rounded-2xl border text-left transition ${
                  active
                    ? 'border-[color:var(--color-primary)] ring-2 ring-[rgba(var(--color-primary-rgb),0.28)]'
                    : 'border-[color:var(--border-subtle)] hover:border-[color:var(--color-primary)]/45'
                }`}
              >
                <div className={`relative h-28 overflow-hidden sm:h-32 chat-wallpaper ${style.className}`}>
                  <span className="chat-wall-layer chat-wall-base" />
                  <span className="chat-wall-layer chat-wall-a" />
                  <span className="chat-wall-layer chat-wall-b" />
                  <span className="chat-wall-layer chat-wall-c" />
                  <span className="chat-wall-layer chat-wall-motif" />
                  <span className="chat-wall-layer chat-wall-vignette" />
                </div>
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[color:var(--text-primary)]">{style.name}</span>
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ background: style.swatch }}
                      aria-hidden
                    />
                  </div>
                  {style.subtitle ? (
                    <p className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">{style.subtitle}</p>
                  ) : null}
                </div>
                {active && (
                  <span className="absolute right-2 top-2 rounded-full bg-[color:var(--color-primary)] px-2 py-0.5 text-[10px] font-semibold text-white">
                    Activo
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </ChatBottomSheet>

      <ChatVoiceComposer
        open={voiceSession}
        mode={voiceMode}
        seconds={recordingSec}
        previewUrl={voicePreviewUrl}
        viewOnce={voiceViewOnce}
        sending={sending}
        onToggleViewOnce={() => {
          setVoiceViewOnce((v) => {
            const next = !v
            voiceViewOnceRef.current = next
            return next
          })
        }}
        onDelete={discardVoice}
        onPause={pauseVoice}
        onResume={resumeVoice}
        onSend={finalizeVoiceSend}
      />

      <ChatImageComposer
        open={Boolean(imageDraft?.url)}
        imageUrl={imageDraft?.url}
        recipientName={selectedChat?.name}
        sending={sending}
        onClose={() => setImageDraft(null)}
        onSend={async ({ caption, viewOnce }) => {
          if (!imageDraft) return
          const linkedReply = replyToRef.current
          await sendChatPayload({
            text: caption,
            attachment: {
              ...imageDraft,
              viewOnce: Boolean(viewOnce)
            },
            reply: linkedReply
          })
        }}
      />

      {/* Keep reply visible while recording / previewing media outside the text form */}
      {replyTo && (voiceSession || imageDraft) && !sending && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[114] flex justify-center px-3 pt-2">
          <div className="pointer-events-auto flex w-full max-w-3xl items-stretch overflow-hidden rounded-2xl border border-white/12 bg-[#121218]/95 text-white shadow-lg backdrop-blur-md">
            <div className="w-1 shrink-0 bg-[color:var(--color-primary)]" />
            <div className="min-w-0 flex-1 px-3 py-2">
              <p className="truncate text-xs font-semibold text-[color:var(--color-primary)]">
                Respondiendo a {replyTo.senderName || 'mensaje'}
              </p>
              <p className="truncate text-sm text-white/75">{replyTo.text || 'Mensaje'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setReplyTo(null)
                replyToRef.current = null
              }}
              className="m-1.5 rounded-xl p-2 text-white/70 hover:bg-white/10"
              aria-label="Cancelar respuesta"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {msgAction?.msg &&
          typeof document !== 'undefined' &&
          createPortal(
            <motion.div
              className="fixed inset-0 z-[135] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMsgAction(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] sm:rounded-3xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
                  <p className="text-sm font-semibold">Mensaje</p>
                  <p className="truncate text-xs text-[color:var(--text-muted)]">
                    {msgAction.msg.text?.trim() ||
                      (msgAction.msg.attachment?.type === 'audio'
                        ? 'Audio'
                        : msgAction.msg.attachment?.type === 'image'
                          ? 'Foto'
                          : 'Adjunto')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => beginReply(msgAction.msg)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm hover:bg-[color:var(--bg-muted)]"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.14)] text-[color:var(--color-primary)]">
                    <FiCornerUpLeft size={18} />
                  </span>
                  Responder
                </button>
                <button
                  type="button"
                  onClick={() => setMsgAction(null)}
                  className="w-full border-t border-[color:var(--border-subtle)] px-4 py-3.5 text-sm text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
                >
                  Cancelar
                </button>
              </motion.div>
            </motion.div>,
            document.body
          )}
      </AnimatePresence>
    </div>
  )
}

