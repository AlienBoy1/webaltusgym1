import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiX, FiSend, FiImage, FiVideo } from 'react-icons/fi'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { Avatar } from '../utils/avatarUtils'

const MAX_VIDEO_SECONDS = 30
const MAX_VIDEO_BYTES = 12 * 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export default function StoriesRail() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [reactions, setReactions] = useState([])
  const [viewer, setViewer] = useState(null) // { groupIndex, storyIndex }
  const [composeOpen, setComposeOpen] = useState(false)
  const [caption, setCaption] = useState('')
  const [mediaPreview, setMediaPreview] = useState(null)
  const [mediaType, setMediaType] = useState(null)
  const [mediaData, setMediaData] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [reply, setReply] = useState('')
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const progressRef = useRef(null)
  const timerRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/stories/feed')
      setGroups(data.groups || [])
      setReactions(data.reactions || [])
    } catch {
      setGroups([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openGroup = (groupIndex, storyIndex = 0) => {
    setViewer({ groupIndex, storyIndex })
    setReply('')
  }

  const currentGroup = viewer != null ? groups[viewer.groupIndex] : null
  const currentStory =
    currentGroup && viewer != null ? currentGroup.stories[viewer.storyIndex] : null

  const closeViewer = () => {
    setViewer(null)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    load()
  }

  const markViewed = async (story) => {
    if (!story || story.viewed) return
    try {
      await api.post(`/stories/${story._id || story.id}/view`)
    } catch {
      /* ignore */
    }
  }

  const goNext = useCallback(() => {
    if (viewer == null) return
    const group = groups[viewer.groupIndex]
    if (!group) return closeViewer()
    if (viewer.storyIndex < group.stories.length - 1) {
      setViewer({ groupIndex: viewer.groupIndex, storyIndex: viewer.storyIndex + 1 })
    } else if (viewer.groupIndex < groups.length - 1) {
      setViewer({ groupIndex: viewer.groupIndex + 1, storyIndex: 0 })
    } else {
      closeViewer()
    }
  }, [viewer, groups])

  const goPrev = () => {
    if (viewer == null) return
    if (viewer.storyIndex > 0) {
      setViewer({ groupIndex: viewer.groupIndex, storyIndex: viewer.storyIndex - 1 })
    } else if (viewer.groupIndex > 0) {
      const prev = groups[viewer.groupIndex - 1]
      setViewer({
        groupIndex: viewer.groupIndex - 1,
        storyIndex: Math.max(0, (prev?.stories?.length || 1) - 1)
      })
    }
  }

  useEffect(() => {
    if (!currentStory) return undefined
    markViewed(currentStory)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    const duration = currentStory.mediaType === 'video' ? MAX_VIDEO_SECONDS * 1000 : 5500
    timerRef.current = window.setTimeout(goNext, duration)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [currentStory?._id, currentStory?.id, goNext])

  const react = async (emoji) => {
    if (!currentStory) return
    try {
      const { data } = await api.post(`/stories/${currentStory._id || currentStory.id}/react`, {
        emoji
      })
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          stories: g.stories.map((s) =>
            (s._id || s.id) === (data._id || data.id) ? { ...s, ...data } : s
          )
        }))
      )
    } catch {
      toast.error('No se pudo reaccionar')
    }
  }

  const sendReply = () => {
    if (!currentStory || !reply.trim()) return
    const target = currentStory.user
    navigate('/chat', {
      state: {
        startWith: {
          _id: target._id || target.id,
          name: target.name,
          avatar: target.avatar
        },
        prefill: `Re: tu historia — ${reply.trim()}`
      }
    })
    closeViewer()
  }

  const readFile = (file, type) => {
    if (type === 'image' && file.size > MAX_IMAGE_BYTES) {
      toast.error('Imagen máximo 5MB')
      return
    }
    if (type === 'video' && file.size > MAX_VIDEO_BYTES) {
      toast.error('Video máximo 12MB / 30s')
      return
    }

    const apply = () => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setMediaData(e.target.result)
        setMediaPreview(e.target.result)
        setMediaType(type)
        setComposeOpen(true)
      }
      reader.readAsDataURL(file)
    }

    if (type === 'video') {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        if (video.duration > MAX_VIDEO_SECONDS + 0.4) {
          toast.error(`El video debe durar máximo ${MAX_VIDEO_SECONDS}s`)
          return
        }
        apply()
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        toast.error('No se pudo leer el video')
      }
      video.src = url
      return
    }

    apply()
  }

  const publish = async () => {
    if (!mediaData || !mediaType) return
    setPublishing(true)
    try {
      await api.post('/stories', {
        mediaType,
        mediaUrl: mediaData,
        caption: caption.trim()
      })
      toast.success('Historia publicada')
      setComposeOpen(false)
      setCaption('')
      setMediaData(null)
      setMediaPreview(null)
      setMediaType(null)
      load()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al publicar')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      <div className="-mx-1 mb-4 overflow-x-auto scrollbar-hide px-1">
        <div className="flex gap-3 pb-1">
          {/* Add story */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
          >
            <div className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full bg-dark-200 ring-2 ring-dashed ring-white/20">
              <Avatar avatar={user?.avatar} name={user?.name} size="story" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-black">
                <FiPlus size={14} />
              </span>
            </div>
            <span className="w-full truncate text-center text-[11px] text-gray-400">Tu historia</span>
          </button>

          {groups.map((group, idx) => {
            const uid = group.user?._id || group.user
            const isMine = uid === user?._id
            const ring = group.hasUnseen || isMine
              ? 'bg-gradient-to-tr from-primary-500 to-accent-cyan'
              : 'bg-white/20'
            return (
              <button
                key={uid}
                type="button"
                onClick={() => openGroup(idx)}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
              >
                <div className={`rounded-full p-[2px] ${ring}`}>
                  <div className="rounded-full bg-dark-500 p-[2px]">
                    <Avatar avatar={group.user?.avatar} name={group.user?.name} size="story" />
                  </div>
                </div>
                <span className="w-full truncate text-center text-[11px] text-gray-300">
                  {isMine ? 'Tú' : group.user?.name?.split(' ')[0] || 'User'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-3 flex gap-2 px-1">
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-medium text-gray-200 sm:flex-none sm:px-4"
        >
          <FiImage size={14} /> Foto
        </button>
        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-medium text-gray-200 sm:flex-none sm:px-4"
        >
          <FiVideo size={14} /> Video 30s
        </button>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file, 'image')
          e.target.value = ''
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file, 'video')
          e.target.value = ''
        }}
      />

      {/* Compose */}
      <AnimatePresence>
        {composeOpen && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 sm:items-center sm:p-4">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-dark-200 sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <p className="font-semibold">Nueva historia</p>
                <button type="button" onClick={() => setComposeOpen(false)} className="p-2 text-gray-400">
                  <FiX />
                </button>
              </div>
              <div className="relative max-h-[50vh] bg-black">
                {mediaType === 'video' ? (
                  <video src={mediaPreview} controls className="mx-auto max-h-[50vh] w-full object-contain" />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="mx-auto max-h-[50vh] w-full object-contain" />
                )}
              </div>
              <div className="space-y-3 p-4">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                  placeholder="Descripción (estilo WhatsApp)…"
                  rows={2}
                  className="input-field resize-none text-sm"
                />
                <button
                  type="button"
                  disabled={publishing}
                  onClick={publish}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-60"
                >
                  {publishing ? 'Publicando…' : 'Compartir historia'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Viewer */}
      <AnimatePresence>
        {currentStory && currentGroup && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black">
            <div className="relative flex h-full w-full max-w-lg flex-col">
              {/* Progress bars */}
              <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                {currentGroup.stories.map((s, i) => (
                  <div key={s._id || s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
                    <div
                      ref={i === viewer.storyIndex ? progressRef : null}
                      className={`h-full bg-white ${i < viewer.storyIndex ? 'w-full' : i === viewer.storyIndex ? 'animate-story-progress' : 'w-0'}`}
                      style={
                        i === viewer.storyIndex
                          ? {
                              animationDuration:
                                currentStory.mediaType === 'video' ? `${MAX_VIDEO_SECONDS}s` : '5.5s'
                            }
                          : undefined
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="absolute left-0 right-0 top-6 z-20 flex items-center justify-between px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <div className="flex items-center gap-2">
                  <Avatar avatar={currentGroup.user?.avatar} name={currentGroup.user?.name} size="sm" />
                  <span className="text-sm font-semibold text-white drop-shadow">
                    {currentGroup.user?.name}
                  </span>
                </div>
                <button type="button" onClick={closeViewer} className="rounded-full bg-black/40 p-2 text-white">
                  <FiX size={18} />
                </button>
              </div>

              <div className="relative flex flex-1 items-center justify-center">
                <button type="button" className="absolute inset-y-0 left-0 z-10 w-1/3" onClick={goPrev} aria-label="Anterior" />
                <button type="button" className="absolute inset-y-0 right-0 z-10 w-1/3" onClick={goNext} aria-label="Siguiente" />
                {currentStory.mediaType === 'video' ? (
                  <video
                    key={currentStory._id || currentStory.id}
                    src={currentStory.mediaUrl}
                    autoPlay
                    playsInline
                    className="max-h-full max-w-full object-contain"
                    onEnded={goNext}
                  />
                ) : (
                  <img
                    src={currentStory.mediaUrl}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>

              {currentStory.caption && (
                <p className="absolute bottom-36 left-4 right-4 z-20 rounded-xl bg-black/45 px-3 py-2 text-center text-sm text-white backdrop-blur-sm">
                  {currentStory.caption}
                </p>
              )}

              <div className="absolute bottom-0 left-0 right-0 z-20 space-y-3 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
                <div className="flex justify-center gap-2">
                  {reactions.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      title={r.label}
                      onClick={() => react(r.emoji)}
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-xl transition ${
                        currentStory.myReaction === r.emoji
                          ? 'bg-primary-500/40 ring-2 ring-primary-400 scale-110'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      {r.emoji}
                    </button>
                  ))}
                </div>
                {(currentGroup.user?._id || currentGroup.user) !== user?._id && (
                  <div className="flex gap-2">
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Responder en chat…"
                      className="input-field flex-1 py-2.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={sendReply}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500 text-black"
                    >
                      <FiSend size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
