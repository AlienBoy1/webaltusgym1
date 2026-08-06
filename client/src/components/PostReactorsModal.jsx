import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiX } from 'react-icons/fi'
import api from '../utils/api'
import { Avatar } from '../utils/avatarUtils'
import BottomSheet from './BottomSheet'

/**
 * Native reactors sheet — groups people by emoji (❤️ / 🔥 / etc.)
 * Refetches from API when opened so profile feed and comunidad stay accurate.
 */
export default function PostReactorsModal({
  open,
  onClose,
  reactors: initialReactors = [],
  postId = null,
  loading: externalLoading = false
}) {
  const [reactors, setReactors] = useState(initialReactors)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!open) return
    setFilter('all')
    setReactors(initialReactors || [])
    if (!postId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await api.get(`/social/${postId}/reactors`)
        if (!cancelled && Array.isArray(data)) setReactors(data)
      } catch {
        /* keep initial */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, postId]) // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    return (reactors || []).reduce((acc, r) => {
      const key = r.emoji || '❤️'
      if (!acc[key]) acc[key] = []
      acc[key].push(r)
      return acc
    }, {})
  }, [reactors])

  const emojis = Object.keys(grouped)
  const list = filter === 'all' ? reactors : grouped[filter] || []
  const busy = loading || externalLoading

  return (
    <BottomSheet open={open} onClose={onClose} panelClassName="!overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-subtle)] shrink-0">
        <h3 className="font-display text-lg">Reacciones</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]"
        >
          <FiX size={18} />
        </button>
      </div>

      {emojis.length > 0 && (
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-[color:var(--border-subtle)] shrink-0">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === 'all'
                ? 'bg-[color:var(--color-primary)] text-white'
                : 'bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]'
            }`}
          >
            Todas · {reactors.length}
          </button>
          {emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setFilter(emoji)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm transition ${
                filter === emoji
                  ? 'bg-[color:var(--color-primary)] text-white'
                  : 'bg-[color:var(--bg-muted)]'
              }`}
            >
              {emoji} {grouped[emoji].length}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-y-auto flex-1 p-3 space-y-1.5 app-sheet-scroll">
        {busy ? (
          <div className="py-10 flex justify-center">
            <div className="w-7 h-7 border-2 border-[color:var(--border-subtle)] border-t-[color:var(--color-primary)] rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-center text-[color:var(--text-secondary)] py-8 text-sm">
            Aún no hay reacciones
          </p>
        ) : (
          list.map((r, idx) => (
            <Link
              key={`${r.userId || 'u'}-${r.emoji || 'e'}-${idx}`}
              to={r.username ? `/user/${r.username}` : `/user/${r.userId}`}
              onClick={onClose}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[color:var(--bg-muted)] transition"
            >
              <Avatar avatar={r.avatar} name={r.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{r.name || 'Usuario'}</p>
                {r.username && (
                  <p className="text-[11px] text-primary-500 truncate">@{r.username}</p>
                )}
              </div>
              <span className="text-xl" title={r.emoji === '❤️' ? 'Me gusta' : 'Reacción'}>
                {r.emoji || '❤️'}
              </span>
            </Link>
          ))
        )}
      </div>
    </BottomSheet>
  )
}
