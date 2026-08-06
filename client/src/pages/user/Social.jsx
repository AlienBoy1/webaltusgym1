import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FiHeart, FiMessageCircle, FiShare2, FiImage, FiSend, FiTrash2, FiX, 
  FiSmile, FiBarChart2, FiCheckCircle, FiAward, FiActivity, FiClock
} from 'react-icons/fi'
import { Link } from 'react-router-dom'
import api from '../../utils/api'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Avatar } from '../../utils/avatarUtils'
import StoriesRail from '../../components/StoriesRail'
import RoutineDetailModal, { toStartableTemplate } from '../../components/RoutineDetailModal'
import PostReactionButton from '../../components/PostReactionButton'
import SharedPostAttachment from '../../components/SharedPostAttachment'
import { useAppDialog } from '../../components/AppDialog'
import PostReactorsModal from '../../components/PostReactorsModal'
import PeopleYouMayKnow from '../../components/PeopleYouMayKnow'
import SharePostSheet from '../../components/SharePostSheet'

const WORKOUT_TEMPLATES_KEY = 'qyntra:workout_templates'

const moods = [
  { id: 'happy', label: 'Feliz', emoji: '😊', color: 'from-yellow-400 to-orange-500' },
  { id: 'excited', label: 'Emocionado', emoji: '🤩', color: 'from-pink-500 to-purple-600' },
  { id: 'proud', label: 'Orgulloso', emoji: '😤', color: 'from-blue-500 to-cyan-600' },
  { id: 'motivated', label: 'Motivado', emoji: '💪', color: 'from-orange-500 to-red-600' },
  { id: 'tired', label: 'Cansado', emoji: '😴', color: 'from-gray-500 to-gray-700' },
  { id: 'focused', label: 'Concentrado', emoji: '🧘', color: 'from-indigo-500 to-blue-600' },
  { id: 'grateful', label: 'Agradecido', emoji: '🙏', color: 'from-green-500 to-emerald-600' },
  { id: 'determined', label: 'Determinado', emoji: '🔥', color: 'from-red-600 to-orange-600' }
]

