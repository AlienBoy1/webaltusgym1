import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, Link } from 'react-router-dom'
import { FiAward, FiUsers, FiCalendar, FiTrendingUp, FiArrowLeft, FiUserCheck, FiUserPlus, FiUserX, FiCheck, FiX } from 'react-icons/fi'
import api from '../../utils/api'
import { useAuthStore } from '../../store/authStore'
import BadgesModal from '../../components/BadgesModal'
import { Avatar } from '../../utils/avatarUtils'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export default function UserProfile() {
  const { id } = useParams()
  const { user: currentUser } = useAuthStore()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showBadges, setShowBadges] = useState(false)
  const [followStatus, setFollowStatus] = useState({
    isFollowing: false,
    hasPendingRequest: false,
    followersCount: 0,
    followingCount: 0
  })
  const [posts, setPosts] = useState([])
  const [showPosts, setShowPosts] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)

  useEffect(() => {
    if (id) {
      fetchUser()
      checkFollowStatus()
    }
  }, [id])

  const fetchUser = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/users/${id}`)
      setUser(data)
    } catch (error) {
      console.error('Error fetching user:', error)
      toast.error('Error al cargar perfil')
    } finally {
      setLoading(false)
    }
  }

  const checkFollowStatus = async () => {
    if (!currentUser?._id || !id || currentUser._id === id) return
    
    try {
      const { data } = await api.get(`/social/${id}/follow-status`)
      setFollowStatus(data)
      
      // If following, fetch posts
      if (data.isFollowing) {
        fetchUserPosts()
      }
    } catch (error) {
      console.error('Error checking follow status:', error)
    }
  }

  const fetchUserPosts = async () => {
    if (!followStatus.isFollowing) return
    
    setLoadingPosts(true)
    try {
      const { data } = await api.get(`/social/user/${id}/posts`)
      setPosts(data)
      setShowPosts(true)
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoadingPosts(false)
    }
  }

  const handleFollow = async () => {
    try {
      const { data } = await api.post(`/social/${id}/follow`)
      if (data.status === 'pending') {
        setFollowStatus(prev => ({ ...prev, hasPendingRequest: true }))
        toast.success('Solicitud enviada')
      } else {
        setFollowStatus(prev => ({ ...prev, isFollowing: true, hasPendingRequest: false }))
        toast.success('Ahora sigues a este usuario')
        fetchUserPosts()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al seguir usuario')
    }
  }

  const handleUnfollow = async () => {
    try {
      await api.post(`/social/${id}/unfollow`)
      setFollowStatus(prev => ({ ...prev, isFollowing: false }))
      setPosts([])
      setShowPosts(false)
      toast.success('Dejaste de seguir a este usuario')
    } catch (error) {
      toast.error('Error al dejar de seguir')
    }
  }

  const handleAcceptFollowRequest = async (requesterId) => {
    try {
      await api.post(`/social/${requesterId}/accept-follow`)
      toast.success('Solicitud aceptada')
      // Refresh follow requests if viewing own profile
    } catch (error) {
      toast.error('Error al aceptar solicitud')
    }
  }

  const handleRejectFollowRequest = async (requesterId) => {
    try {
      await api.post(`/social/${requesterId}/reject-follow`)
      toast.success('Solicitud rechazada')
    } catch (error) {
      toast.error('Error al rechazar solicitud')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Usuario no encontrado</p>
        <Link to="/" className="btn-primary mt-4 inline-block">
          Volver al inicio
        </Link>
      </div>
    )
  }

  const isOwnProfile = currentUser?._id === id

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <FiArrowLeft size={20} />
        Volver
      </Link>

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card text-center"
      >
        <div className="relative inline-block mb-4">
          <Avatar avatar={user.avatar} name={user.name} size="xl" />
        </div>
        
        <h1 className="font-display text-2xl mb-1">{user.name}</h1>
        <p className="text-gray-400 mb-4">{user.email}</p>
        
        {/* Follow Stats */}
        <div className="flex items-center justify-center gap-6 mb-4">
          <div className="text-center">
            <div className="font-semibold text-lg">{followStatus.followersCount || user.social?.followers?.length || 0}</div>
            <div className="text-sm text-gray-400">Seguidores</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg">{followStatus.followingCount || user.social?.following?.length || 0}</div>
            <div className="text-sm text-gray-400">Seguidos</div>
          </div>
        </div>
        
        {!isOwnProfile && (
          <div className="flex gap-2 justify-center">
            {followStatus.isFollowing ? (
              <button
                onClick={handleUnfollow}
                className="btn-secondary py-2 px-6 flex items-center gap-2"
              >
                <FiUserX size={18} />
                Dejar de seguir
              </button>
            ) : followStatus.hasPendingRequest ? (
              <button
                disabled
                className="btn-secondary py-2 px-6 flex items-center gap-2 opacity-50 cursor-not-allowed"
              >
                <FiUserPlus size={18} />
                Solicitud pendiente
              </button>
            ) : (
              <button
                onClick={handleFollow}
                className="btn-primary py-2 px-6 flex items-center gap-2"
              >
                <FiUserPlus size={18} />
                Seguir
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-4"
      >
        {[
          { label: 'Entrenamientos', value: user.stats?.totalWorkouts || 0, icon: FiTrendingUp },
          { label: 'Días Activo', value: user.stats?.longestStreak || 0, icon: FiCalendar },
          { label: 'Nivel', value: user.stats?.level || 1, icon: FiAward },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <stat.icon className="mx-auto mb-2 text-primary-500" size={24} />
            <div className="font-display text-2xl text-primary-500">{stat.value}</div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
          </div>
        ))}
      </motion.div>

      {/* XP Total */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">XP Total</span>
          <span className="font-bold text-accent-yellow">{user.stats?.xp || 0} XP</span>
        </div>
        <div className="h-3 bg-dark-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-yellow to-orange-500 rounded-full transition-all"
            style={{ width: `${Math.min(100, ((user.stats?.xp || 0) % 100))}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {100 - ((user.stats?.xp || 0) % 100)} XP hasta el siguiente nivel
        </div>
      </motion.div>

      {/* Badges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl flex items-center gap-2">
            <FiAward className="text-accent-yellow" />
            Insignias
          </h2>
          {(user.badges?.length > 0 || isOwnProfile) && (
            <button
              onClick={() => setShowBadges(true)}
              className="text-primary-500 hover:text-primary-400 text-sm"
            >
              Ver todas
            </button>
          )}
        </div>
        
        {user.badges && user.badges.length > 0 ? (
          <div className="grid grid-cols-4 gap-3">
            {user.badges.slice(0, 8).map((badge, index) => (
              <div
                key={badge.id || badge._id || index}
                className="text-center p-3 bg-dark-200 rounded-xl hover:bg-dark-100 transition-colors cursor-pointer"
                onClick={() => setShowBadges(true)}
              >
                <div className="text-3xl mb-1">{badge.icon}</div>
                <div className="text-xs text-gray-400 truncate">{badge.name}</div>
              </div>
            ))}
            {user.badges.length > 8 && (
              <div
                className="text-center p-3 bg-dark-200 rounded-xl hover:bg-dark-100 transition-colors cursor-pointer flex items-center justify-center"
                onClick={() => setShowBadges(true)}
              >
                <div className="text-gray-400 text-sm">+{user.badges.length - 8}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <FiAward size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Este usuario aún no tiene insignias</p>
          </div>
        )}
      </motion.div>

      {/* User Posts (if following) */}
      {!isOwnProfile && followStatus.isFollowing && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl flex items-center gap-2">
              <FiUsers className="text-primary-500" />
              Publicaciones
            </h2>
            <button
              onClick={() => {
                if (!showPosts && posts.length === 0) {
                  fetchUserPosts()
                } else {
                  setShowPosts(!showPosts)
                }
              }}
              className="text-primary-500 hover:text-primary-400 text-sm"
            >
              {showPosts ? 'Ocultar' : 'Ver'}
            </button>
          </div>

          <AnimatePresence>
            {showPosts && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                {loadingPosts ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">Este usuario aún no ha publicado nada</p>
                  </div>
                ) : (
                  posts.map((post) => (
                    <div key={post._id} className="p-4 bg-dark-200 rounded-xl">
                      {post.content && (
                        <p className="text-gray-100 mb-3">{post.content}</p>
                      )}
                      {post.images && post.images.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {post.images.slice(0, 2).map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt={`Post ${idx + 1}`}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: es })}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <BadgesModal
        isOpen={showBadges}
        onClose={() => setShowBadges(false)}
        userId={id}
      />
    </div>
  )
}
