import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { FiActivity, FiArrowLeft, FiClock, FiSend, FiShare2, FiX } from 'react-icons/fi'
import api from '../utils/api'
import { useAuthStore } from '../store/authStore'
import { Avatar } from '../utils/avatarUtils'
import MentionInput, { MentionText } from './MentionInput'
import PostReactionButton from './PostReactionButton'
import PostCommentsList from './PostCommentsList'
import PostReactorsModal from './PostReactorsModal'
import PostImageViewer from './PostImageViewer'
import ProtectedMedia from './ProtectedMedia'
import SharedPostAttachment from './SharedPostAttachment'
import ChallengePostCard from './ChallengePostCard'
import { countComments, normalizeCommentTree } from '../utils/commentTree'
import { useHistoryBackLayer } from '../hooks/useHistoryBackLayer'
import toast from 'react-hot-toast'

/**
 * Native full-screen post detail (opaque portal above app chrome).
 * Must portal to document.body — parent motion/transform breaks position:fixed.
 */
export default function PostDetailSheet({
  open,
  post: initialPost,
  onClose,
  onShare,
  onOpenRoutine,
  onPostUpdated
}) {
  const { user } = useAuthStore()
  const [post, setPost] = useState(initialPost)
  const [loading, setLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [commenting, setCommenting] = useState(false)
  const [showReactors, setShowReactors] = useState(false)
  const [imageViewerIndex, setImageViewerIndex] = useState(null)

  const postId = post?._id || post?.id || initialPost?._id || initialPost?.id

  const loadPost = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/social/post/${postId}`)
      setPost(data)
      onPostUpdated?.(data)
    } catch {
      setPost(initialPost)
    } finally {
      setLoading(false)
    }
  }, [postId, initialPost, onPostUpdated])

  useEffect(() => {
    if (!open) return
    setPost(initialPost)
    setCommentText('')
    setReplyTo(null)
    setImageViewerIndex(null)
    loadPost()
  }, [open, postId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.dataset.qyntraPostDetail = '1'
    return () => {
      document.body.style.overflow = prev
      delete document.body.dataset.qyntraPostDetail
    }
  }, [open])

  // Hardware back closes detail (stable handler — avoid re-push on onClose identity churn)
  const handleClose = useHistoryBackLayer(
    open,
    () => onClose?.(),
    `post-detail-${postId || 'x'}`
  )

  const handleReact = async (emoji) => {
    if (!postId) return
    try {
      const { data } = await api.post(`/social/${postId}/like`, { emoji })
      const uid = user?._id || user?.id
      let likes = [...(post.likes || [])]
      const has = likes.some((id) => (id?._id || id) === uid)
      const nextReaction = data.liked ? data.myReaction || emoji || '❤️' : null
      if (data.liked && !has) likes.push(uid)
      if (!data.liked) likes = likes.filter((id) => (id?._id || id) !== uid)

      let reactors = [...(post.reactors || [])]
      const prev = post.myReaction
      if (prev) reactors = reactors.filter((r) => r.userId !== uid)
      if (nextReaction) {
        reactors = [
          ...reactors.filter((r) => r.userId !== uid),
          {
            userId: uid,
            emoji: nextReaction,
            name: user?.name,
            username: user?.username,
            avatar: user?.avatar
          }
        ]
      }

      const next = {
        ...post,
        likes,
        myReaction: nextReaction,
        reactionSummary: Array.isArray(data.reactionSummary)
          ? data.reactionSummary
          : post.reactionSummary,
        reactors
      }
      setPost(next)
      onPostUpdated?.(next)
    } catch {
      toast.error('Error al reaccionar')
    }
  }

  const handleComment = async () => {
    if (!commentText.trim() || !postId) return
    setCommenting(true)
    try {
      const replyUser = typeof replyTo?.user === 'object' ? replyTo.user : null
      let content = commentText.trim()
      if (replyTo && replyUser?.username && !content.includes(`@${replyUser.username}`)) {
        content = `@${replyUser.username} ${content}`
      }
      const { data } = await api.post(`/social/${postId}/comment`, {
        content,
        parentId: replyTo?._id || replyTo?.id || null
      })
      const comments = normalizeCommentTree(data)
      const next = { ...post, comments }
      setPost(next)
      onPostUpdated?.(next)
      setCommentText('')
      setReplyTo(null)
      toast.success(replyTo ? 'Respuesta publicada' : 'Comentario publicado')
    } catch {
      toast.error('Error al comentar')
    } finally {
      setCommenting(false)
    }
  }

  if (typeof document === 'undefined') return null

  const author = typeof post?.user === 'object' ? post.user : null
  const authorId = author?._id || author?.id
  const created = post?.createdAt || post?.created_at
  const workout = post?.workoutData || post?.workout_data
  const commentsCount = countComments(post?.comments)
  const isChallenge =
    workout &&
    (post?.postType === 'challenge' || workout.shareKind === 'challenge')
  const isRoutine =
    workout &&
    !isChallenge &&
    (post?.postType === 'routine' || workout.isRoutine || workout.shareKind === 'routine')
  const isCompletedWorkout =
    workout && !isRoutine && !isChallenge && (post?.postType === 'workout' || Boolean(workout))

  const contentText = post?.content
    ? String(post.content).includes('[workout]')
      ? String(post.content)
          .replace(/\[workout\][\s\S]*?\[\/workout\]/g, '')
          .trim()
      : String(post.content)
    : ''

  const sheet = (
    <AnimatePresence>
      {open && post && (
        <motion.div
          key="post-detail-sheet"
          className="fixed inset-0 z-[110] flex flex-col bg-app"
          style={{
            backgroundColor: 'var(--bg-app)',
            WebkitOverflowScrolling: 'touch'
          }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-detail-title"
        >
          {/* Solid cover so nothing from Community bleeds through */}
          <div
            className="absolute inset-0 bg-app -z-10"
            style={{ backgroundColor: 'var(--bg-app)' }}
            aria-hidden
          />

          <header
            className="relative z-10 flex items-center gap-1 px-2 sm:px-3 py-2.5 sm:py-3 border-b border-app bg-elevated shrink-0"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              paddingTop: 'max(0.625rem, env(safe-area-inset-top))'
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              className="p-2.5 rounded-xl text-app-secondary hover:bg-[color:var(--bg-muted)] transition"
              aria-label="Volver"
            >
              <FiArrowLeft size={22} />
            </button>
            <h2
              id="post-detail-title"
              className="font-display text-base sm:text-lg flex-1 tracking-wide text-app"
            >
              Publicación
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="p-2.5 rounded-xl text-app-secondary hover:bg-[color:var(--bg-muted)] transition"
              aria-label="Cerrar"
            >
              <FiX size={20} />
            </button>
          </header>

          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {loading && !contentText && !post?.images?.length && !workout ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-2 border-app border-t-primary-500 rounded-full animate-spin" />
              </div>
            ) : (
              <article className="max-w-xl mx-auto w-full pb-6">
                <header className="flex items-start gap-3 px-4 pt-4 pb-3">
                  <Link
                    to={
                      author?.username
                        ? `/user/${author.username}`
                        : authorId
                          ? `/user/${authorId}`
                          : '#'
                    }
                    onClick={handleClose}
                    className="shrink-0"
                  >
                    <Avatar avatar={author?.avatar} name={author?.name} size="md" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={
                          author?.username
                            ? `/user/${author.username}`
                            : authorId
                              ? `/user/${authorId}`
                              : '#'
                        }
                        onClick={handleClose}
                        className="font-semibold text-app hover:text-primary-500 truncate"
                      >
                        {author?.name || 'Usuario'}
                      </Link>
                      {author?.membership?.plan && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent-purple/20 text-accent-purple font-semibold uppercase">
                          {author.membership.plan}
                        </span>
                      )}
                    </div>
                    {author?.username && (
                      <p className="text-xs text-primary-500 truncate">@{author.username}</p>
                    )}
                    <p className="text-xs text-app-secondary mt-0.5">
                      {created
                        ? formatDistanceToNow(new Date(created), { addSuffix: true, locale: es })
                        : ''}
                    </p>
                  </div>
                </header>

                {/* Challenge share card */}
                {!post.sharedFrom && isChallenge && (
                  <div className="mx-4 mb-4">
                    <ChallengePostCard data={workout} />
                  </div>
                )}

                {/* Completed workout card */}
                {!post.sharedFrom && isCompletedWorkout && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenRoutine?.(
                        { ...workout, user: author },
                        author
                      )
                    }
                    className="mx-4 mb-4 block w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-primary-500/25 bg-gradient-to-br from-primary-500/15 to-accent-cyan/10 p-4 text-left transition hover:border-primary-500/50"
                  >
                    <div className="mb-3 flex items-center gap-2 text-primary-500">
                      <FiActivity size={16} />
                      <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                        Entrenamiento realizado
                      </span>
                    </div>
                    <h4 className="font-display text-xl text-app">{workout.name}</h4>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-elevated border border-app p-2">
                        <p className="text-lg font-semibold text-app">
                          {workout.completedExercises}/{workout.totalExercises}
                        </p>
                        <p className="text-[10px] text-app-secondary">Ejercicios</p>
                      </div>
                      <div className="rounded-xl bg-elevated border border-app p-2">
                        <p className="text-lg font-semibold text-app">{workout.totalSets || '—'}</p>
                        <p className="text-[10px] text-app-secondary">Series</p>
                      </div>
                      <div className="rounded-xl bg-elevated border border-app p-2">
                        <p className="inline-flex items-center justify-center gap-1 text-lg font-semibold text-app">
                          <FiClock size={12} className="text-primary-500" />
                          {Math.floor((workout.durationSeconds || 0) / 60)}m
                        </p>
                        <p className="text-[10px] text-app-secondary">Tiempo</p>
                      </div>
                    </div>
                    {workout.exercises?.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-app pt-3">
                        {workout.exercises.slice(0, 6).map((ex, idx) => (
                          <li key={idx} className="flex justify-between text-xs text-app-secondary">
                            <span className="truncate pr-2">{ex.name}</span>
                            <span className="shrink-0 opacity-70">
                              {ex.sets}×{ex.reps}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 text-xs text-primary-500">Tocar para ver detalle</p>
                  </button>
                )}

                {/* Routine share card */}
                {!post.sharedFrom && isRoutine && (
                  <button
                    type="button"
                    onClick={() => onOpenRoutine?.({ ...workout, user: author }, author)}
                    className="mx-4 mb-4 block w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-accent-cyan/30 bg-gradient-to-br from-accent-cyan/15 to-primary-500/10 p-4 text-left transition hover:border-accent-cyan/50"
                  >
                    <div className="mb-3 flex items-center gap-2 text-accent-cyan">
                      <FiActivity size={16} />
                      <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                        Rutina · Comunidad
                      </span>
                    </div>
                    <h4 className="font-display text-xl text-app">{workout.name}</h4>
                    <p className="mt-1 text-sm text-app-secondary">
                      {workout.totalExercises || workout.exercises?.length || 0} ejercicios
                      {workout.totalSets ? ` · ${workout.totalSets} series` : ''}
                    </p>
                    {workout.exercises?.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-app pt-3">
                        {workout.exercises.slice(0, 6).map((ex, idx) => (
                          <li key={idx} className="flex justify-between text-xs text-app-secondary">
                            <span className="truncate pr-2">{ex.name}</span>
                            <span className="shrink-0 opacity-70">
                              {ex.sets}×{ex.reps}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 text-xs text-accent-cyan">Tocar para ver e iniciar esta rutina</p>
                  </button>
                )}

                {contentText && (
                  <p className="px-4 pb-3 text-[15px] leading-relaxed text-app whitespace-pre-wrap break-words">
                    <MentionText text={contentText} />
                  </p>
                )}

                {post.images?.length > 0 && (
                  <div
                    className={`mx-4 mb-3 overflow-hidden rounded-2xl grid gap-0.5 ${
                      post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                    }`}
                  >
                    {post.images.slice(0, 4).map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        data-protected-media="1"
                        onClick={() => setImageViewerIndex(idx)}
                        className={`relative bg-[color:var(--bg-muted)] text-left ${
                          post.images.length === 1 ? 'max-h-[min(70vh,520px)]' : 'aspect-square'
                        }`}
                      >
                        <ProtectedMedia
                          src={img}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {post.sharedFrom && (
                  <div className="px-4 mb-3">
                    <SharedPostAttachment
                      shared={post.sharedFrom}
                      onOpenRoutine={(w, a) => onOpenRoutine?.(w, a)}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between border-y border-app px-2 py-1.5 mt-1 bg-elevated/40">
                  <PostReactionButton
                    myReaction={post.myReaction || null}
                    likesCount={
                      Array.isArray(post.likes) ? post.likes.length : post.likesCount || 0
                    }
                    reactionSummary={post.reactionSummary || []}
                    onReact={handleReact}
                    onShowReactors={() => setShowReactors(true)}
                  />
                  <span className="text-sm text-app-secondary px-3 tabular-nums">
                    {commentsCount} {commentsCount === 1 ? 'comentario' : 'comentarios'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onShare?.(post)}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-app-secondary hover:text-accent-cyan transition"
                    aria-label="Compartir"
                  >
                    <FiShare2 size={17} />
                  </button>
                </div>

                <div className="px-4 py-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] mb-3 text-app-secondary">
                    Comentarios
                  </h3>
                  <PostCommentsList
                    comments={post.comments || []}
                    onCommentsChange={(comments) => {
                      const next = { ...post, comments }
                      setPost(next)
                      onPostUpdated?.(next)
                    }}
                    onReply={(c) => {
                      setReplyTo(c)
                      const u = typeof c.user === 'object' ? c.user : null
                      if (u?.username) {
                        setCommentText((prev) =>
                          prev.includes(`@${u.username}`) ? prev : `@${u.username} `
                        )
                      }
                    }}
                  />
                </div>
              </article>
            )}
          </div>

          <footer
            className="relative z-10 border-t border-app bg-elevated px-3 py-2.5 shrink-0"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))'
            }}
          >
            {replyTo && (
              <div className="flex items-center justify-between mb-2 px-1 text-xs text-app-secondary">
                <span>
                  Respondiendo a{' '}
                  <strong className="text-app">{replyTo.user?.name || 'usuario'}</strong>
                </span>
                <button type="button" onClick={() => setReplyTo(null)} className="text-primary-500 font-medium">
                  Cancelar
                </button>
              </div>
            )}
            <div className="flex gap-2 items-center max-w-xl mx-auto w-full">
              <Avatar avatar={user?.avatar} name={user?.name} size="sm" />
              <MentionInput
                as="input"
                value={commentText}
                onChange={setCommentText}
                placeholder={replyTo ? 'Escribe una respuesta…' : 'Escribe un comentario…'}
                className="input-field flex-1 text-sm min-w-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleComment()
                  }
                }}
              />
              <button
                type="button"
                onClick={handleComment}
                disabled={!commentText.trim() || commenting}
                className="btn-primary shrink-0 w-11 h-11 rounded-full flex items-center justify-center p-0 disabled:opacity-50"
                aria-label="Enviar"
              >
                {commenting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FiSend size={16} />
                )}
              </button>
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      {createPortal(sheet, document.body)}
      <PostReactorsModal
        open={showReactors}
        onClose={() => setShowReactors(false)}
        postId={postId}
        reactors={post?.reactors || []}
      />
      <PostImageViewer
        open={imageViewerIndex != null && Boolean(post?.images?.length)}
        post={post}
        initialIndex={imageViewerIndex || 0}
        onClose={() => setImageViewerIndex(null)}
        onShare={(p) => {
          setImageViewerIndex(null)
          onShare?.(p)
        }}
        onPostUpdated={(updated) => {
          if (!updated) return
          setPost(updated)
          onPostUpdated?.(updated)
        }}
      />
    </>
  )
}