export default function Social() {
  const { user } = useAuthStore()
  const dialog = useAppDialog()
  const [posts, setPosts] = useState([])
  const [sharePostTarget, setSharePostTarget] = useState(null)
  const [sharingPost, setSharingPost] = useState(false)
  const [reactorsPost, setReactorsPost] = useState(null)
  const [newPost, setNewPost] = useState('')
  const [selectedImages, setSelectedImages] = useState([])
  const [selectedMood, setSelectedMood] = useState(null)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [postType, setPostType] = useState('text') // text, image, poll, mood, mixed
  const [showCompose, setShowCompose] = useState(false)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [commentTexts, setCommentTexts] = useState({})
  const [showComments, setShowComments] = useState({})
  const [commenting, setCommenting] = useState({})
  const [voting, setVoting] = useState({})
  const [routineModal, setRoutineModal] = useState(null)
  const fileInputRef = useRef(null)
  const imagePreviewRefs = useRef({})

  useEffect(() => {
    fetchPosts()
  }, [])

  const adoptRoutine = () => {
    if (!routineModal) return
    const local = toStartableTemplate(routineModal)
    try {
      const stored = JSON.parse(localStorage.getItem(WORKOUT_TEMPLATES_KEY) || '[]')
      localStorage.setItem(WORKOUT_TEMPLATES_KEY, JSON.stringify([...stored, local]))
      toast.success('Rutina adoptada en Entrenos')
      setRoutineModal(null)
    } catch {
      toast.error('No se pudo guardar')
    }
  }

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/social/feed')
      setPosts(data)
    } catch (error) {
      console.error('Error fetching posts:', error)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length + selectedImages.length > 4) {
      toast.error('Máximo 4 imágenes por publicación')
      return
    }

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imágenes')
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Cada imagen debe ser menor a 5MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        setSelectedImages(prev => [...prev, {
          file,
          preview: event.target.result,
          id: Date.now() + Math.random()
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (id) => {
    setSelectedImages(prev => prev.filter(img => img.id !== id))
  }

  const addPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, ''])
    }
  }

  const removePollOption = (index) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index))
    }
  }

  const handlePost = async () => {
    // Validate based on post type
    if (postType === 'poll') {
      if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
        toast.error('Completa la pregunta y al menos 2 opciones')
        return
      }
    } else if (postType === 'mood') {
      if (!selectedMood) {
        toast.error('Selecciona un estado de ánimo')
        return
      }
    } else {
      if (!newPost.trim() && selectedImages.length === 0) {
        toast.error('Escribe algo o agrega una imagen')
        return
      }
    }

    setPosting(true)
    try {
      // Convert images to base64
      const images = await Promise.all(
        selectedImages.map(img => {
          return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target.result)
            reader.readAsDataURL(img.file)
          })
        })
      )

      const postData = {
        content: newPost.trim() || undefined,
        images: images.length > 0 ? images : undefined,
        mood: selectedMood || undefined,
        poll: postType === 'poll' ? {
          question: pollQuestion,
          options: pollOptions.filter(o => o.trim())
        } : undefined,
        postType: postType === 'mixed' ? 'mixed' : 
                 images.length > 0 ? 'image' : 
                 postType === 'poll' ? 'poll' : 
                 postType === 'mood' ? 'mood' : 'text'
      }

      const { data } = await api.post('/social', postData)
      setPosts([data, ...posts])
      
      // Reset form
      setNewPost('')
      setSelectedImages([])
      setSelectedMood(null)
      setPollQuestion('')
      setPollOptions(['', ''])
      setPostType('text')
      setShowCompose(false)
      toast.success('¡Publicado!')
    } catch (error) {
      toast.error('Error al publicar')
    } finally {
      setPosting(false)
    }
  }

  const handleVote = async (postId, optionIndex) => {
    setVoting({ ...voting, [postId]: true })
    try {
      const { data } = await api.post(`/social/${postId}/poll/vote`, { optionIndex })
      setPosts(posts.map(post =>
        post._id === postId ? { ...post, poll: data } : post
      ))
      toast.success('Voto registrado')
    } catch (error) {
      toast.error('Error al votar')
    } finally {
      setVoting({ ...voting, [postId]: false })
    }
  }

  const handleReact = async (postId, emoji) => {
    try {
      const { data } = await api.post(`/social/${postId}/like`, { emoji })
      setPosts((posts) =>
        posts.map((post) => {
          if (post._id !== postId) return post
          const uid = user._id
          let likes = [...(post.likes || [])]
          const has = likes.some((id) => (id?._id || id) === uid)
          if (data.liked && !has) likes.push(uid)
          if (!data.liked) likes = likes.filter((id) => (id?._id || id) !== uid)

          let reactionSummary = [...(post.reactionSummary || [])]
          let reactors = [...(post.reactors || [])]
          const prev = post.myReaction
          if (prev) {
            reactionSummary = reactionSummary
              .map((r) => (r.emoji === prev ? { ...r, count: r.count - 1 } : r))
              .filter((r) => r.count > 0)
            reactors = reactors.filter((r) => r.userId !== uid)
          }
          if (data.myReaction) {
            const existing = reactionSummary.find((r) => r.emoji === data.myReaction)
            if (existing) {
              reactionSummary = reactionSummary.map((r) =>
                r.emoji === data.myReaction ? { ...r, count: r.count + 1 } : r
              )
            } else {
              reactionSummary = [...reactionSummary, { emoji: data.myReaction, count: 1 }]
            }
            reactors = [
              ...reactors.filter((r) => r.userId !== uid),
              {
                userId: uid,
                emoji: data.myReaction,
                name: user.name,
                avatar: user.avatar
              }
            ]
          }

          return {
            ...post,
            likes,
            myReaction: data.myReaction || null,
            reactionSummary,
            reactors
          }
        })
      )
    } catch (error) {
      toast.error('Error al reaccionar')
    }
  }

  const handleComment = async (postId) => {
    const commentText = commentTexts[postId] || ''
    if (!commentText.trim()) return

    setCommenting({ ...commenting, [postId]: true })
    try {
      const { data } = await api.post(`/social/${postId}/comment`, { content: commentText })
      setPosts(posts.map(post =>
        post._id === postId
          ? { ...post, comments: data }
          : post
      ))
      setCommentTexts({ ...commentTexts, [postId]: '' })
      toast.success('Comentario publicado')
    } catch (error) {
      toast.error('Error al comentar')
    } finally {
      setCommenting({ ...commenting, [postId]: false })
    }
  }

  const submitSharePost = async ({ content, mood, poll }) => {
    if (!sharePostTarget) return
    try {
      setSharingPost(true)
      const { data } = await api.post(`/social/${sharePostTarget._id || sharePostTarget.id}/share`, {
        content,
        mood,
        poll
      })
      setPosts((prev) => [data, ...prev])
      setSharePostTarget(null)
      toast.success('Publicación compartida en tu feed')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al compartir')
    } finally {
      setSharingPost(false)
    }
  }

  const handleDelete = async (postId) => {
    const ok = await dialog.confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.', {
      title: 'Eliminar publicación',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    })
    if (!ok) return

    try {
      await api.delete(`/social/${postId}`)
      setPosts(posts.filter((p) => p._id !== postId))
      toast.success('Publicación eliminada')
    } catch (error) {
      toast.error('Error al eliminar')
    }
  }

  const getLevelBadge = (level) => {
    if (level >= 10) return { class: 'bg-accent-purple/20 text-accent-purple', label: 'Elite' }
    if (level >= 5) return { class: 'bg-accent-cyan/20 text-accent-cyan', label: 'Pro' }
    return { class: 'bg-primary-500/20 text-primary-500', label: 'Member' }
  }

  const hasVoted = (post) => {
    if (!post.poll) return false
    return post.poll.options.some(opt => 
      opt.votes?.some(v => (v?._id || v) === user?._id)
    )
  }

  const getTotalVotes = (post) => {
    if (!post.poll) return 0
    return post.poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl tracking-wide">Comunidad</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5 hidden sm:block">
            Comparte tu progreso con quienes sigues
          </p>
        </div>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="btn-primary py-2 sm:py-2.5 px-4 text-sm flex-shrink-0 shadow-lg shadow-primary-500/20"
        >
          Publicar
        </button>
      </div>

      <StoriesRail />

      {/* Compose Post */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card overflow-hidden p-4 sm:p-5"
          >
            {/* Post Type Selector */}
            <div className="flex gap-1.5 sm:gap-2 mb-4 pb-4 border-b border-white/10 overflow-x-auto -mx-1 px-1">
              {[
                { id: 'text', label: 'Texto', icon: FiSend },
                { id: 'image', label: 'Imagen', icon: FiImage },
                { id: 'poll', label: 'Encuesta', icon: FiBarChart2 },
                { id: 'mood', label: 'Estado', icon: FiSmile }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => {
                    setPostType(type.id)
                    if (type.id !== 'image') setSelectedImages([])
                    if (type.id !== 'poll') {
                      setPollQuestion('')
                      setPollOptions(['', ''])
                    }
                    if (type.id !== 'mood') setSelectedMood(null)
                  }}
                  className={`flex-1 min-w-[4.5rem] py-2 px-2 sm:px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-colors ${
                    postType === type.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-dark-300 text-gray-400 hover:text-white'
                  }`}
                >
                  <type.icon size={16} />
                  <span>{type.label}</span>
                </button>
              ))}
            </div>

            {/* Text Input */}
            {(postType === 'text' || postType === 'image' || postType === 'mixed') && (
              <textarea
                value={newPost}
                onChange={(e) => {
                  setNewPost(e.target.value)
                  if (selectedImages.length > 0) setPostType('mixed')
                }}
                placeholder="¿Qué lograste hoy? Comparte tu progreso..."
                className="w-full bg-transparent border-none resize-none text-white placeholder:text-gray-500 focus:outline-none min-h-[100px] mb-4"
              />
            )}

            {/* Image Upload */}
            {(postType === 'image' || postType === 'mixed') && (
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary w-full flex items-center justify-center gap-2 mb-3"
                >
                  <FiImage size={20} />
                  Agregar Imágenes ({selectedImages.length}/4)
                </button>
                
                {selectedImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedImages.map((img) => (
                      <div key={img.id} className="relative group">
                        <img src={img.preview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                        <button
                          onClick={() => removeImage(img.id)}
                          className="absolute top-2 right-2 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FiX size={16} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Poll */}
            {postType === 'poll' && (
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Pregunta</label>
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="input-field w-full"
                    placeholder="¿Cuál es tu pregunta?"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Opciones</label>
                  {pollOptions.map((opt, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...pollOptions]
                          newOptions[index] = e.target.value
                          setPollOptions(newOptions)
                        }}
                        className="input-field flex-1"
                        placeholder={`Opción ${index + 1}`}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() => removePollOption(index)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                        >
                          <FiX size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 4 && (
                    <button
                      onClick={addPollOption}
                      className="text-primary-500 text-sm hover:text-primary-400"
                    >
                      + Agregar opción
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Mood Selector */}
            {postType === 'mood' && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-3">Estado de Ánimo</label>
                <div className="grid grid-cols-4 gap-2">
                  {moods.map((mood) => (
                    <button
                      key={mood.id}
                      onClick={() => setSelectedMood(mood.id)}
                      className={`p-3 rounded-lg flex flex-col items-center gap-2 transition-all ${
                        selectedMood === mood.id
                          ? 'bg-primary-500/20 ring-2 ring-primary-500'
                          : 'bg-dark-200 hover:bg-dark-100'
                      }`}
                    >
                      <span className="text-2xl">{mood.emoji}</span>
                      <span className="text-xs">{mood.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="flex gap-2">
                {(postType === 'text' || postType === 'image' || postType === 'mixed') && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-400 hover:text-primary-500 transition-colors"
                  >
                    <FiImage size={20} />
                  </button>
                )}
              </div>
              <button
                onClick={handlePost}
                disabled={posting}
                className="btn-primary py-2 px-4 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {posting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <FiSend size={16} /> Publicar
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posts Feed */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
        </div>
      ) : posts.length === 0 ? (
        <div className="space-y-4">
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">📝</div>
            <p>Aún no hay publicaciones</p>
            <p className="text-sm mt-2">Publica algo o sigue a otros usuarios para ver su contenido</p>
          </div>
          <PeopleYouMayKnow />
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {posts.map((post, i) => {
            const isOwner = post.user?._id === user?._id
            const myReaction = post.myReaction || (post.likes?.some(id => (id?._id || id) === user?._id) ? '❤️' : null)
            const badge = getLevelBadge(post.user?.stats?.level || 1)
            const postComments = post.comments || []
            const showCommentSection = showComments[post._id]
            const postHasVoted = hasVoted(post)
            const pollTotalVotes = post.poll ? getTotalVotes(post) : 0
            const moodInfo = post.mood ? moods.find(m => m.id === post.mood) : null
            const timeLabel = formatDistanceToNow(new Date(post.createdAt), {
              addSuffix: true,
              locale: es
            })

            return (
              <div key={post._id}>
              {i === 2 && (
                <div className="mb-3 sm:mb-4">
                  <PeopleYouMayKnow />
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.25) }}
                className="card p-4 sm:p-5"
              >
                {/* Post Header */}
                <div className="flex items-start gap-3 mb-3 sm:mb-4">
                  <Link to={`/user/${post.user?._id}`} className="flex-shrink-0">
                    <Avatar avatar={post.user?.avatar} name={post.user?.name} size="md" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/user/${post.user?._id}`} className="min-w-0">
                        <div className="font-semibold hover:text-primary-500 transition-colors truncate text-sm sm:text-base">
                          {post.user?.name || 'Usuario'}
                        </div>
                      </Link>
                      {isOwner && (
                        <button
                          onClick={() => handleDelete(post._id)}
                          className="p-1.5 -mr-1 text-gray-500 hover:text-red-500 flex-shrink-0 rounded-lg hover:bg-dark-100"
                          aria-label="Eliminar"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-gray-400">
                      <span className={`px-2 py-0.5 rounded-full whitespace-nowrap ${badge.class}`}>
                        {badge.label}
                      </span>
                      <span className="whitespace-nowrap text-gray-500">{timeLabel}</span>
                      {moodInfo && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full bg-dark-300 text-gray-300">
                          <span>{moodInfo.emoji}</span>
                          <span>{moodInfo.label}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Badge Share (own post only) */}
                {!post.sharedFrom && post.postType === 'badge' && post.badgeData && (
                  <div className="mb-4 p-6 bg-gradient-to-br from-accent-yellow/20 to-orange-500/20 rounded-xl border-2 border-accent-yellow/30">
                    <div className="flex items-center gap-4">
                      <div className="text-6xl">
                        {post.badgeData.badgeIcon}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-accent-yellow mb-1 flex items-center gap-1">
                          <FiAward size={14} />
                          Insignia Desbloqueada
                        </div>
                        <h4 className="text-xl font-bold mb-1">{post.badgeData.badgeName}</h4>
                        {post.badgeData.earnedAt && (
                          <div className="text-xs text-gray-400">
                            Obtenida el {format(parseISO(post.badgeData.earnedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Routine share (template) vs completed workout — omit on reshares */}
                {!post.sharedFrom &&
                  post.workoutData &&
                  (post.postType === 'routine' ||
                    post.workoutData.isRoutine ||
                    post.workoutData.shareKind === 'routine') && (
                  <button
                    type="button"
                    onClick={() =>
                      setRoutineModal({
                        ...post.workoutData,
                        user: typeof post.user === 'object' ? post.user : null
                      })
                    }
                    className="mb-4 w-full overflow-hidden rounded-2xl border border-accent-cyan/30 bg-gradient-to-br from-accent-cyan/15 to-primary-500/10 p-4 text-left transition hover:border-accent-cyan/50"
                  >
                    <div className="mb-3 flex items-center gap-2 text-accent-cyan">
                      <FiActivity size={16} />
                      <span className="text-xs font-semibold uppercase tracking-[0.2em]">Rutina · Comunidad</span>
                    </div>
                    <h4 className="font-display text-xl text-app">{post.workoutData.name}</h4>
                    <p className="mt-1 text-sm text-app-secondary">
                      {post.workoutData.totalExercises || post.workoutData.exercises?.length || 0} ejercicios
                      {post.workoutData.totalSets ? ` · ${post.workoutData.totalSets} series` : ''}
                    </p>
                    {post.workoutData.exercises?.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-app pt-3">
                        {post.workoutData.exercises.slice(0, 4).map((ex, idx) => (
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

                {!post.sharedFrom &&
                  post.workoutData &&
                  post.postType !== 'routine' &&
                  !post.workoutData.isRoutine &&
                  post.workoutData.shareKind !== 'routine' &&
                  (post.postType === 'workout' || post.workoutData) && (
                  <button
                    type="button"
                    onClick={() => setRoutineModal({
                      ...post.workoutData,
                      user: typeof post.user === 'object' ? post.user : null
                    })}
                    className="mb-4 w-full overflow-hidden rounded-2xl border border-primary-500/25 bg-gradient-to-br from-primary-500/15 to-accent-cyan/10 p-4 text-left transition hover:border-primary-500/50"
                  >
                    <div className="mb-3 flex items-center gap-2 text-primary-500">
                      <FiActivity size={16} />
                      <span className="text-xs font-semibold uppercase tracking-[0.2em]">Entrenamiento realizado</span>
                    </div>
                    <h4 className="font-display text-xl text-app">{post.workoutData.name}</h4>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-elevated border border-app p-2">
                        <p className="text-lg font-semibold text-app">
                          {post.workoutData.completedExercises}/{post.workoutData.totalExercises}
                        </p>
                        <p className="text-[10px] text-app-secondary">Ejercicios</p>
                      </div>
                      <div className="rounded-xl bg-elevated border border-app p-2">
                        <p className="text-lg font-semibold text-app">{post.workoutData.totalSets || '—'}</p>
                        <p className="text-[10px] text-app-secondary">Series</p>
                      </div>
                      <div className="rounded-xl bg-elevated border border-app p-2">
                        <p className="inline-flex items-center justify-center gap-1 text-lg font-semibold text-app">
                          <FiClock size={12} className="text-primary-500" />
                          {Math.floor((post.workoutData.durationSeconds || 0) / 60)}m
                        </p>
                        <p className="text-[10px] text-app-secondary">Tiempo</p>
                      </div>
                    </div>
                    {post.workoutData.exercises?.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-app pt-3">
                        {post.workoutData.exercises.slice(0, 4).map((ex, idx) => (
                          <li key={idx} className="flex justify-between text-xs text-app-secondary">
                            <span className="truncate pr-2">{ex.name}</span>
                            <span className="shrink-0 opacity-70">{ex.sets}×{ex.reps}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 text-xs text-primary-500">Tocar para ver detalle</p>
                  </button>
                )}

                {/* Post Content */}
                {post.content && !String(post.content).includes('[workout]') && (
                  <p className="text-app mb-4 leading-relaxed break-words">{post.content}</p>
                )}
                {post.content && String(post.content).includes('[workout]') && (
                  <p className="text-app mb-4 leading-relaxed break-words">
                    {String(post.content).replace(/\[workout\][\s\S]*?\[\/workout\]/g, '').trim()}
                  </p>
                )}

                {post.sharedFrom && (
                  <SharedPostAttachment
                    shared={post.sharedFrom}
                    onOpenRoutine={(workout, author) =>
                      setRoutineModal({
                        ...workout,
                        user: author || null
                      })
                    }
                  />
                )}

                {/* Post Images — omit on reshares (live in attachment) */}
                {!post.sharedFrom && post.images && post.images.length > 0 && (
                  <div className={`mb-3 sm:mb-4 grid gap-1.5 sm:gap-2 ${
                    post.images.length === 1 ? 'grid-cols-1' :
                    'grid-cols-2'
                  }`}>
                    {post.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Post ${idx + 1}`}
                        className={`w-full rounded-xl object-cover ${
                          post.images.length === 1
                            ? 'max-h-[280px] sm:max-h-[400px]'
                            : 'h-36 sm:h-48'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Poll */}
                {post.poll && (
                  <div className="mb-4 p-4 bg-elevated border border-app rounded-xl">
                    <h4 className="font-semibold mb-3">{post.poll.question}</h4>
                    <div className="space-y-2">
                      {post.poll.options.map((option, idx) => {
                        const votes = option.votes?.length || 0
                        const percentage = pollTotalVotes > 0 ? (votes / pollTotalVotes) * 100 : 0
                        const userVoted = option.votes?.some(v => (v?._id || v) === user?._id)

                        return (
                          <button
                            key={idx}
                            onClick={() => !postHasVoted && handleVote(post._id, idx)}
                            disabled={postHasVoted || voting[post._id]}
                            className={`w-full p-3 rounded-lg text-left transition-all ${
                              postHasVoted
                                ? userVoted
                                  ? 'bg-primary-500/30 ring-2 ring-primary-500'
                                  : 'bg-app'
                                : 'bg-app hover:opacity-90'
                            } ${postHasVoted ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm">{option.text}</span>
                              {postHasVoted && (
                                <span className="text-xs text-app-secondary">
                                  {votes} {votes === 1 ? 'voto' : 'votos'} ({Math.round(percentage)}%)
                                </span>
                              )}
                            </div>
                            {postHasVoted && (
                              <div className="h-2 bg-app rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary-500 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {postHasVoted && (
                      <p className="text-xs text-app-secondary mt-2">
                        Total: {pollTotalVotes} {pollTotalVotes === 1 ? 'voto' : 'votos'}
                      </p>
                    )}
                  </div>
                )}

                {/* Post Actions */}
                <div className="flex items-center gap-4 sm:gap-6 pt-3 sm:pt-4 border-t border-app">
                  <PostReactionButton
                    myReaction={myReaction}
                    likesCount={post.likes?.length || 0}
                    reactionSummary={post.reactionSummary || []}
                    onReact={(emoji) => handleReact(post._id, emoji)}
                    onShowReactors={() => setReactorsPost(post)}
                  />

                  <button
                    onClick={() => setShowComments({ ...showComments, [post._id]: !showCommentSection })}
                    className="flex items-center gap-1.5 sm:gap-2 text-app-secondary hover:text-primary-500 transition-colors min-h-[40px]"
                  >
                    <FiMessageCircle size={18} />
                    <span className="text-sm tabular-nums">{postComments.length}</span>
                  </button>

                  <button
                    onClick={() => setSharePostTarget(post)}
                    className="flex items-center gap-2 text-app-secondary hover:text-accent-cyan transition-colors min-h-[40px] ml-auto"
                    aria-label="Compartir publicación"
                  >
                    <FiShare2 size={18} />
                  </button>
                </div>

                {/* Comments Section */}
                <AnimatePresence>
                  {showCommentSection && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-white/5"
                    >
                      {/* Comments List */}
                      {postComments.length > 0 && (
                        <div className="space-y-3 mb-4">
                          {postComments.map((comment, idx) => (
                            <div key={comment._id || idx} className="flex gap-3">
                              <Link to={`/user/${comment.user?._id}`} className="flex-shrink-0">
                                <Avatar avatar={comment.user?.avatar} name={comment.user?.name} size="sm" />
                              </Link>
                              <div className="flex-1 min-w-0">
                                <Link to={`/user/${comment.user?._id}`}>
                                  <div className="font-semibold text-sm hover:text-primary-500 transition-colors">
                                    {comment.user?.name || 'Usuario'}
                                  </div>
                                </Link>
                                <p className="text-gray-300 text-sm">{comment.content}</p>
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: es })}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment Input */}
                      <div className="flex gap-2">
                        <Avatar avatar={user?.avatar} name={user?.name} size="sm" />
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={commentTexts[post._id] || ''}
                            onChange={(e) => setCommentTexts({ ...commentTexts, [post._id]: e.target.value })}
                            placeholder="Escribe un comentario..."
                            className="input-field flex-1 text-sm"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleComment(post._id)
                              }
                            }}
                          />
                          <button
                            onClick={() => handleComment(post._id)}
                            disabled={!commentTexts[post._id]?.trim() || commenting[post._id]}
                            className="btn-primary px-4 flex items-center gap-2 disabled:opacity-50"
                          >
                            {commenting[post._id] ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <FiSend size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              </div>
            )
          })}
          {posts.length > 0 && posts.length < 3 && (
            <div className="mt-2">
              <PeopleYouMayKnow />
            </div>
          )}
        </div>
      )}

      <RoutineDetailModal
        open={Boolean(routineModal)}
        onClose={() => setRoutineModal(null)}
        routine={routineModal}
        author={routineModal?.user}
        onAdopt={adoptRoutine}
      />

      <SharePostSheet
        open={Boolean(sharePostTarget)}
        post={sharePostTarget}
        onClose={() => !sharingPost && setSharePostTarget(null)}
        onShareCommunity={submitSharePost}
        sharingCommunity={sharingPost}
      />

      <PostReactorsModal
        open={Boolean(reactorsPost)}
        onClose={() => setReactorsPost(null)}
        reactors={reactorsPost?.reactors || []}
      />
    </div>
  )
}
