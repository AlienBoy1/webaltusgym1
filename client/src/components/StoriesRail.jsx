import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPlus,
  FiX,
  FiSend,
  FiImage,
  FiVideo,
  FiMoreVertical,
  FiShare2,
  FiTrash2,
  FiSearch,
  FiCheck,
  FiStar,
  FiEye
} from 'react-icons/fi'
import api from '../utils/api'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { Avatar } from '../utils/avatarUtils'
import { getStorageAccessGranted } from '../utils/storageAccess'
import { useAppDialog } from './AppDialog'
import MentionInput, { MentionText } from './MentionInput'
import { dispatchStoryClose, dispatchStoryOpen } from '../utils/presence'
import ProtectedMedia from './ProtectedMedia'

const MAX_VIDEO_SECONDS = 30
const MAX_VIDEO_BYTES = 12 * 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function storyAttachment(story, kind = 'share') {
  return {
    type: 'story',
    kind,
    storyId: story._id || story.id,
    mediaType: story.mediaType,
    mediaUrl: story.mediaUrl,
    caption: story.caption || ''
  }
}

export default function StoriesRail({
  showRail = true,
  forceOpenUserId = null,
  forceOpenStoryId = null,
  onForceClose = null
} = {}) {
  const { user } = useAuthStore()
  const dialog = useAppDialog()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [groups, setGroups] = useState([])
  const [reactions, setReactions] = useState([])
  const [viewer, setViewer] = useState(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [caption, setCaption] = useState('')
  const [mediaPreview, setMediaPreview] = useState(null)
  const [mediaType, setMediaType] = useState(null)
  const [mediaData, setMediaData] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [composeContain, setComposeContain] = useState(false)
  const [reply, setReply] = useState('')
  const [replyFocused, setReplyFocused] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [albums, setAlbums] = useState([])
  const [newAlbumName, setNewAlbumName] = useState('')
  const [creatingAlbum, setCreatingAlbum] = useState(false)
  const [savingFavorite, setSavingFavorite] = useState(false)
  const [contacts, setContacts] = useState([])
  const [shareQuery, setShareQuery] = useState('')
  const [selectedShare, setSelectedShare] = useState([])
  const [sharing, setSharing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [viewersOpen, setViewersOpen] = useState(false)
  const [viewers, setViewers] = useState([])
  const [loadingViewers, setLoadingViewers] = useState(false)
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const timerRef = useRef(null)
  const storyStartedAtRef = useRef(null)
  const remainingMsRef = useRef(null)
  const openStoryHandled = useRef(null)
  const viewerWasOpenRef = useRef(false)
  const paused = menuOpen || shareOpen || favoritesOpen || viewersOpen || replyFocused || Boolean(reply.trim())
  const [progressPct, setProgressPct] = useState(0)
  const progressRafRef = useRef(null)
  const hydratingIdsRef = useRef(new Set())

  const patchStoryInGroups = useCallback((storyId, patch) => {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        stories: g.stories.map((s) =>
          (s._id || s.id) === storyId ? { ...s, ...patch, mediaDeferred: false } : s
        )
      }))
    )
  }, [])

  const hydrateStoryMedia = useCallback(
    async (story) => {
      const id = story?._id || story?.id
      if (!id || story.mediaUrl || !story.mediaDeferred) return story
      if (hydratingIdsRef.current.has(id)) return story
      hydratingIdsRef.current.add(id)
      try {
        const { data } = await api.get(`/stories/${id}`, { timeout: 45000 })
        if (data?.mediaUrl) {
          patchStoryInGroups(id, {
            mediaUrl: data.mediaUrl,
            mediaType: data.mediaType || story.mediaType,
            caption: data.caption ?? story.caption
          })
          return { ...story, ...data, mediaDeferred: false }
        }
      } catch {
        /* ignore — viewer shows placeholder */
      } finally {
        hydratingIdsRef.current.delete(id)
      }
      return story
    },
    [patchStoryInGroups]
  )

  useEffect(() => {
    const openDraft = () => {
      try {
        const raw = sessionStorage.getItem('qyntra:storyDraft')
        if (!raw) return
        const draft = JSON.parse(raw)
        sessionStorage.removeItem('qyntra:storyDraft')
        if (!draft?.mediaUrl) return
        setMediaData(draft.mediaUrl)
        setMediaPreview(draft.mediaUrl)
        setMediaType(draft.mediaType || 'image')
        setCaption(draft.caption || '')
        setComposeContain(Boolean(draft.fromPostId))
        setComposeOpen(true)
      } catch {
        /* ignore */
      }
    }
    // Only the hidden global rail (showRail=false) owns shared drafts,
    // so the Social rail instance cannot steal/clear sessionStorage.
    if (showRail) return undefined
    window.addEventListener('qyntra:open-story-compose', openDraft)
    openDraft()
    return () => window.removeEventListener('qyntra:open-story-compose', openDraft)
  }, [showRail])

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/stories/feed')
      setGroups(data.groups || [])
      setReactions(data.reactions || [])
      return data.groups || []
    } catch {
      setGroups([])
      return []
    }
  }, [])

  const openStoryFromId = useCallback(async (storyId, currentGroups) => {
    if (!storyId) return
    const list = currentGroups || groups

    const findInGroups = (gList) => {
      for (let gi = 0; gi < gList.length; gi++) {
        const si = gList[gi].stories.findIndex((s) => (s._id || s.id) === storyId)
        if (si >= 0) return { groupIndex: gi, storyIndex: si, nextGroups: gList }
      }
      return null
    }

    let pos = findInGroups(list)
    if (!pos) {
      try {
        const { data: story } = await api.get(`/stories/${storyId}`)
        const uid = story.user?._id || story.user
        const next = [...list]
        const gi = next.findIndex((g) => (g.user?._id || g.user) === uid)
        if (gi >= 0) {
          const exists = next[gi].stories.some((s) => (s._id || s.id) === (story._id || story.id))
          if (!exists) {
            next[gi] = { ...next[gi], stories: [...next[gi].stories, story] }
          }
          const si = next[gi].stories.findIndex((s) => (s._id || s.id) === (story._id || story.id))
          pos = { groupIndex: gi, storyIndex: Math.max(0, si), nextGroups: next }
        } else {
          next.unshift({ user: story.user, stories: [story], hasUnseen: false })
          pos = { groupIndex: 0, storyIndex: 0, nextGroups: next }
        }
        setGroups(pos.nextGroups)
      } catch (error) {
        const gone = error.response?.status === 410 || error.response?.status === 404
        toast.error(
          gone
            ? 'Este estado ya expiró (máx. 24h) o no está disponible'
            : 'No se pudo abrir el estado'
        )
        return
      }
    }

    setViewer({ groupIndex: pos.groupIndex, storyIndex: pos.storyIndex })
    setReply('')
    setReplyFocused(false)
    setMenuOpen(false)
  }, [groups])

  useEffect(() => {
    if (showRail) load()
  }, [load, showRail])

  useEffect(() => {
    const storyId = forceOpenStoryId || searchParams.get('openStory')
    if (!storyId) return
    if (!forceOpenStoryId && openStoryHandled.current === storyId) return
    openStoryHandled.current = storyId
    ;(async () => {
      const fresh = await load()
      await openStoryFromId(storyId, fresh)
      if (!forceOpenStoryId) {
        const next = new URLSearchParams(searchParams)
        next.delete('openStory')
        setSearchParams(next, { replace: true })
      }
    })()
  }, [forceOpenStoryId, searchParams, load, openStoryFromId, setSearchParams])

  useEffect(() => {
    const userId = forceOpenUserId || searchParams.get('openUserStory')
    if (!userId) return
    const key = `user:${userId}`
    if (!forceOpenUserId && openStoryHandled.current === key) return
    openStoryHandled.current = key
    ;(async () => {
      const fresh = await load()
      const gi = fresh.findIndex((g) => (g.user?._id || g.user) === userId)
      if (gi >= 0) {
        setViewer({ groupIndex: gi, storyIndex: 0 })
        setReply('')
        setMenuOpen(false)
        setShareOpen(false)
        setFavoritesOpen(false)
        setViewersOpen(false)
      } else {
        toast.error('Este usuario no tiene historias activas')
        onForceClose?.()
      }
      if (!forceOpenUserId) {
        const next = new URLSearchParams(searchParams)
        next.delete('openUserStory')
        setSearchParams(next, { replace: true })
      }
    })()
  }, [forceOpenUserId, searchParams, load, setSearchParams, onForceClose])

  const openGroup = (groupIndex, storyIndex = 0) => {
    setViewer({ groupIndex, storyIndex })
    setReply('')
    setReplyFocused(false)
    setMenuOpen(false)
    setShareOpen(false)
    setFavoritesOpen(false)
    setViewersOpen(false)
    setViewers([])
  }

  const currentGroup = viewer != null ? groups[viewer.groupIndex] : null
  const currentStory =
    currentGroup && viewer != null ? currentGroup.stories[viewer.storyIndex] : null
  const waitingMedia = Boolean(currentStory?.mediaDeferred && !currentStory?.mediaUrl)
  const isOwnStory =
    currentGroup &&
    (currentGroup.user?._id || currentGroup.user) === user?._id

  // Load media only when a story is opened (feed is lite / metadata-only)
  useEffect(() => {
    if (!currentStory) return undefined
    let cancelled = false
    ;(async () => {
      await hydrateStoryMedia(currentStory)
      if (cancelled || viewer == null) return
      // Prefetch next in group
      const next = currentGroup?.stories?.[viewer.storyIndex + 1]
      if (next?.mediaDeferred && !next.mediaUrl) {
        hydrateStoryMedia(next)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    currentStory?._id,
    currentStory?.id,
    currentStory?.mediaDeferred,
    currentStory?.mediaUrl,
    viewer?.groupIndex,
    viewer?.storyIndex,
    hydrateStoryMedia,
    currentGroup
  ])

  useEffect(() => {
    if (viewer != null) {
      viewerWasOpenRef.current = true
      const group = groups[viewer.groupIndex]
      dispatchStoryOpen({
        userId: group?.user?._id || group?.user || null,
        storyId: group?.stories?.[viewer.storyIndex]?._id || group?.stories?.[viewer.storyIndex]?.id || null
      })
      return
    }
    if (viewerWasOpenRef.current) {
      viewerWasOpenRef.current = false
      dispatchStoryClose()
    }
  }, [viewer, groups])

  const closeViewer = useCallback(() => {
    setViewer(null)
    setMenuOpen(false)
    setShareOpen(false)
    setFavoritesOpen(false)
    setViewersOpen(false)
    setViewers([])
    setReply('')
    setReplyFocused(false)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    openStoryHandled.current = null
    dispatchStoryClose()
    onForceClose?.()
    if (showRail) load()
  }, [showRail, load, onForceClose])

  const closeViewerRef = useRef(closeViewer)
  closeViewerRef.current = closeViewer

  const requestCloseViewer = useCallback(() => {
    if (window.history.state?.qyntraStory) {
      window.history.back()
      return
    }
    closeViewer()
  }, [closeViewer])

  // Hardware / browser back closes story viewer instead of leaving the page
  useEffect(() => {
    if (viewer == null) return undefined
    window.history.pushState({ qyntraStory: true }, '')
    const onPop = () => {
      closeViewerRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
    }
  }, [viewer != null]) // eslint-disable-line react-hooks/exhaustive-deps

  const openViewers = async () => {
    if (!currentStory || !isOwnStory) return
    setMenuOpen(false)
    setViewersOpen(true)
    setLoadingViewers(true)
    try {
      const { data } = await api.get(`/stories/${currentStory._id || currentStory.id}/viewers`)
      setViewers(data || [])
    } catch (error) {
      setViewers([])
      toast.error(error.response?.data?.message || 'No se pudieron cargar las vistas')
    } finally {
      setLoadingViewers(false)
    }
  }

  const openFavorites = async () => {
    setMenuOpen(false)
    setFavoritesOpen(true)
    setNewAlbumName('')
    try {
      const { data } = await api.get('/stories/favorites/albums')
      setAlbums(data || [])
    } catch {
      setAlbums([])
      toast.error('No se pudieron cargar los álbumes')
    }
  }

  const createAlbum = async () => {
    const name = newAlbumName.trim()
    if (!name) {
      toast.error('Escribe un nombre para el álbum')
      return
    }
    setCreatingAlbum(true)
    try {
      const { data } = await api.post('/stories/favorites/albums', { name })
      setAlbums((prev) => [...prev, data])
      setNewAlbumName('')
      toast.success('Álbum creado')
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo crear el álbum')
    } finally {
      setCreatingAlbum(false)
    }
  }

  const saveToAlbum = async (albumId) => {
    if (!currentStory) return
    setSavingFavorite(true)
    try {
      await api.post('/stories/favorites', {
        albumId,
        storyId: currentStory._id || currentStory.id
      })
      toast.success('Agregado a favoritos')
      setFavoritesOpen(false)
    } catch (error) {
      const msg =
        error.response?.status === 410
          ? 'Este estado ya expiró'
          : error.response?.data?.message || 'No se pudo guardar'
      toast.error(msg)
    } finally {
      setSavingFavorite(false)
    }
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
    if (!group) {
      if (window.history.state?.qyntraStory) window.history.back()
      else closeViewer()
      return
    }
    if (viewer.storyIndex < group.stories.length - 1) {
      setViewer({ groupIndex: viewer.groupIndex, storyIndex: viewer.storyIndex + 1 })
    } else if (viewer.groupIndex < groups.length - 1) {
      setViewer({ groupIndex: viewer.groupIndex + 1, storyIndex: 0 })
    } else {
      if (window.history.state?.qyntraStory) window.history.back()
      else closeViewer()
    }
  }, [viewer, groups, closeViewer])

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

    const fullDuration =
      currentStory.mediaType === 'video' ? MAX_VIDEO_SECONDS * 1000 : 5500

    // New story → reset remaining clock
    remainingMsRef.current = fullDuration
    storyStartedAtRef.current = null
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    markViewed(currentStory)
  }, [currentStory?._id, currentStory?.id])

  useEffect(() => {
    if (!currentStory) return undefined

    if (paused || waitingMedia) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (storyStartedAtRef.current != null) {
        const elapsed = Date.now() - storyStartedAtRef.current
        const base = remainingMsRef.current ?? 5500
        remainingMsRef.current = Math.max(0, base - elapsed)
        storyStartedAtRef.current = null
      }
      return undefined
    }

    const wait = remainingMsRef.current ?? (
      currentStory.mediaType === 'video' ? MAX_VIDEO_SECONDS * 1000 : 5500
    )
    if (wait <= 0) {
      goNext()
      return undefined
    }

    storyStartedAtRef.current = Date.now()
    timerRef.current = window.setTimeout(() => {
      remainingMsRef.current = null
      storyStartedAtRef.current = null
      goNext()
    }, wait)

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [currentStory?._id, currentStory?.id, goNext, paused, waitingMedia])

  useEffect(() => {
    if (!currentStory) { setProgressPct(0); return }
    const full = currentStory.mediaType === 'video' ? MAX_VIDEO_SECONDS * 1000 : 5500
    const computePct = () => {
      const rem = remainingMsRef.current ?? full
      const t0 = storyStartedAtRef.current
      let elapsed = full - rem
      if (t0 != null) elapsed += Date.now() - t0
      return Math.min(100, (elapsed / full) * 100)
    }
    if (paused || waitingMedia) { setProgressPct(computePct()); return }
    const tick = () => {
      setProgressPct(computePct())
      progressRafRef.current = requestAnimationFrame(tick)
    }
    progressRafRef.current = requestAnimationFrame(tick)
    return () => { if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current) }
  }, [currentStory?._id, currentStory?.id, paused, waitingMedia])

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
            (s._id || s.id) === (data._id || data.id)
              ? { ...s, ...data, mediaUrl: data.mediaUrl || s.mediaUrl, mediaDeferred: !(data.mediaUrl || s.mediaUrl) }
              : s
          )
        }))
      )
    } catch {
      toast.error('No se pudo reaccionar')
    }
  }

  const sendReply = async () => {
    if (!currentStory || !reply.trim()) return
    const story = await hydrateStoryMedia(currentStory)
    if (!story?.mediaUrl) {
      toast.error('Espera a que cargue la historia')
      return
    }
    const target = story.user || currentStory.user
    navigate('/chat', {
      state: {
        startWith: {
          _id: target._id || target.id,
          name: target.name,
          avatar: target.avatar
        },
        storyReply: {
          text: reply.trim(),
          attachment: storyAttachment(story, 'reply')
        }
      }
    })
    requestCloseViewer()
  }

  const openShare = async () => {
    setMenuOpen(false)
    setShareOpen(true)
    setShareQuery('')
    setSelectedShare([])
    try {
      const [fol, fing] = await Promise.all([
        api.get('/social/followers'),
        api.get('/social/following')
      ])
      const map = new Map()
      ;[...(fol.data || []), ...(fing.data || [])].forEach((p) => {
        const id = p._id || p.id
        if (id && id !== user?._id) map.set(id, p)
      })
      setContacts([...map.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    } catch {
      toast.error('No se pudo cargar contactos')
      setContacts([])
    }
  }

  const filteredContacts = useMemo(() => {
    const q = shareQuery.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q)
    )
  }, [contacts, shareQuery])

  const toggleShareUser = (id) => {
    setSelectedShare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const shareStory = async () => {
    if (!currentStory || selectedShare.length === 0) return
    setSharing(true)
    try {
      const story = await hydrateStoryMedia(currentStory)
      if (!story?.mediaUrl) {
        toast.error('Espera a que cargue la historia')
        return
      }
      const attachment = storyAttachment(story, 'share')
      await Promise.all(
        selectedShare.map((to) =>
          api.post('/chat/send', {
            to,
            content: '',
            attachment
          })
        )
      )
      toast.success(
        selectedShare.length === 1
          ? 'Historia enviada'
          : `Historia enviada a ${selectedShare.length} personas`
      )
      setShareOpen(false)
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo compartir')
    } finally {
      setSharing(false)
    }
  }

  const deleteStory = async () => {
    if (!currentStory) return
    setDeleting(true)
    try {
      await api.delete(`/stories/${currentStory._id || currentStory.id}`)
      toast.success('Historia eliminada')
      setMenuOpen(false)
      const group = groups[viewer.groupIndex]
      const remaining = group.stories.filter(
        (s) => (s._id || s.id) !== (currentStory._id || currentStory.id)
      )
      if (remaining.length === 0) {
        requestCloseViewer()
      } else {
        const nextIndex = Math.min(viewer.storyIndex, remaining.length - 1)
        setGroups((prev) =>
          prev
            .map((g, i) =>
              i === viewer.groupIndex ? { ...g, stories: remaining } : g
            )
            .filter((g) => g.stories.length > 0)
        )
        setViewer((v) => ({ ...v, storyIndex: nextIndex }))
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const ensureStorageAccess = async () => {
    if (getStorageAccessGranted()) return true
    await dialog.alert(
      'Para subir historias, primero activa el acceso a almacenamiento de Qyntra Gym en Configuración.',
      { title: 'Acceso a almacenamiento requerido', confirmLabel: 'Ir a permisos' }
    )
    navigate('/settings?section=permissions')
    return false
  }

  const resetCompose = () => {
    setComposeOpen(false)
    setCaption('')
    setMediaData(null)
    setMediaPreview(null)
    setMediaType(null)
    setComposeContain(false)
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
        setCaption('')
        setComposeContain(false)
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
      resetCompose()
      load()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al publicar')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      {showRail && (
      <div className="-mx-1 mb-4 overflow-x-auto scrollbar-hide px-1">
        <div className="flex gap-3 pb-1">
          {(() => {
            const mineIdx = groups.findIndex((g) => (g.user?._id || g.user) === user?._id)
            const mineGroup = mineIdx >= 0 ? groups[mineIdx] : null
            const hasMine = Boolean(mineGroup)

            const openAdd = async (e) => {
              e?.stopPropagation?.()
              if (!(await ensureStorageAccess())) return
              imageInputRef.current?.click()
            }

            return (
              <div className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (hasMine) openGroup(mineIdx)
                      else openAdd()
                    }}
                    aria-label={hasMine ? 'Ver tus historias' : 'Crear historia'}
                  >
                    <div
                      className={
                        hasMine
                          ? 'rounded-full bg-gradient-to-tr from-primary-500 to-accent-cyan p-[2px]'
                          : 'flex h-[68px] w-[68px] items-center justify-center rounded-full bg-[color:var(--bg-muted)] ring-2 ring-dashed ring-[color:var(--border-strong)]'
                      }
                    >
                      {hasMine ? (
                        <div className="rounded-full bg-elevated p-[2px]">
                          <Avatar avatar={user?.avatar} name={user?.name} size="story" />
                        </div>
                      ) : (
                        <Avatar avatar={user?.avatar} name={user?.name} size="story" />
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={openAdd}
                    className="absolute -bottom-0.5 -right-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-black shadow-md ring-2 ring-[color:var(--bg-app)]"
                    aria-label="Agregar historia"
                  >
                    <FiPlus size={14} />
                  </button>
                </div>
                <span className="w-full truncate text-center text-[11px] text-app-secondary">Tu historia</span>
              </div>
            )
          })()}

          {groups.map((group, idx) => {
            const uid = group.user?._id || group.user
            const isMine = uid === user?._id
            if (isMine) return null
            const ring = group.hasUnseen
              ? 'bg-gradient-to-tr from-primary-500 to-accent-cyan'
              : 'bg-[color:var(--border-strong)]'
            return (
              <button
                key={uid}
                type="button"
                onClick={() => openGroup(idx)}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
              >
                <div className={`rounded-full p-[2px] ${ring}`}>
                  <div className="rounded-full bg-elevated p-[2px]">
                    <Avatar avatar={group.user?.avatar} name={group.user?.name} size="story" />
                  </div>
                </div>
                <span className="w-full truncate text-center text-[11px] text-app-secondary">
                  {group.user?.name?.split(' ')[0] || 'User'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      )}

      {showRail && (
      <div className="mb-3 flex gap-2 px-1">
        <button
          type="button"
          onClick={async () => {
            if (!(await ensureStorageAccess())) return
            imageInputRef.current?.click()
          }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-app bg-elevated py-2.5 text-xs font-medium text-app sm:flex-none sm:px-4"
        >
          <FiImage size={14} /> Foto
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!(await ensureStorageAccess())) return
            videoInputRef.current?.click()
          }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-app bg-elevated py-2.5 text-xs font-medium text-app sm:flex-none sm:px-4"
        >
          <FiVideo size={14} /> Video 30s
        </button>
      </div>
      )}

      {showRail && (
      <>
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
      </>
      )}

      {/* Full-screen WhatsApp-style story preview composer (always dark chrome) */}
      <AnimatePresence>
        {composeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="story-composer force-dark fixed inset-0 z-[90] bg-black"
          >
            <div className="relative mx-auto flex h-full w-full max-w-lg flex-col">
              <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <button
                  type="button"
                  onClick={resetCompose}
                  className="rounded-full bg-black/45 p-2.5 text-white"
                  aria-label="Cerrar"
                >
                  <FiX size={20} />
                </button>
                <p className="text-sm font-semibold text-white drop-shadow">Nuevo estado</p>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={publish}
                  className="rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {publishing ? '…' : 'Publicar'}
                </button>
              </div>

              <div
                className={`relative flex flex-1 items-center justify-center overflow-hidden ${
                  composeContain ? 'bg-[color:var(--bg-app)]' : ''
                }`}
              >
                {mediaType === 'video' ? (
                  <ProtectedMedia
                    as="video"
                    src={mediaPreview}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ProtectedMedia
                    src={mediaPreview}
                    alt=""
                    className={
                      composeContain
                        ? 'max-h-full max-w-full object-contain'
                        : 'h-full w-full object-cover'
                    }
                  />
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/45" />
              </div>

              <div className="absolute bottom-0 left-0 right-0 z-20 space-y-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
                {caption.trim() && (
                  <p
                    className="rounded-xl px-3 py-2 text-center text-sm backdrop-blur-sm"
                    style={{
                      color: '#fff',
                      background: 'rgba(0,0,0,0.55)',
                      border: '1px solid rgba(255,255,255,0.16)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.75)'
                    }}
                  >
                    <MentionText text={caption} />
                  </p>
                )}
                <MentionInput
                  as="input"
                  value={caption}
                  onChange={(v) => setCaption(String(v).slice(0, 280))}
                  placeholder="Descripción… usa @ para mencionar"
                  maxLength={280}
                  aria-label="Descripción de la historia"
                  className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none backdrop-blur-md focus:ring-2 focus:ring-primary-500/60"
                  // style applied via class enough; force dark fields:
                />
                <style>{`
                  .story-composer .relative > input {
                    color: #fff !important;
                    caret-color: #fff;
                    -webkit-text-fill-color: #fff;
                    background: rgba(0,0,0,0.72) !important;
                    border: 1px solid rgba(255,255,255,0.28) !important;
                    box-shadow: 0 8px 28px rgba(0,0,0,0.45);
                  }
                `}</style>
                <p className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {caption.length}/280
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Viewer — always dark chrome */}
      <AnimatePresence>
        {currentStory && currentGroup && (
          <div className="story-viewer force-dark fixed inset-0 z-[80] flex items-center justify-center bg-black">
            <div className="relative flex h-full w-full max-w-lg flex-col">
              <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                {currentGroup.stories.map((s, i) => (
                  <div key={s._id || s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
                    <div
                      className="h-full bg-white"
                      style={{
                        width: i < viewer.storyIndex ? '100%'
                             : i === viewer.storyIndex ? `${progressPct}%`
                             : '0%'
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="absolute left-0 right-0 top-6 z-30 flex items-center justify-between gap-2 px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar avatar={currentGroup.user?.avatar} name={currentGroup.user?.name} size="sm" />
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold drop-shadow" style={{ color: '#fff' }}>
                      {currentGroup.user?.name}
                    </span>
                    {currentStory.createdAt && (
                      <span className="text-[11px] drop-shadow" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        {formatDistanceToNow(new Date(currentStory.createdAt), { addSuffix: true, locale: es })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="rounded-full bg-black/40 p-2"
                    style={{ color: '#fff' }}
                    aria-label="Más opciones"
                  >
                    <FiMoreVertical size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={requestCloseViewer}
                    className="rounded-full bg-black/40 p-2"
                    style={{ color: '#fff' }}
                  >
                    <FiX size={18} />
                  </button>
                </div>
              </div>

              {/* Story options — always dark chrome (WhatsApp-like) */}
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-4 top-16 z-40 w-56 overflow-hidden rounded-2xl border border-white/15 shadow-2xl backdrop-blur-xl"
                    style={{ background: 'rgba(20,20,28,0.97)', color: '#fff' }}
                  >
                    {isOwnStory && (
                      <button
                        type="button"
                        onClick={openFavorites}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm hover:bg-white/5"
                        style={{ color: '#fff' }}
                      >
                        <FiStar className="text-accent-yellow" /> Agregar a favoritos
                      </button>
                    )}
                    {isOwnStory && (
                      <>
                        <button
                          type="button"
                          onClick={openShare}
                          className="flex w-full items-center gap-3 border-t border-white/10 px-4 py-3.5 text-left text-sm hover:bg-white/5"
                          style={{ color: '#fff' }}
                        >
                          <FiShare2 style={{ color: 'var(--color-primary)' }} /> Compartir
                        </button>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={deleteStory}
                          className="flex w-full items-center gap-3 border-t border-white/10 px-4 py-3.5 text-left text-sm text-red-400 hover:bg-white/5 disabled:opacity-50"
                        >
                          <FiTrash2 /> {deleting ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      </>
                    )}
                    {!isOwnStory && (
                      <p className="px-4 py-3.5 text-sm text-white/70">
                        Solo puedes guardar tus propias historias en favoritos
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative flex flex-1 items-center justify-center">
                <button
                  type="button"
                  className="absolute inset-y-0 left-0 z-10 w-1/3"
                  onClick={goPrev}
                  aria-label="Anterior"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 z-10 w-1/3"
                  onClick={goNext}
                  aria-label="Siguiente"
                />
                {waitingMedia || !currentStory.mediaUrl ? (
                  <div className="flex h-full w-full items-center justify-center bg-black/40">
                    <div
                      className="h-9 w-9 animate-spin rounded-full border-2 border-white/20"
                      style={{ borderTopColor: '#fff' }}
                    />
                  </div>
                ) : currentStory.mediaType === 'video' ? (
                  <ProtectedMedia
                    as="video"
                    key={currentStory._id || currentStory.id}
                    src={currentStory.mediaUrl}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                    ref={(el) => {
                      if (!el) return
                      if (paused || waitingMedia) el.pause()
                      else el.play().catch(() => {})
                    }}
                    onEnded={!paused && !waitingMedia ? goNext : undefined}
                  />
                ) : (
                  <ProtectedMedia
                    src={currentStory.mediaUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              {currentStory.caption && (
                <p
                  className="absolute bottom-36 left-4 right-4 z-20 rounded-xl px-3 py-2.5 text-center text-sm font-medium leading-relaxed backdrop-blur-md shadow-lg"
                  style={{
                    color: '#fff',
                    background: 'rgba(0,0,0,0.72)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                  }}
                >
                  <MentionText text={currentStory.caption} />
                </p>
              )}

              <div className="absolute bottom-0 left-0 right-0 z-20 space-y-3 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
                {isOwnStory ? (
                  <button
                    type="button"
                    onClick={openViewers}
                    className="mx-auto flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white backdrop-blur-sm hover:bg-white/20"
                  >
                    <FiEye size={16} />
                    {currentStory.viewCount || 0}{' '}
                    {(currentStory.viewCount || 0) === 1 ? 'vista' : 'vistas'}
                  </button>
                ) : (
                  <>
                    <div className="flex justify-center gap-2">
                      {reactions.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          title={r.label}
                          onClick={() => react(r.emoji)}
                          className={`flex h-11 w-11 items-center justify-center rounded-full text-xl transition ${
                            currentStory.myReaction === r.emoji
                              ? 'scale-110 bg-primary-500/40 ring-2 ring-primary-400'
                              : 'bg-white/10 hover:bg-white/20'
                          }`}
                        >
                          {r.emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onFocus={() => setReplyFocused(true)}
                        onBlur={() => setReplyFocused(false)}
                        placeholder="Responder en chat…"
                        className="story-chrome-input flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                        style={{
                          color: '#fff',
                          caretColor: '#fff',
                          WebkitTextFillColor: '#fff',
                          background: 'rgba(0,0,0,0.65)',
                          border: '1px solid rgba(255,255,255,0.22)'
                        }}
                      />
                      <button
                        type="button"
                        onClick={sendReply}
                        onMouseDown={(e) => e.preventDefault()}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500 text-black"
                      >
                        <FiSend size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Share sheet */}
            <AnimatePresence>
              {shareOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex items-end bg-black/70 sm:items-center sm:justify-center sm:p-4"
                >
                  <motion.div
                    initial={{ y: 40 }}
                    animate={{ y: 0 }}
                    exit={{ y: 40 }}
                    className="force-dark flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl border border-white/10 bg-dark-200 sm:rounded-3xl"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                      <p className="font-semibold">Compartir historia</p>
                      <button type="button" onClick={() => setShareOpen(false)} className="p-2 text-gray-400">
                        <FiX />
                      </button>
                    </div>
                    <div className="border-b border-white/5 px-4 py-3">
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                          value={shareQuery}
                          onChange={(e) => setShareQuery(e.target.value)}
                          placeholder="Filtrar seguidores y seguidos…"
                          className="input-field py-2.5 pl-10 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 py-2">
                      {filteredContacts.length === 0 ? (
                        <p className="py-8 text-center text-sm text-gray-500">
                          No hay contactos para compartir
                        </p>
                      ) : (
                        filteredContacts.map((c) => {
                          const id = c._id || c.id
                          const selected = selectedShare.includes(id)
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => toggleShareUser(id)}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
                            >
                              <Avatar avatar={c.avatar} name={c.name} size="sm" />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-primary-500 bg-primary-500 text-black'
                                    : 'border-white/20 text-transparent'
                                }`}
                              >
                                <FiCheck size={14} />
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                    <div className="border-t border-white/10 p-4">
                      <button
                        type="button"
                        disabled={sharing || selectedShare.length === 0}
                        onClick={shareStory}
                        className="btn-primary w-full py-3 disabled:opacity-50"
                      >
                        {sharing
                          ? 'Enviando…'
                          : selectedShare.length
                            ? `Enviar (${selectedShare.length})`
                            : 'Selecciona contactos'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Viewers inbox — WhatsApp style with reactions */}
            <AnimatePresence>
              {viewersOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex items-end bg-black/70 sm:items-center sm:justify-center sm:p-4"
                  onClick={() => setViewersOpen(false)}
                >
                  <motion.div
                    initial={{ y: 40 }}
                    animate={{ y: 0 }}
                    exit={{ y: 40 }}
                    onClick={(e) => e.stopPropagation()}
                    className="force-dark flex max-h-[75vh] w-full max-w-md flex-col rounded-t-3xl border border-white/10 bg-dark-200 sm:rounded-3xl"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                      <div>
                        <p className="font-semibold">Vistas</p>
                        <p className="text-xs text-gray-500">
                          {viewers.length} {(viewers.length === 1 ? 'persona' : 'personas')}
                        </p>
                      </div>
                      <button type="button" onClick={() => setViewersOpen(false)} className="p-2 text-gray-400">
                        <FiX />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 py-2">
                      {loadingViewers ? (
                        <div className="flex justify-center py-10">
                          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-primary-500" />
                        </div>
                      ) : viewers.length === 0 ? (
                        <p className="py-10 text-center text-sm text-gray-500">
                          Todavía nadie ha visto esta historia
                        </p>
                      ) : (
                        viewers.map((v) => (
                          <div
                            key={v.userId}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                          >
                            <Avatar avatar={v.user?.avatar} name={v.user?.name} size="md" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">{v.user?.name}</p>
                              {v.viewedAt && (
                                <p className="text-xs text-gray-500">
                                  {new Date(v.viewedAt).toLocaleString('es', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    day: 'numeric',
                                    month: 'short'
                                  })}
                                </p>
                              )}
                            </div>
                            {v.reaction && (
                              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl">
                                {v.reaction}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {favoritesOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex items-end bg-black/70 sm:items-center sm:justify-center sm:p-4"
                >
                  <motion.div
                    initial={{ y: 40 }}
                    animate={{ y: 0 }}
                    exit={{ y: 40 }}
                    className="force-dark flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl border border-white/10 bg-dark-200 sm:rounded-3xl"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                      <p className="font-semibold">Agregar a favoritos</p>
                      <button
                        type="button"
                        onClick={() => setFavoritesOpen(false)}
                        className="p-2 text-gray-400"
                      >
                        <FiX />
                      </button>
                    </div>

                    <div className="border-b border-white/5 px-4 py-3">
                      <p className="mb-2 text-xs text-gray-500">Crear álbum nuevo</p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={newAlbumName}
                          onChange={(e) => setNewAlbumName(e.target.value.slice(0, 40))}
                          placeholder="Nombre del álbum"
                          className="input-field flex-1 py-2.5 text-sm"
                        />
                        <button
                          type="button"
                          disabled={creatingAlbum}
                          onClick={createAlbum}
                          className="btn-secondary whitespace-nowrap px-4 py-2.5 text-sm disabled:opacity-50"
                        >
                          {creatingAlbum ? '…' : 'Crear'}
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 py-2">
                      {albums.length === 0 ? (
                        <p className="px-3 py-8 text-center text-sm text-gray-500">
                          Aún no tienes álbumes. Crea uno para guardar este estado.
                        </p>
                      ) : (
                        albums.map((album) => (
                          <button
                            key={album._id || album.id}
                            type="button"
                            disabled={savingFavorite}
                            onClick={() => saveToAlbum(album._id || album.id)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5 disabled:opacity-50"
                          >
                            <div
                              data-protected-media="1"
                              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-500/40 to-accent-cyan/30 ring-2 ring-white/10"
                            >
                              {album.coverUrl ? (
                                album.coverType === 'video' ? (
                                  <ProtectedMedia
                                    as="video"
                                    src={album.coverUrl}
                                    muted
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <ProtectedMedia
                                    src={album.coverUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                )
                              ) : (
                                <FiStar className="text-accent-yellow" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">{album.name}</p>
                              <p className="text-xs text-gray-500">{album.count || 0} estados</p>
                            </div>
                            <FiPlus className="text-primary-400" />
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
