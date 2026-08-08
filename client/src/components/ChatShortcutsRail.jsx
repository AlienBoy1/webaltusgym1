import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiMessageCircle, FiX } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import { Avatar, isRenderableAvatar } from '../utils/avatarUtils'
import UserNoteBadge from './UserNoteBadge'
import { loadChatShortcuts, removeChatShortcut, saveChatShortcuts } from '../utils/chatShortcuts'
import api from '../utils/api'

/**
 * Chat shortcuts pinned on the dashboard (below weekly activity).
 * Hydrates missing profile photos from the API so cards stay up to date.
 */
export default function ChatShortcutsRail() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const uid = user?.id || user?._id
  const [items, setItems] = useState([])

  useEffect(() => {
    setItems(loadChatShortcuts(uid))
    const onFocus = () => setItems(loadChatShortcuts(uid))
    window.addEventListener('focus', onFocus)
    window.addEventListener('qyntra:chat-shortcuts', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('qyntra:chat-shortcuts', onFocus)
    }
  }, [uid])

  // Refresh avatars / names for pinned shortcuts that lack a real photo
  useEffect(() => {
    if (!uid || !items.length) return undefined
    let cancelled = false
    const needRefresh = items.filter((p) => p?.id && !isRenderableAvatar(p.avatar))
    if (!needRefresh.length) return undefined

    ;(async () => {
      const updates = {}
      await Promise.all(
        needRefresh.map(async (person) => {
          try {
            const { data } = await api.get(`/users/${person.id}`)
            const avatar = data?.avatar || data?.user?.avatar || null
            if (!isRenderableAvatar(avatar) && !data?.name && !data?.username) return
            updates[person.id] = {
              avatar: isRenderableAvatar(avatar) ? avatar : person.avatar,
              name: data?.name || person.name,
              username: data?.username || person.username || null
            }
          } catch {
            /* ignore */
          }
        })
      )
      if (cancelled || !Object.keys(updates).length) return

      setItems((prev) => {
        const next = prev.map((p) => (updates[p.id] ? { ...p, ...updates[p.id] } : p))
        saveChatShortcuts(uid, next)
        return next
      })
    })()

    return () => {
      cancelled = true
    }
  }, [uid, items.map((p) => `${p.id}:${isRenderableAvatar(p.avatar) ? '1' : '0'}`).join('|')])

  if (!items.length) return null

  const openChat = (person) => {
    navigate('/chat', {
      state: {
        startWith: {
          _id: person.id,
          name: person.name,
          username: person.username,
          avatar: person.avatar
        }
      }
    })
  }

  const remove = (e, id) => {
    e.stopPropagation()
    setItems(removeChatShortcut(uid, id))
  }

  return (
    <section className="mt-2">
      <div className="mb-3 flex items-center justify-between px-0.5">
        <h2 className="font-display text-lg tracking-wide">Accesos de chat</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((person, i) => (
          <motion.div
            key={person.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="w-40 flex-shrink-0 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] p-4"
          >
            <div className="relative mx-auto mb-3 w-fit">
              <Avatar avatar={person.avatar} name={person.name} size="lg" />
              <UserNoteBadge userId={person.id} />
              <button
                type="button"
                onClick={(e) => remove(e, person.id)}
                className="absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] text-[color:var(--text-muted)]"
                aria-label="Quitar acceso"
              >
                <FiX size={12} />
              </button>
            </div>
            <p className="truncate text-center text-sm font-semibold text-[color:var(--text-primary)]">
              {person.username ? `@${person.username}` : person.name}
            </p>
            {person.username ? (
              <p className="truncate text-center text-[11px] text-[color:var(--text-muted)]">{person.name}</p>
            ) : null}
            <button
              type="button"
              onClick={() => openChat(person)}
              className="btn-primary mt-3 flex w-full items-center justify-center gap-1 py-1.5 text-xs"
            >
              <FiMessageCircle size={12} />
              Mensaje
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
