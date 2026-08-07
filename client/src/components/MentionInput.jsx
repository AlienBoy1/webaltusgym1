import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { Avatar } from '../utils/avatarUtils'

/**
 * Textarea / input with Facebook-style @mention suggestions.
 */
export default function MentionInput({
  value,
  onChange,
  placeholder = 'Escribe… usa @ para mencionar',
  rows = 3,
  className = '',
  maxLength,
  as = 'textarea',
  onKeyDown,
  disabled = false,
  id
}) {
  const ref = useRef(null)
  const [query, setQuery] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)

  const detectMention = (text, caret) => {
    const before = String(text || '').slice(0, caret)
    const m = before.match(/@([a-z0-9._]{0,20})$/i)
    if (!m) return null
    const atIdx = before.lastIndexOf('@')
    if (atIdx > 0) {
      const prev = before[atIdx - 1]
      if (/[a-z0-9._]/i.test(prev)) return null
    }
    return m[1] || ''
  }

  const syncCaret = () => {
    const el = ref.current
    if (!el) return
    const caret = el.selectionStart ?? value.length
    setQuery(detectMention(value, caret))
  }

  useEffect(() => {
    if (query === null) {
      setSuggestions([])
      return
    }
    let cancelled = false
    setLoading(true)
    const t = window.setTimeout(async () => {
      try {
        const { data } = await api.get(
          `/users/search?q=${encodeURIComponent(query)}&filter=mentions`
        )
        if (!cancelled) {
          setSuggestions(Array.isArray(data) ? data : [])
          setActive(0)
        }
      } catch {
        if (!cancelled) setSuggestions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query])

  const insertMention = (user) => {
    const el = ref.current
    const handle = user.username
    if (!el || !handle) return
    const caret = el.selectionStart ?? value.length
    const before = value.slice(0, caret)
    const after = value.slice(caret)
    const replaced = before.replace(/@([a-z0-9._]{0,20})$/i, `@${handle} `)
    const next = replaced + after
    onChange?.(next)
    setQuery(null)
    setSuggestions([])
    window.requestAnimationFrame(() => {
      const pos = replaced.length
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  const handleKeyDown = (e) => {
    if (query !== null && suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => Math.min(i + 1, suggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(suggestions[active])
        return
      }
      if (e.key === 'Escape') {
        setQuery(null)
        return
      }
    }
    onKeyDown?.(e)
  }

  const sharedProps = {
    id,
    ref,
    value,
    disabled,
    maxLength,
    placeholder,
    className,
    onKeyDown: handleKeyDown,
    onClick: syncCaret,
    onKeyUp: syncCaret,
    onChange: (e) => {
      onChange?.(e.target.value)
      window.requestAnimationFrame(syncCaret)
    }
  }

  return (
    <div className="relative">
      {as === 'input' ? (
        <input type="text" {...sharedProps} />
      ) : (
        <textarea rows={rows} {...sharedProps} />
      )}

      {query !== null && (
        <div className="absolute left-0 right-0 bottom-full z-40 mb-1 max-h-52 overflow-y-auto rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-xl">
          {loading ? (
            <p className="p-3 text-xs text-[color:var(--text-muted)]">Buscando…</p>
          ) : suggestions.length === 0 ? (
            <p className="p-3 text-xs text-[color:var(--text-muted)]">
              {query
                ? 'Sin coincidencias entre quienes se siguen mutuamente'
                : 'Solo puedes mencionar a quien te sigue y tú también sigues'}
            </p>
          ) : (
            suggestions.map((u, i) => (
              <button
                key={u._id || u.id || `mention-${i}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertMention(u)
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition ${
                  i === active
                    ? 'bg-[rgba(var(--color-primary-rgb),0.12)]'
                    : 'hover:bg-[color:var(--bg-muted)]'
                }`}
              >
                <Avatar avatar={u.avatar} name={u.name} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{u.name}</span>
                  <span className="block text-xs text-primary-500 truncate">@{u.username}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/** Render plain text with @username in-app links (no native browser link menu). */
export function MentionText({ text, className = '' }) {
  const navigate = useNavigate()
  const parts = String(text || '').split(/(@[a-z0-9._]{3,20})\b/gi)
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (/^@[a-z0-9._]{3,20}$/i.test(part)) {
          const handle = part.slice(1).toLowerCase()
          return (
            <button
              key={`${handle}-${i}`}
              type="button"
              className="inline font-semibold text-primary-500 hover:underline bg-transparent border-0 p-0 m-0 cursor-pointer align-baseline"
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                navigate(`/user/${handle}`)
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              @{handle}
            </button>
          )
        }
        return <span key={`t-${i}`}>{part}</span>
      })}
    </span>
  )
}
