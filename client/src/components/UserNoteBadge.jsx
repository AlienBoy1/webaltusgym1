import { useEffect } from 'react'
import { useNotesStore } from '../store/notesStore'

/**
 * Tiny floating note cloud next to an avatar bubble.
 * Renders nothing when the user has no active note.
 */
export default function UserNoteBadge({ userId, className = '', maxChars = 36 }) {
  const note = useNotesStore((s) => (userId ? s.byUser[userId] : undefined))
  const fetchOne = useNotesStore((s) => s.fetchOne)

  useEffect(() => {
    if (userId) fetchOne(userId)
  }, [userId, fetchOne])

  if (!note?.body) return null

  const text =
    note.body.length > maxChars ? `${note.body.slice(0, maxChars - 1)}…` : note.body

  return (
    <span
      className={`pointer-events-none absolute -right-1 -top-1 z-[5] max-w-[4.75rem] truncate rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-1.5 py-0.5 text-[9px] font-medium leading-tight text-[color:var(--text-primary)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] sm:max-w-[5.5rem] sm:text-[10px] ${className}`}
      title={note.body}
    >
      {text}
      <span
        className="absolute -bottom-1 left-2 h-1.5 w-1.5 rotate-45 border-b border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]"
        aria-hidden
      />
    </span>
  )
}
