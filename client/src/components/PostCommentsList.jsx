import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { AnimatePresence, motion } from 'framer-motion'
import { FiChevronDown, FiChevronUp, FiCornerDownRight } from 'react-icons/fi'
import { Avatar } from '../utils/avatarUtils'
import { MentionText } from './MentionInput'
import { POST_REACTIONS } from './PostReactionButton'
import { normalizeCommentTree } from '../utils/commentTree'
import api from '../utils/api'
import toast from 'react-hot-toast'

function CommentReactionControl({ comment, onReacted }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const longPressTimer = useRef(null)
  const longPressed = useRef(false)

  const myReaction = comment.myReaction || null
  const likesCount = Number(comment.likesCount) || 0
  const reactionSummary = Array.isArray(comment.reactionSummary) ? comment.reactionSummary : []

  const stacked = (reactionSummary.length
    ? reactionSummary
    : myReaction
      ? [{ emoji: myReaction, count: 1 }]
      : []
  )
    .filter((r) => r?.emoji && r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  const clearTimer = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const startPress = () => {
    longPressed.current = false
    clearTimer()
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true
      setPickerOpen(true)
      if (navigator.vibrate) navigator.vibrate(12)
    }, 380)
  }

  const endPress = () => {
    clearTimer()
    if (!longPressed.current && !pickerOpen) {
      void react(myReaction ? null : '❤️')
    }
  }

  const react = async (emoji) => {
    const id = comment._id || comment.id
    if (!id || busy) return
    setBusy(true)
    setPickerOpen(false)
    try {
      const { data } = await api.post(`/social/comments/${id}/like`, { emoji })
      onReacted?.(id, {
        liked: data.liked,
        myReaction: data.myReaction || null,
        likesCount: data.likesCount || 0,
        reactionSummary: Array.isArray(data.reactionSummary) ? data.reactionSummary : []
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo reaccionar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative ml-auto inline-flex items-center gap-1.5">
      {stacked.length > 0 && (
        <span className="inline-flex items-center -space-x-1.5" aria-hidden>
          {stacked.map((r) => (
            <span
              key={r.emoji}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[11px] shadow-sm"
            >
              {r.emoji}
            </span>
          ))}
          {likesCount > 0 && (
            <span className="pl-2 text-[11px] tabular-nums text-[color:var(--text-muted)]">
              {likesCount}
            </span>
          )}
        </span>
      )}

      <button
        type="button"
        disabled={busy}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={clearTimer}
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onTouchCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        className={`inline-flex items-center justify-center rounded-full p-1 text-base leading-none select-none touch-manipulation transition ${
          myReaction
            ? 'text-[color:var(--color-primary)]'
            : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]'
        }`}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        title="Toca: Me gusta · Mantén: más reacciones"
        aria-label="Reaccionar"
      >
        <span>{myReaction || '🤍'}</span>
      </button>

      <AnimatePresence>
        {pickerOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Cerrar reacciones"
              onClick={() => setPickerOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.94 }}
              className="absolute bottom-full right-0 z-50 mb-1.5 flex gap-0.5 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] p-1 shadow-xl"
              onContextMenu={(e) => e.preventDefault()}
            >
              {POST_REACTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  title={r.label}
                  disabled={busy}
                  onClick={() => void react(r.emoji)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition hover:scale-110 ${
                    myReaction === r.emoji ? 'bg-[rgba(var(--color-primary-rgb),0.2)]' : ''
                  }`}
                >
                  {r.emoji}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function CommentRow({ comment, depth = 0, onReply, onReacted }) {
  const navigate = useNavigate()
  const [repliesOpen, setRepliesOpen] = useState(false)
  const user = typeof comment.user === 'object' ? comment.user : null
  const userId = user?._id || user?.id
  const username = user?.username
  const profilePath = username ? `/user/${username}` : userId ? `/user/${userId}` : null
  const replies = comment.replies || []
  const replyCount = replies.length

  const goProfile = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (profilePath) navigate(profilePath)
  }

  return (
    <div
      className={depth > 0 ? 'ml-7 sm:ml-9 mt-2' : ''}
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: 'none' }}
    >
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={goProfile}
          onContextMenu={(e) => e.preventDefault()}
          className="flex-shrink-0 rounded-full"
          style={{ WebkitTouchCallout: 'none' }}
          aria-label={user?.name || 'Perfil'}
        >
          <Avatar avatar={user?.avatar} name={user?.name} size="sm" />
        </button>
        <div className="min-w-0 flex-1">
          <div
            className="rounded-2xl px-3 py-2 bg-[color:var(--bg-muted)] select-text"
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              type="button"
              onClick={goProfile}
              onContextMenu={(e) => e.preventDefault()}
              className="block w-full text-left bg-transparent border-0 p-0"
              style={{ WebkitTouchCallout: 'none' }}
            >
              <span className="font-semibold text-sm text-[color:var(--text-primary)] hover:text-[color:var(--color-primary)]">
                {user?.name || 'Usuario'}
              </span>
              {username && (
                <span className="ml-1.5 text-[11px] text-primary-500">@{username}</span>
              )}
            </button>
            <p className="text-sm text-[color:var(--text-secondary)] mt-0.5 whitespace-pre-wrap break-words">
              <MentionText text={comment.content} />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 px-1">
            <span className="text-[11px] text-[color:var(--text-muted)]">
              {comment.createdAt
                ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: es })
                : ''}
            </span>
            {depth < 1 && (
              <button
                type="button"
                onClick={() => onReply?.(comment)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--color-primary)] transition"
              >
                <FiCornerDownRight size={12} />
                Responder
              </button>
            )}
            {depth === 0 && replyCount > 0 && (
              <button
                type="button"
                onClick={() => setRepliesOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--color-primary)] hover:opacity-90"
              >
                {repliesOpen ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                {repliesOpen
                  ? 'Ocultar respuestas'
                  : `Ver ${replyCount} respuesta${replyCount === 1 ? '' : 's'}`}
              </button>
            )}
            <CommentReactionControl comment={comment} onReacted={onReacted} />
          </div>
        </div>
      </div>

      {depth === 0 && repliesOpen && replyCount > 0 && (
        <div className="mt-1 space-y-0">
          {replies.map((reply) => (
            <CommentRow
              key={reply._id || reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              onReacted={onReacted}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function patchCommentTree(list, commentId, patch) {
  return (list || []).map((c) => {
    const id = String(c._id || c.id)
    if (id === String(commentId)) {
      return {
        ...c,
        myReaction: patch.myReaction,
        likesCount: patch.likesCount,
        reactionSummary: patch.reactionSummary
      }
    }
    if (c.replies?.length) {
      return { ...c, replies: patchCommentTree(c.replies, commentId, patch) }
    }
    return c
  })
}

/**
 * @param {object} props
 * @param {Array} props.comments
 * @param {(c: object) => void} [props.onReply]
 * @param {(nextComments: Array) => void} [props.onCommentsChange] — keep parent post in sync after reaction
 */
export default function PostCommentsList({ comments = [], onReply, onCommentsChange }) {
  const tree = normalizeCommentTree(comments)

  const handleReacted = (commentId, patch) => {
    const next = patchCommentTree(comments, commentId, patch)
    onCommentsChange?.(normalizeCommentTree(next))
  }

  if (!tree.length) {
    return (
      <p className="text-sm text-center py-4 text-[color:var(--text-muted)]">
        Sé el primero en comentar
      </p>
    )
  }

  return (
    <div
      className="space-y-3"
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: 'none' }}
    >
      {tree.map((c) => (
        <CommentRow
          key={c._id || c.id}
          comment={c}
          onReply={onReply}
          onReacted={handleReacted}
        />
      ))}
    </div>
  )
}
