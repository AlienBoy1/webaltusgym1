import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FiHeart, FiMessageCircle, FiShare2, FiImage, FiSend, FiTrash2, FiX, 
  FiSmile, FiBarChart2, FiCheckCircle, FiAward
} from 'react-icons/fi'
import { Link } from 'react-router-dom'
import api from '../../utils/api'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Avatar } from '../../utils/avatarUtils'

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
  const [posts, setPosts] = useState([])
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
  const fileInputRef = useRef(null)
  const imagePreviewRefs = useRef({})

  useEffect(() => {
    fetchPosts()
  }, [])

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

  const handleLike = async (postId) => {
    try {
      const { data } = await api.post(`/social/${postId}/like`)
      setPosts(posts.map(post =>
        post._id === postId
          ? {
            ...post,
            likes: data.liked
              ? [...(post.likes || []), user._id]
              : (post.likes || []).filter(id => (id?._id || id) !== user._id)
          }
          : post
      ))
    } catch (error) {
      toast.error('Error al dar like')
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

  const handleShare = async (postId, shareText = '') => {
    try {
      const { data } = await api.post(`/social/${postId}/share`, { content: shareText })
      setPosts([data, ...posts])
      toast.success('Publicación compartida')
    } catch (error) {
      toast.error('Error al compartir')
    }
  }

  const handleDelete = async (postId) => {
    if (!confirm('¿Eliminar esta publicación?')) return

    try {
      await api.delete(`/social/${postId}`)
      setPosts(posts.filter(p => p._id !== postId))
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Comunidad</h1>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="btn-primary py-2 px-4 text-sm"
        >
          Publicar
        </button>
      </div>

      {/* Compose Post */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card overflow-hidden"
          >
            {/* Post Type Selector */}
            <div className="flex gap-2 mb-4 pb-4 border-b border-white/10">
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
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors ${
                    postType === type.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-dark-200 text-gray-400 hover:text-white'
                  }`}
                >
                  <type.icon size={18} />
                  {type.label}
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
        <div className="text-center py-12 text-gray-400">
          <div className="text-6xl mb-4">📝</div>
          <p>No hay publicaciones aún</p>
          <p className="text-sm">¡Sé el primero en compartir!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post, i) => {
            const isOwner = post.user?._id === user?._id
            const isLiked = post.likes?.some(id => (id?._id || id) === user?._id)
            const badge = getLevelBadge(post.user?.stats?.level || 1)
            const postComments = post.comments || []
            const showCommentSection = showComments[post._id]
            const postHasVoted = hasVoted(post)

            return (
              <motion.div
                key={post._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="card"
              >
                {/* Post Header */}
                <div className="flex items-center gap-3 mb-4">
                  <Link to={`/user/${post.user?._id}`} className="flex-shrink-0">
                    <Avatar avatar={post.user?.avatar} name={post.user?.name} size="md" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/user/${post.user?._id}`} className="block">
                      <div className="font-semibold hover:text-primary-500 transition-colors truncate">
                        {post.user?.name || 'Usuario'}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${badge.class}`}>
                        {badge.label}
                      </span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: es })}
                      </span>
                      {post.mood && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            {moods.find(m => m.id === post.mood)?.emoji}
                            {moods.find(m => m.id === post.mood)?.label}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(post._id)}
                      className="p-2 text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  )}
                </div>

                {/* Shared Post Indicator */}
                {post.sharedFrom && (
                  <div className="mb-3 p-3 bg-dark-200 rounded-xl border-l-4 border-primary-500">
                    <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <FiShare2 size={12} />
                      Compartido
                    </div>
                    {post.sharedFrom.user && (
                      <div className="text-sm text-gray-300">
                        {post.sharedFrom.content}
                      </div>
                    )}
                    {post.sharedFrom.images && post.sharedFrom.images.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {post.sharedFrom.images.slice(0, 2).map((img, idx) => (
                          <img key={idx} src={img} alt="Shared" className="w-full h-24 object-cover rounded-lg" />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Badge Share */}
                {post.postType === 'badge' && post.badgeData && (
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

                {/* Post Content */}
                {post.content && (
                  <p className="text-gray-100 mb-4 leading-relaxed">{post.content}</p>
                )}

                {/* Post Images */}
                {post.images && post.images.length > 0 && (
                  <div className={`mb-4 grid gap-2 ${
                    post.images.length === 1 ? 'grid-cols-1' :
                    post.images.length === 2 ? 'grid-cols-2' :
                    'grid-cols-2'
                  }`}>
                    {post.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Post ${idx + 1}`}
                        className="w-full rounded-lg object-cover"
                        style={{ height: post.images.length === 1 ? '400px' : '200px' }}
                      />
                    ))}
                  </div>
                )}

                {/* Poll */}
                {post.poll && (
                  <div className="mb-4 p-4 bg-dark-200 rounded-xl">
                    <h4 className="font-semibold mb-3">{post.poll.question}</h4>
                    <div className="space-y-2">
                      {post.poll.options.map((option, idx) => {
                        const votes = option.votes?.length || 0
                        const totalVotes = getTotalVotes(post)
                        const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0
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
                                  : 'bg-dark-100'
                                : 'bg-dark-100 hover:bg-dark-50'
                            } ${postHasVoted ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm">{option.text}</span>
                              {postHasVoted && (
                                <span className="text-xs text-gray-400">
                                  {votes} {votes === 1 ? 'voto' : 'votos'} ({Math.round(percentage)}%)
                                </span>
                              )}
                            </div>
                            {postHasVoted && (
                              <div className="h-2 bg-dark-300 rounded-full overflow-hidden">
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
                      <p className="text-xs text-gray-400 mt-2">
                        Total: {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
                      </p>
                    )}
                  </div>
                )}

                {/* Post Actions */}
                <div className="flex items-center gap-6 pt-4 border-t border-white/5">
                  <button
                    onClick={() => handleLike(post._id)}
                    className={`flex items-center gap-2 transition-colors ${
                      isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                    }`}
                  >
                    <FiHeart size={20} className={isLiked ? 'fill-current' : ''} />
                    <span>{post.likes?.length || 0}</span>
                  </button>

                  <button
                    onClick={() => setShowComments({ ...showComments, [post._id]: !showCommentSection })}
                    className="flex items-center gap-2 text-gray-400 hover:text-primary-500 transition-colors"
                  >
                    <FiMessageCircle size={20} />
                    <span>{postComments.length}</span>
                  </button>

                  <button
                    onClick={() => {
                      const shareText = prompt('Agrega un comentario (opcional):')
                      if (shareText !== null) {
                        handleShare(post._id, shareText)
                      }
                    }}
                    className="flex items-center gap-2 text-gray-400 hover:text-accent-cyan transition-colors"
                  >
                    <FiShare2 size={20} />
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
            )
          })}
        </div>
      )}
    </div>
  )
}
