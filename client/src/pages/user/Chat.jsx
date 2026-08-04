import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { FiSend, FiSearch, FiArrowLeft, FiPlus, FiX } from 'react-icons/fi'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import { onChatEvent, sendTyping, showNotification, requestNotificationPermission } from '../../utils/socket'
import { Avatar } from '../../utils/avatarUtils'
import toast from 'react-hot-toast'

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
        <div className="relative h-[72px] w-[54px] shrink-0 overflow-hidden bg-black sm:h-20 sm:w-[60px]">
          {attachment.mediaType === 'video' ? (
            <>
              <video
                src={attachment.mediaUrl}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-[10px] font-bold text-white">
                ▶
              </span>
            </>
          ) : (
            <img
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
  const navigate = useNavigate()
  const location = useLocation()
  const [conversations, setConversations] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [search, setSearch] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [userFilter, setUserFilter] = useState('all')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const selectedChatRef = useRef(null)
  const pendingStoryReply = useRef(null)

  useEffect(() => {
    selectedChatRef.current = selectedChat
  }, [selectedChat])

  useEffect(() => {
    if (!user?._id) return

    const handleNewMessage = (data) => {
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
                  unread:
                    selectedChatRef.current?.otherId === data.from
                      ? 0
                      : (c.unread || 0) + 1
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
            unread: 1
          },
          ...prev
        ]
      })
    }

    const handleUserOnline = (userId) => {
      setOnlineUsers((prev) => new Set([...prev, userId]))
    }

    const handleUserOffline = (userId) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }

    const unsubMessage = onChatEvent('newMessage', handleNewMessage)
    const unsubOnline = onChatEvent('userOnline', handleUserOnline)
    const unsubOffline = onChatEvent('userOffline', handleUserOffline)

    requestNotificationPermission()
    fetchConversations()

    return () => {
      unsubMessage()
      unsubOnline()
      unsubOffline()
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
    try {
      const { data } = await api.get('/chat/conversations')
      const mapped = (data || []).map((c) => ({
        ...c,
        otherId: c.otherId || c.oderId,
        time: c.time
          ? new Date(c.time).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
          : ''
      }))
      setConversations((prev) => {
        const localOnly = prev.filter(
          (p) => !mapped.some((m) => m.otherId === p.otherId) && !p.lastMessage
        )
        return [...localOnly, ...mapped]
      })
    } catch (error) {
      console.error('Error fetching conversations:', error)
    }
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
    setSelectedChat({ ...conv, otherId: conv.otherId || conv.oderId })
  }

  const handleBack = () => {
    setSelectedChat(null)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedChat || sending) return

    const msgText = newMessage.trim()
    const tempId = `temp-${Date.now()}`
    setNewMessage('')
    setSending(true)

    const tempMsg = {
      id: tempId,
      sender: 'me',
      text: msgText,
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
            ? { ...c, lastMessage: msgText, time: 'Ahora' }
            : c
        )
      )
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setNewMessage(msgText)
      toast.error(error.response?.data?.message || 'Error al enviar mensaje')
    } finally {
      setSending(false)
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

  const startConversation = (selectedUser) => {
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

  const isOnline = (userId) => onlineUsers.has(userId)

  return (
    <div className="h-[calc(100dvh-11rem)] md:h-[calc(100vh-180px)] flex gap-0 md:gap-4 -mx-2 sm:mx-0">
      <div
        className={`w-full md:w-80 flex-shrink-0 card p-0 overflow-hidden flex flex-col ${
          selectedChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-3 sm:p-4 border-b border-white/5">
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="input-field pl-10 py-2"
              />
            </div>
            <button
              onClick={() => setShowNewChat(true)}
              className="p-2 bg-primary-500 rounded-xl text-white hover:bg-primary-600 flex-shrink-0"
              aria-label="Nueva conversación"
            >
              <FiPlus size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-gray-400 px-4">
              <p>No hay conversaciones</p>
              <button onClick={() => setShowNewChat(true)} className="text-primary-500 mt-2">
                Iniciar una nueva
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id || conv.otherId}
                onClick={() => handleSelectChat(conv)}
                className={`w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-dark-200 transition-colors ${
                  selectedChat?.otherId === conv.otherId ? 'bg-dark-200' : ''
                }`}
              >
                <Link
                  to={`/user/${conv.otherId}`}
                  className="relative flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Avatar avatar={conv.avatar} name={conv.name} size="md" />
                  {isOnline(conv.otherId) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent-green rounded-full border-2 border-dark-200" />
                  )}
                </Link>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{conv.name}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{conv.time}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-gray-400 text-sm truncate">
                      {conv.lastMessage || 'Nuevo chat'}
                    </p>
                    {conv.unread > 0 && (
                      <span className="w-5 h-5 bg-primary-500 rounded-full text-xs flex items-center justify-center flex-shrink-0">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {selectedChat ? (
        <div className="flex-1 card p-0 flex flex-col overflow-hidden min-w-0">
          <div className="p-3 sm:p-4 border-b border-white/5 flex items-center gap-3">
            <button
              onClick={handleBack}
              className="md:hidden text-gray-400 hover:text-white flex-shrink-0"
              aria-label="Volver"
            >
              <FiArrowLeft size={20} />
            </button>
            <Link to={`/user/${selectedChat.otherId}`} className="relative flex-shrink-0">
              <Avatar avatar={selectedChat.avatar} name={selectedChat.name} size="sm" />
              {isOnline(selectedChat.otherId) && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-accent-green rounded-full border-2 border-dark-200" />
              )}
            </Link>
            <Link to={`/user/${selectedChat.otherId}`} className="flex-1 min-w-0">
              <div className="font-medium hover:text-primary-500 transition-colors truncate">
                {selectedChat.name}
              </div>
              <div
                className={`text-xs ${
                  isOnline(selectedChat.otherId) ? 'text-accent-green' : 'text-gray-500'
                }`}
              >
                {isOnline(selectedChat.otherId) ? 'En línea' : 'Desconectado'}
              </div>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p>Envía un mensaje para iniciar</p>
              </div>
            ) : (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl ${
                      msg.sender === 'me'
                        ? 'bg-primary-500 text-white rounded-br-md'
                        : 'bg-dark-200 text-white rounded-bl-md'
                    }`}
                  >
                    <StoryAttachmentBubble
                      attachment={msg.attachment}
                      isMe={msg.sender === 'me'}
                      hasText={Boolean(msg.text?.trim())}
                      onOpen={(att) => {
                        if (!att?.storyId) {
                          toast.error('No se pudo abrir este estado')
                          return
                        }
                        navigate(`/social?openStory=${att.storyId}`)
                      }}
                    />
                    {msg.text ? <p className="break-words">{msg.text}</p> : null}
                    {!msg.text && !msg.attachment ? (
                      <p className="break-words opacity-70"> </p>
                    ) : null}
                    <p
                      className={`text-xs mt-1 ${
                        msg.sender === 'me' ? 'text-white/70' : 'text-gray-500'
                      }`}
                    >
                      {msg.time}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSend}
            className="p-3 sm:p-4 border-t border-white/5 flex gap-2 sm:gap-3"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value)
                handleTyping()
              }}
              placeholder="Escribe un mensaje..."
              className="input-field flex-1 min-w-0"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="btn-primary px-3 sm:px-4 flex-shrink-0"
            >
              <FiSend />
            </button>
          </form>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 card items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-6xl mb-4">💬</div>
            <p>Selecciona una conversación</p>
            <button onClick={() => setShowNewChat(true)} className="btn-primary mt-4">
              Nueva conversación
            </button>
          </div>
        </div>
      )}

      {showNewChat && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card max-w-md w-full rounded-b-none sm:rounded-2xl max-h-[90dvh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl">Nueva Conversación</h2>
              <button
                onClick={() => {
                  setShowNewChat(false)
                  setSearchResults([])
                  setUserSearch('')
                  setUserFilter('all')
                }}
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'with_conversation', label: 'Con conversación' },
                { id: 'following', label: 'Siguiendo' },
                { id: 'not_following', label: 'No siguiendo' }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setUserFilter(filter.id)}
                  className={`px-3 py-1 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    userFilter === filter.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-dark-200 text-gray-400 hover:text-white'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                placeholder="Buscar usuario..."
                className="input-field flex-1 min-w-0"
              />
              <button onClick={searchUsers} disabled={searching} className="btn-primary px-4">
                {searching ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FiSearch />
                )}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 max-h-64">
              {searching ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-gray-400 text-center py-4">
                  {userSearch
                    ? 'No se encontraron usuarios'
                    : 'Selecciona un filtro o busca un usuario'}
                </p>
              ) : (
                searchResults.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => startConversation(u)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-dark-200 rounded-xl"
                    >
                      <Avatar avatar={u.avatar} name={u.name} size="sm" className="flex-shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <div className="font-medium truncate">{u.name}</div>
                        <div className="text-gray-400 text-sm truncate">{u.email}</div>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
