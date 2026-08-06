import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiChevronLeft, FiChevronRight, FiMessageCircle, FiSend, FiShare2, FiX } from 'react-icons/fi'
import api from '../utils/api'
import { useAuthStore } from '../store/authStore'
import { Avatar } from '../utils/avatarUtils'
import MentionInput, { MentionText } from './MentionInput'
import PostReactionButton from './PostReactionButton'
import PostCommentsList from './PostCommentsList'
import PostReactorsModal from './PostReactorsModal'
import { countComments, normalizeCommentTree } from '../utils/commentTree'
import toast from 'react-hot-toast'
import ProtectedMedia from './ProtectedMedia'

/**
 * Facebook-style fullscreen photo viewer for post images.
 * Native react / comment sheet / share — portal above app chrome.
 */
export default function PostImageViewer({
  open,
  onClose,
  post: initialPost,
  initialIndex = 0,
  onShare,
  onPostUpdated
}) {
  const { user } = useAuthStore()
  const [post, setPost] = useState(initialPost)
  const [index, setIndex] = useState(initialIndex)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [showReactors, setShowReactors] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [commenting, setCommenting] = useState(false)
  const touchStartX = useRef(null)

  const images = Array.isArray(post?.images) ? post.images : []
  const postId = post?._id || post?.id
  const author = typeof post?.user === 'object' ? post.user : null
  const authorId = author?._id || author?.id
  const commentsCount = countComments(post?.comments)

  useEffect(() => {
    if (!open) return
    setPost(initialPost)
    setIndex(Math.min(Math.max(0, initialIndex), Math.max(0, (initialPost?.images?.length || 1) - 1)))
    setCommentsOpen(false)
    setCommentText('')
    setReplyTo(null)
  }, [open, initialPost, initialIndex])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.dataset.qyntraImageViewer = '1'
    return () => {
      document.body.style.overflow = prev
      delete document.body.dataset.qyntraImageViewer
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    window.history.pushState({ qyntraImageViewer: true }, '')
    const onPop = () => {
      if (commentsOpen) {
        setCommentsOpen(false)
        window.history.pushState({ qyntraImageViewer: true }, '')
        return
      }
      onClose?.()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [open, commentsOpen, onClose])

  const requestClose = useCallback(() => {
    if (window.history.state?.qyntraImageViewer) {
      window.history.back()
      return
    }
    onClose?.()
  }, [onClose])

  const go = (dir) => {
    if (images.length < 2) return
    setIndex((i) => (i + dir + images.length) % images.length)
  }

  const applyReactionLocal = (data, emoji) => {
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
  }

  const handleReact = async (emoji) => {
    if (!postId) return
    try {
      const { data } = await api.post(`/social/${postId}/like`, { emoji })
      applyReactionLocal(data, emoji)
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
  if (!open || !post || !images.length) return null

  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="post-image-viewer"
          className="fixed inset-0 z-[125] flex flex-col bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Vista de imagen"
        >
          {/* Header */}
          <header
            className="relative z-20 flex items-center gap-3 px-3 py-3"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <button
              type="button"
              onClick={requestClose}
              className="rounded-full bg-white/10 p-2.5 text-white backdrop-blur-md transition hover:bg-white/20"
              aria-label="Cerrar"
            >
              <FiX size={20} />
            </button>
            <Link
              to={author?.username ? `/user/${author.username}` : authorId ? `/user/${authorId}` : '#'}
              onClick={requestClose}
              className="flex min-w-0 flex-1 items-center gap-2.5"
            >
              <Avatar avatar={author?.avatar} name={author?.name} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{author?.name || 'Usuario'}</p>
                {author?.username && (
                  <p className="truncate text-[11px] text-white/60">@{author.username}</p>
                )}
              </div>
            </Link>
            {images.length > 1 && (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/85 backdrop-blur-md">
                {index + 1} / {images.length}
              </span>
            )}
          </header>

          {/* Image stage */}
          <div
            className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-1"
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0]?.clientX ?? null
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current == null) return
              const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current
              touchStartX.current = null
              if (Math.abs(dx) < 48) return
              go(dx < 0 ? 1 : -1)
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`${postId}-${index}`}
                className="flex max-h-full max-w-full items-center justify-center"
                data-protected-media="1"
                initial={{ opacity: 0.4, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.35, scale: 0.99 }}
                transition={{ duration: 0.18 }}
              >
                <ProtectedMedia
                  src={images[index]}
                  alt=""
                  className="max-h-[min(78dvh,900px)] max-w-full select-none object-contain"
                />
              </motion.div>
            </AnimatePresence>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/45 p-2.5 text-white backdrop-blur-md transition hover:bg-black/65 sm:inline-flex"
                  aria-label="Anterior"
                >
                  <FiChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/45 p-2.5 text-white backdrop-blur-md transition hover:bg-black/65 sm:inline-flex"
                  aria-label="Siguiente"
                >
                  <FiChevronRight size={22} />
                </button>
              </>
            )}
          </div>

          {/* Caption snippet */}
          {post.content && !String(post.content).includes('[workout]') && (
            <div className="relative z-20 px-4 pb-1">
              <p className="line-clamp-2 text-sm leading-relaxed text-white/80">
                <MentionText text={post.content} />
              </p>
            </div>
          )}

          {/* Actions — Facebook-style bottom bar */}
          <div
            className="relative z-20 border-t border-white/10 bg-black/70 px-2 py-2 backdrop-blur-xl sm:px-4"
            style={{ paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto flex max-w-xl items-center justify-between gap-1 text-white">
              <div className="min-w-0 flex-1 [&_button]:text-white [&_.text-app-secondary]:text-white/70">
                <PostReactionButton
                  myReaction={post.myReaction || null}
                  likesCount={Array.isArray(post.likes) ? post.likes.length : post.likesCount || 0}
                  reactionSummary={post.reactionSummary || []}
                  onReact={handleReact}
                  onShowReactors={() => setShowReactors(true)}
                />
              </div>
              <button
                type="button"
                onClick={() => setCommentsOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
              >
                <FiMessageCircle size={18} />
                <span className="tabular-nums">{commentsCount}</span>
                <span className="hidden sm:inline">Comentar</span>
              </button>
              <button
                type="button"
                onClick={() => onShare?.(post)}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
              >
                <FiShare2 size={17} />
                <span className="hidden sm:inline">Compartir</span>
              </button>
            </div>
          </div>

          {/* Comments sheet */}
          <AnimatePresence>
            {commentsOpen && (
              <motion.div
                className="absolute inset-0 z-40 flex flex-col justify-end"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  className="absolute inset-0 bg-black/55"
                  aria-label="Cerrar comentarios"
                  onClick={() => setCommentsOpen(false)}
                />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 340 }}
                  className="relative flex max-h-[78dvh] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[color:var(--bg-elevated)] shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                        Comentarios
                      </p>
                      <h3 className="font-display text-lg text-[color:var(--text-primary)]">
                        {commentsCount} {commentsCount === 1 ? 'comentario' : 'comentarios'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCommentsOpen(false)}
                      className="rounded-xl p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
                      aria-label="Cerrar"
                    >
                      <FiX size={18} />
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    <PostCommentsList
                      comments={post.comments || []}
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

                  <div
                    className="border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-3 py-2.5"
                    style={{ paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))' }}
                  >
                    {replyTo && (
                      <div className="mb-2 flex items-center justify-between px-1 text-xs text-[color:var(--text-muted)]">
                        <span>
                          Respondiendo a{' '}
                          <strong className="text-[color:var(--text-primary)]">
                            {replyTo.user?.name || 'usuario'}
                          </strong>
                        </span>
                        <button type="button" className="text-primary-500" onClick={() => setReplyTo(null)}>
                          Cancelar
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Avatar avatar={user?.avatar} name={user?.name} size="sm" />
                      <MentionInput
                        as="input"
                        value={commentText}
                        onChange={setCommentText}
                        placeholder={replyTo ? 'Escribe una respuesta…' : 'Escribe un comentario…'}
                        className="input-field min-w-0 flex-1 text-sm"
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
                        className="btn-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 disabled:opacity-50"
                        aria-label="Enviar comentario"
                      >
                        {commenting ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          <FiSend size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      {createPortal(overlay, document.body)}
      <PostReactorsModal
        open={showReactors}
        onClose={() => setShowReactors(false)}
        postId={postId}
        reactors={post?.reactors || []}
      />
    </>
  )
}
