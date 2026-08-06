import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { FiChevronDown, FiChevronUp, FiCornerDownRight } from 'react-icons/fi'
import { Avatar } from '../utils/avatarUtils'
import { MentionText } from './MentionInput'
import { normalizeCommentTree } from '../utils/commentTree'

function CommentRow({ comment, depth = 0, onReply }) {
  const [repliesOpen, setRepliesOpen] = useState(false)
  const user = typeof comment.user === 'object' ? comment.user : null
  const userId = user?._id || user?.id
  const username = user?.username
  const replies = comment.replies || []
  const replyCount = replies.length

  return (
    <div className={depth > 0 ? 'ml-7 sm:ml-9 mt-2' : ''}>
      <div className="flex gap-2.5">
        <Link to={username ? `/user/${username}` : userId ? `/user/${userId}` : '#'} className="flex-shrink-0">
          <Avatar avatar={user?.avatar} name={user?.name} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl px-3 py-2 bg-[color:var(--bg-muted)]">
            <Link
              to={username ? `/user/${username}` : userId ? `/user/${userId}` : '#'}
              className="block"
            >
              <span className="font-semibold text-sm text-[color:var(--text-primary)] hover:text-[color:var(--color-primary)]">
                {user?.name || 'Usuario'}
              </span>
              {username && (
                <span className="ml-1.5 text-[11px] text-primary-500">@{username}</span>
              )}
            </Link>
            <p className="text-sm text-[color:var(--text-secondary)] mt-0.5 whitespace-pre-wrap break-words">
              <MentionText text={comment.content} />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 px-1">
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
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PostCommentsList({ comments = [], onReply }) {
  const tree = normalizeCommentTree(comments)
  if (!tree.length) {
    return (
      <p className="text-sm text-center py-4 text-[color:var(--text-muted)]">
        Sé el primero en comentar
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {tree.map((c) => (
        <CommentRow key={c._id || c.id} comment={c} onReply={onReply} />
      ))}
    </div>
  )
}
