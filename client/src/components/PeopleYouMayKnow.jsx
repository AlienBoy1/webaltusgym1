import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiUserPlus, FiUser, FiMessageCircle } from 'react-icons/fi'
import api from '../utils/api'
import { Avatar } from '../utils/avatarUtils'
import toast from 'react-hot-toast'
import UserNoteBadge from './UserNoteBadge'

export default function PeopleYouMayKnow() {
  const navigate = useNavigate()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/users/search?q=&filter=suggestions')
        if (!cancelled) setPeople(Array.isArray(data) ? data.slice(0, 12) : [])
      } catch {
        if (!cancelled) setPeople([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleFollow = async (userId) => {
    setBusyId(userId)
    try {
      const { data } = await api.post(`/social/${userId}/follow`)
      toast.success(
        data.status === 'following' ? 'Ahora sigues a este usuario' : 'Solicitud de seguimiento enviada'
      )
      setPeople((prev) =>
        prev.map((p) =>
          (p._id || p.id) === userId
            ? {
                ...p,
                hasPendingRequest: data.status === 'pending',
                isFollowing: data.status === 'following'
              }
            : p
        )
      )
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo enviar la solicitud')
    } finally {
      setBusyId(null)
    }
  }

  const openChat = (person) => {
    const pid = person._id || person.id
    navigate('/chat', {
      state: {
        startWith: {
          _id: pid,
          name: person.name,
          avatar: person.avatar
        }
      }
    })
  }

  const actionButton = (person, pid) => {
    if (person.isFollowing) {
      return (
        <button
          type="button"
          onClick={() => openChat(person)}
          className="w-full btn-primary py-1.5 text-xs flex items-center justify-center gap-1"
        >
          <FiMessageCircle size={12} />
          Mensaje
        </button>
      )
    }
    if (person.hasPendingRequest) {
      return (
        <button
          type="button"
          disabled
          className="w-full btn-secondary py-1.5 text-xs opacity-70 cursor-not-allowed"
        >
          Solicitud enviada
        </button>
      )
    }
    return (
      <button
        type="button"
        disabled={busyId === pid}
        onClick={() => handleFollow(pid)}
        className="w-full btn-primary py-1.5 text-xs flex items-center justify-center gap-1 disabled:opacity-50"
      >
        <FiUserPlus size={12} />
        Seguir
      </button>
    )
  }

  return (
    <section className="my-2">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <h2 className="font-display text-lg tracking-wide">Personas que quizá conozcas</h2>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-40 flex-shrink-0 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] p-4 animate-pulse h-48"
            />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-4 py-8 text-center">
          <p className="text-sm text-[color:var(--text-secondary)]">No hay personas para recomendar</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {people.map((person, i) => {
            const pid = person._id || person.id
            return (
              <motion.article
                key={pid}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
                className="w-40 flex-shrink-0 snap-start rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] p-3.5 flex flex-col items-center text-center"
              >
                <div className="relative">
                  <Avatar avatar={person.avatar} name={person.name} size="lg" />
                  <UserNoteBadge userId={pid} />
                </div>
                <p className="mt-2.5 font-semibold text-sm truncate w-full">{person.name}</p>
                {person.username ? (
                  <p className="text-[11px] text-primary-500 mt-0.5 truncate w-full">@{person.username}</p>
                ) : person.stats?.level != null ? (
                  <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">Nv. {person.stats.level}</p>
                ) : null}
                <div className="mt-auto w-full pt-3 space-y-1.5">
                  {actionButton(person, pid)}
                  <Link
                    to={`/user/${pid}`}
                    className="w-full btn-secondary py-1.5 text-xs flex items-center justify-center gap-1"
                  >
                    <FiUser size={12} />
                    Ver perfil
                  </Link>
                </div>
              </motion.article>
            )
          })}
        </div>
      )}
    </section>
  )
}
