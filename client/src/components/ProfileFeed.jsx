import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { FiMessageCircle, FiShare2, FiMoreVertical, FiTrash2 } from 'react-icons/fi'
import { Avatar } from '../utils/avatarUtils'
import PostReactionButton from './PostReactionButton'
import { AnimatePresence, motion } from 'framer-motion'
import { MentionText } from './MentionInput'
import ProtectedMedia from './ProtectedMedia'
import ChallengePostCard from './ChallengePostCard'
import QySiShareCard, { isQySiShareData } from './QySiShareCard'
import { countComments } from '../utils/commentTree'

/**
 * Facebook-style profile posts feed with Qyntra native styling.
 * Card click → PostDetailSheet (via onOpenPost). Comments / share / react fully enabled.
 */
export default function ProfileFeed({
  posts = [],
  loading = false,
  emptyLabel = 'Aún no hay publicaciones',
  onOpenRoutine,
  currentUserId = null,
  onDelete,
  onReact,
  onShare,
  onShowReactors,
  onOpenPost,
  onOpenImage
}) {
  const [menuPostId, setMenuPostId] = useState(null)

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-[color:var(--bg-muted)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-[color:var(--bg-muted)]" />
                <div className="h-2 w-20 rounded bg-[color:var(--bg-muted)]" />
              </div>
            </div>
            <div className="mb-3 h-4 w-3/4 rounded bg-[color:var(--bg-muted)]" />
            <div className="h-48 rounded-xl bg-[color:var(--bg-muted)]" />
          </div>
        ))}
      </div>
    )
  }

  if (!posts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--border-subtle)] px-4 py-10 text-center text-sm text-[color:var(--text-muted)]">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const author = typeof post.user === 'object' ? post.user : null
        const authorId = author?._id || author?.id
        const likes = Array.isArray(post.likes) ? post.likes.length : (post.likesCount || 0)
        const comments = countComments(post.comments)
        const created = post.createdAt || post.created_at
        const workout = post.workoutData || post.workout_data
        const isOwner = currentUserId && (authorId === currentUserId || post.userId === currentUserId)
        const myReaction = post.myReaction || null
        const pid = post._id || post.id

        return (
          <article
            key={pid}
            className="relative overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] shadow-[0_8px_24px_var(--shadow-color)] cursor-pointer"
            onClick={(e) => {
              // Don't open detail when interacting with buttons/links inside
              if (e.target.closest('button, a, [data-no-post-open]')) return
              onOpenPost?.(post)
            }}
          >
            <header className="flex items-center gap-3 px-4 pt-4 pb-2">
              <Link to={author?.username ? `/user/${author.username}` : authorId ? `/user/${authorId}` : '#'} data-no-post-open>
                <Avatar avatar={author?.avatar} name={author?.name} size="md" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to={author?.username ? `/user/${author.username}` : authorId ? `/user/${authorId}` : '#'}
                  className="truncate font-semibold text-[color:var(--text-primary)] hover:text-[color:var(--color-primary)]"
                  data-no-post-open
                >
                  {author?.name || 'Usuario'}
                </Link>
                {author?.username && (
                  <p className="text-xs text-primary-500 truncate">@{author.username}</p>
                )}
                <p className="text-xs text-[color:var(--text-muted)]">
                  {created
                    ? formatDistanceToNow(new Date(created), { addSuffix: true, locale: es })
                    : ''}
                </p>
              </div>
              {isOwner && (
                <div className="relative" data-no-post-open>
                  <button
                    type="button"
                    onClick={() => setMenuPostId(menuPostId === pid ? null : pid)}
                    className="rounded-lg p-2 text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]"
                    aria-label="Opciones"
                  >
                    <FiMoreVertical size={18} />
                  </button>
                  <AnimatePresence>
                    {menuPostId === pid && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-xl"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-400 hover:bg-[color:var(--bg-muted)]"
                          onClick={() => {
                            setMenuPostId(null)
                            onDelete?.(pid)
                          }}
                        >
                          <FiTrash2 /> Eliminar
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </header>

            {post.content && !String(post.content).includes('[workout]') && (
              <p className="px-4 pb-3 text-[15px] leading-relaxed text-[color:var(--text-primary)] whitespace-pre-wrap break-words">
                <MentionText text={post.content} />
              </p>
            )}

            {workout &&
              (post.postType === 'challenge' || workout.shareKind === 'challenge') && (
                <div className="mx-4 mb-3" data-no-post-open>
                  <ChallengePostCard data={workout} />
                </div>
              )}

            {workout && isQySiShareData(workout) && (
              <div className="mx-4 mb-3" data-no-post-open>
                <QySiShareCard data={workout} variant="feed" />
              </div>
            )}

            {workout &&
              post.postType !== 'challenge' &&
              workout.shareKind !== 'challenge' &&
              !isQySiShareData(workout) && (
              <button
                type="button"
                data-no-post-open
                onClick={() => onOpenRoutine?.(workout, author)}
                className="mx-4 mb-3 block w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-[rgba(var(--color-primary-rgb),0.28)] bg-gradient-to-br from-[rgba(var(--color-primary-rgb),0.14)] to-[rgba(var(--color-accent-rgb),0.08)] p-4 text-left transition hover:border-[rgba(var(--color-primary-rgb),0.5)]"
              >
                <h4 className="font-display text-xl tracking-wide">{workout.name || workout.challengeTitle}</h4>
                <p className="mt-2 text-xs text-[color:var(--color-primary)]">Tocar para ver la rutina completa</p>
              </button>
            )}

            {post.images?.length > 0 && (
              <div
                data-no-post-open
                className={`grid gap-0.5 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
              >
                {post.images.slice(0, 4).map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    data-protected-media="1"
                    onClick={() => onOpenImage?.(post, idx)}
                    className={`relative overflow-hidden bg-[color:var(--bg-muted)] text-left ${
                      post.images.length === 1 ? 'max-h-[420px]' : 'aspect-square'
                    }`}
                  >
                    <ProtectedMedia
                      src={img}
                      alt=""
                      className="h-full w-full object-cover transition hover:scale-[1.02]"
                    />
                  </button>
                ))}
              </div>
            )}

            <footer
              className="flex items-center justify-between border-t border-[color:var(--border-subtle)] px-2 py-1.5 text-[color:var(--text-secondary)]"
              data-no-post-open
              onClick={(e) => e.stopPropagation()}
            >
              <PostReactionButton
                myReaction={myReaction}
                likesCount={likes}
                reactionSummary={post.reactionSummary || []}
                onReact={(emoji) => onReact?.(pid, emoji)}
                onShowReactors={() => onShowReactors?.(post)}
              />
              <button
                type="button"
                onClick={() => onOpenPost?.(post)}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:text-primary-500 transition"
                aria-label="Ver comentarios"
              >
                <FiMessageCircle size={17} /> {comments}
              </button>
              <button
                type="button"
                onClick={() => onShare?.(post)}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:text-accent-cyan transition"
                aria-label="Compartir"
              >
                <FiShare2 size={17} />
              </button>
            </footer>
          </article>
        )
      })}
    </div>
  )
}
