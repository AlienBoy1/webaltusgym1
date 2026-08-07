import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSend, FiSearch, FiArrowLeft, FiPlus, FiX, FiSmile, FiMessageCircle } from 'react-icons/fi'
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
import { useChatStore } from '../../store/chatStore'

const MESSAGING_DISABLED_COPY =
  'Este usuario tiene la mensajería desactivada por ahora. Podrás escribirle cuando la active; inténtalo de nuevo más tarde.'

function isMessagingDisabledUser(u) {
  if (!u) return false
  if (u.allowMessages === false) return true
  if (u.settings?.privacy?.allowMessages === false) return true
  return false
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
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const selectedChatRef = useRef(null)
  const pendingStoryReply = useRef(null)
  const typingClearRef = useRef(null)
  const selectedPresence = usePresenceStatus(selectedChat?.otherId)

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
                delivered: data.delivered,
                read: data.read,
                status: data.status || (data.read ? 'read' : data.delivered ? 'delivered' : 'sent')
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (selectedChat?.otherId) {
      fetchMessages(selectedChat.otherId)
    }
  }, [selectedChat?.otherId])

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
    setSelectedChat({ ...conv, otherId: conv.otherId || conv.oderId })
  }

  const handleBack = () => {
    setShowEmoji(false)
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
    e.preventDefault()
    if (!newMessage.trim() || !selectedChat || sending) return

    const msgText = newMessage.trim()
    const tempId = `temp-${Date.now()}`
    setNewMessage('')
    setShowEmoji(false)
    setSending(true)

    const tempMsg = {
      id: tempId,
      sender: 'me',
      text: msgText,
      status: 'sent',
      time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    }
    setMessages((prev) => [...prev, tempMsg])

    try {
      const { data } = await api.post('/chat/send', {
        to: selectedChat.otherId,
        content: msgText
      })
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...data } : m)))
      setConversations((convs) =>
        convs.map((c) =>
          c.otherId === selectedChat.otherId
            ? {
                ...c,
                lastMessage: msgText,
                time: 'Ahora',
                lastFromMe: true
                // keep existing unread unchanged — outbound never creates unread
              }
            : c
        )
      )
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setNewMessage(msgText)
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
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleTyping = () => {
    if (selectedChat?.otherId && user?._id) {
      sendTyping(selectedChat.otherId, user._id)
    }
  }

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
        avatar: selectedUser.avatar || selectedUser.name?.charAt(0) || '👤',
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

  const filteredConversations = conversations.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  )

  const selectedPresenceMeta = getPresenceMeta(selectedPresence || PRESENCE_STATUS.OFFLINE)

  return (
    <div className="h-[calc(100dvh-10.5rem)] md:h-[calc(100dvh-8.5rem)] flex gap-0 md:gap-3 -mx-3 sm:-mx-1 md:mx-0">
      {/* Conversation list */}
      <div
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
              <h1 className="mt-1 font-display text-[1.85rem] leading-none tracking-tight text-[color:var(--text-primary)] sm:text-[2.05rem]">
                Mensajes
              </h1>
              <p className="mt-1.5 max-w-[16rem] text-[13px] leading-snug text-[color:var(--text-muted)]">
                Conversaciones en tiempo real con tu comunidad
              </p>
            </div>
            <motion.button
              type="button"
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
                      <PresenceDot userId={conv.otherId} size="md" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-[15px] tracking-tight ${
                            unread
                              ? 'font-bold text-[color:var(--text-primary)]'
                              : 'font-semibold text-[color:var(--text-primary)]'
                          }`}
                        >
                          {conv.name}
                        </span>
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
            className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-none md:rounded-2xl border-0 md:border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-none md:shadow-[0_12px_40px_var(--shadow-color)]"
          >
            {/* subtle chat wallpaper */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 12% 18%, rgba(var(--color-primary-rgb),0.10), transparent 42%), radial-gradient(circle at 88% 78%, rgba(var(--color-accent-rgb),0.08), transparent 40%)'
              }}
              aria-hidden
            />

            <header className="relative z-10 flex items-center gap-3 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]/90 px-3 py-3 backdrop-blur-md sm:px-4">
              <button
                type="button"
                onClick={handleBack}
                className="rounded-xl p-2 text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] md:hidden"
                aria-label="Volver"
              >
                <FiArrowLeft size={20} />
              </button>
              <Link
                to={`/user/${selectedChat.otherId}`}
                className="relative flex-shrink-0"
                onClick={(e) => {
                  if (storyUsers.has(selectedChat.otherId)) {
                    e.preventDefault()
                    openUserStory(selectedChat.otherId)
                  }
                }}
              >
                <span
                  className={
                    storyUsers.has(selectedChat.otherId)
                      ? 'inline-flex rounded-full bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-accent)] p-[2px]'
                      : ''
                  }
                >
                  <span className="rounded-full bg-[color:var(--bg-elevated)] p-[1px]">
                    <Avatar avatar={selectedChat.avatar} name={selectedChat.name} size="sm" />
                  </span>
                </span>
                <PresenceDot userId={selectedChat.otherId} size="sm" />
              </Link>
              <Link to={`/user/${selectedChat.otherId}`} className="min-w-0 flex-1">
                <div className="truncate font-semibold text-[color:var(--text-primary)] hover:text-[color:var(--color-primary)]">
                  {selectedChat.name}
                </div>
                <div className={`truncate text-xs ${peerTyping ? 'text-[color:var(--color-primary)]' : selectedPresenceMeta.textClass}`}>
                  {peerTyping ? 'escribiendo…' : selectedPresenceMeta.label}
                </div>
              </Link>
            </header>

            <div className="relative z-10 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 sm:py-5">
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
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', damping: 24, stiffness: 380 }}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${showTail ? 'mt-3' : ''}`}
                    >
                      <div
                        className={`relative max-w-[88%] sm:max-w-[72%] px-3.5 py-2.5 shadow-sm ${
                          isMe
                            ? 'rounded-[1.15rem] rounded-br-md bg-[color:var(--color-primary)] text-white'
                            : 'rounded-[1.15rem] rounded-bl-md border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] text-[color:var(--text-primary)]'
                        }`}
                      >
                        <StoryAttachmentBubble
                          attachment={msg.attachment}
                          isMe={isMe}
                          hasText={Boolean(msg.text?.trim())}
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
                          hasText={Boolean(msg.text?.trim())}
                          onOpen={(att) => {
                            const id = att?.postId
                            if (!id) {
                              toast.error('No se pudo abrir esta publicación')
                              return
                            }
                            navigate(`/social?post=${encodeURIComponent(id)}`)
                          }}
                        />
                        {msg.text ? (
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
              className="relative z-20 border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-2.5 py-2.5 sm:px-4 sm:py-3"
              style={{ paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))' }}
            >
              <ChatEmojiPicker
                open={showEmoji}
                onClose={() => setShowEmoji(false)}
                onPick={insertEmoji}
              />
              <div className="mx-auto flex max-w-3xl items-end gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmoji((v) => !v)}
                  className={`mb-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
                    showEmoji
                      ? 'bg-[rgba(var(--color-primary-rgb),0.16)] text-[color:var(--color-primary)]'
                      : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]'
                  }`}
                  aria-label="Emojis"
                  aria-pressed={showEmoji}
                >
                  <FiSmile size={22} />
                </button>
                <div className="min-w-0 flex-1 rounded-[1.35rem] border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-3.5 py-1 focus-within:border-[color:var(--color-primary)] transition">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value)
                      handleTyping()
                    }}
                    onFocus={() => setShowEmoji(false)}
                    placeholder="Escribe un mensaje…"
                    className="w-full bg-transparent py-2.5 text-[15px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                    autoComplete="off"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="mb-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white shadow-lg shadow-[rgba(var(--color-primary-rgb),0.28)] transition enabled:hover:brightness-110 enabled:active:scale-95 disabled:opacity-40"
                  aria-label="Enviar"
                >
                  {sending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <FiSend size={18} />
                  )}
                </button>
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
    </div>
  )
}

