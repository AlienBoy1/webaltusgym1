import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  FiAward,
  FiUsers,
  FiCalendar,
  FiTrendingUp,
  FiArrowLeft,
  FiUserPlus,
  FiUserX,
  FiCheck,
  FiX,
  FiMessageCircle,
  FiClock,
  FiLock
} from 'react-icons/fi'
import api from '../../utils/api'
import { useAuthStore } from '../../store/authStore'
import BadgesModal from '../../components/BadgesModal'
import ProfileFeed from '../../components/ProfileFeed'
import ProfileAvatar from '../../components/ProfileAvatar'
import RoutineDetailModal, { toStartableTemplate } from '../../components/RoutineDetailModal'
import SharePostSheet from '../../components/SharePostSheet'
import PostReactorsModal from '../../components/PostReactorsModal'
import PostDetailSheet from '../../components/PostDetailSheet'
import PostImageViewer from '../../components/PostImageViewer'
import { Avatar } from '../../utils/avatarUtils'
import { useStoryViewer } from '../../components/StoryViewerContext'
import { useAppDialog } from '../../components/AppDialog'
import ProtectedMedia from '../../components/ProtectedMedia'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const WORKOUT_TEMPLATES_KEY = 'qyntra:workout_templates'

export default function UserProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dialog = useAppDialog()
  const { user: currentUser } = useAuthStore()
  const { openUserStory } = useStoryViewer()
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
  const [postsLocked, setPostsLocked] = useState(false)
  const [listModal, setListModal] = useState(null) // 'followers' | 'following' | null
  const [listUsers, setListUsers] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [followRequests, setFollowRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [hasStories, setHasStories] = useState(false)
  const [selectedRoutine, setSelectedRoutine] = useState(null)
  const [sharePostTarget, setSharePostTarget] = useState(null)
  const [sharingPost, setSharingPost] = useState(false)
  const [reactorsPost, setReactorsPost] = useState(null)
  const [detailPost, setDetailPost] = useState(null)
  const [imageViewer, setImageViewer] = useState(null)
  const [followStatusReady, setFollowStatusReady] = useState(false)
  const privateAlertFor = useRef(null)

  const resolvedId = user?._id || user?.id || id
  const isOwnProfile = Boolean(
    currentUser &&
      resolvedId &&
      (currentUser._id === resolvedId || currentUser.id === resolvedId || currentUser._id === id)
  )

  const isProfilePublic = user?.settings?.privacy?.profilePublic !== false
  const canViewPrivateContent = useMemo(() => {
    if (!user) return false
    if (isOwnProfile) return true
    if (isProfilePublic) return true
    if (!followStatusReady) return false
    return followStatus.isFollowing
  }, [user, isOwnProfile, followStatus.isFollowing, isProfilePublic, followStatusReady])

  const isLockedVisitor = Boolean(
    user && !isOwnProfile && !isProfilePublic && followStatusReady && !followStatus.isFollowing
  )
  const waitingPrivateGate = Boolean(
    user && !isOwnProfile && !isProfilePublic && !followStatusReady
  )

  useEffect(() => {
    if (id) {
      setFollowStatusReady(false)
      privateAlertFor.current = null
      fetchUser()
      checkFollowStatus()
      checkStories()
      if (currentUser?._id === id) {
        fetchFollowRequests()
        loadUserPosts()
      } else {
        setFollowRequests([])
      }
    }
  }, [id, currentUser?._id])

  // After profile loads by username/id, refresh follow status with UUID
  useEffect(() => {
    if (!user?._id && !user?.id) return
    const uid = user._id || user.id
    if (uid === id) return
    checkFollowStatus(uid)
    if (!isOwnProfile) loadUserPosts(uid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.id])

  const checkStories = async () => {
    try {
      const { data } = await api.get('/stories/feed')
      const groups = data?.groups || []
      const group = groups.find((g) => (g.user?._id || g.user) === id)
      setHasStories(Boolean(group?.stories?.length))
    } catch {
      setHasStories(false)
    }
  }

  const openStory = () => {
    openUserStory(id)
  }

  const adoptRoutineFromPost = (workout) => {
    const local = toStartableTemplate(workout)
    try {
      const stored = JSON.parse(localStorage.getItem(WORKOUT_TEMPLATES_KEY) || '[]')
      localStorage.setItem(WORKOUT_TEMPLATES_KEY, JSON.stringify([...stored, local]))
      toast.success('Rutina adoptada')
      setSelectedRoutine(null)
    } catch {
      toast.error('No se pudo guardar la rutina')
    }
  }

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

  const checkFollowStatus = async (targetId = id) => {
    if (!currentUser?._id || !targetId) {
      setFollowStatusReady(true)
      return
    }

    try {
      const { data } = await api.get(`/social/${targetId}/follow-status`)
      setFollowStatus(data)

      if (currentUser._id !== targetId) {
        loadUserPosts(targetId)
      }
    } catch (error) {
      console.error('Error checking follow status:', error)
    } finally {
      setFollowStatusReady(true)
    }
  }

  const loadUserPosts = async (targetId = id) => {
    setLoadingPosts(true)
    try {
      const { data } = await api.get(`/social/user/${targetId}/posts`)
      if (data && !Array.isArray(data) && data.locked) {
        setPosts([])
        setPostsLocked(true)
      } else {
        setPosts(Array.isArray(data) ? data : data?.posts || [])
        setPostsLocked(false)
      }
      setShowPosts(true)
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoadingPosts(false)
    }
  }

  const fetchFollowRequests = async () => {
    setLoadingRequests(true)
    try {
      const { data } = await api.get('/social/follow-requests')
      setFollowRequests(data || [])
    } catch (error) {
      console.error('Error fetching follow requests:', error)
    } finally {
      setLoadingRequests(false)
    }
  }

  const openList = async (type) => {
    setListModal(type)
    setLoadingList(true)
    setListUsers([])
    try {
      const { data } = await api.get(`/social/${type}?userId=${resolvedId || id}`)
      setListUsers(data || [])
    } catch (error) {
      toast.error('Error al cargar lista')
      setListModal(null)
    } finally {
      setLoadingList(false)
    }
  }

  const handleFollow = async () => {
    const targetId = resolvedId || id
    try {
      const { data } = await api.post(`/social/${targetId}/follow`)
      if (data.status === 'pending') {
        setFollowStatus((prev) => ({ ...prev, hasPendingRequest: true }))
        toast.success('Solicitud enviada')
      } else {
        setFollowStatus((prev) => ({
          ...prev,
          isFollowing: true,
          hasPendingRequest: false,
          followersCount: (prev.followersCount || 0) + 1
        }))
        toast.success('Ahora sigues a este usuario')
        loadUserPosts(targetId)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al seguir usuario')
    }
  }

  // Private profile alert (native) — once per visited profile, after follow status is known
  useEffect(() => {
    if (!user || loading || isOwnProfile || !followStatusReady) return
    if (followStatus.isFollowing || isProfilePublic) return
    const uid = user._id || user.id
    if (!uid || privateAlertFor.current === uid) return
    privateAlertFor.current = uid

    ;(async () => {
      const wantsFollow = await dialog.confirm(
        'Este perfil es privado. Quienes no lo siguen no pueden ver sus publicaciones ni sus insignias, ni interactuar con su contenido social.\n\nSigue a este usuario para ver sus publicaciones e insignias e interactuar con él.',
        {
          title: 'Perfil privado',
          confirmLabel: 'Seguir',
          cancelLabel: 'Entendido',
          tone: 'info'
        }
      )
      if (wantsFollow && !followStatus.hasPendingRequest) {
        await handleFollow()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?._id,
    user?.id,
    loading,
    isOwnProfile,
    followStatusReady,
    followStatus.isFollowing,
    isProfilePublic
  ])

  const handleUnfollow = async () => {
    try {
      await api.post(`/social/${resolvedId || id}/unfollow`)
      setFollowStatus((prev) => ({
        ...prev,
        isFollowing: false,
        followersCount: Math.max(0, (prev.followersCount || 0) - 1)
      }))
      setPosts([])
      setShowPosts(false)
      toast.success('Dejaste de seguir a este usuario')
    } catch (error) {
      toast.error('Error al dejar de seguir')
    }
  }

  const handleCancelRequest = async () => {
    try {
      await api.post(`/social/${resolvedId || id}/cancel-follow`)
      setFollowStatus((prev) => ({ ...prev, hasPendingRequest: false }))
      toast.success('Solicitud cancelada')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al cancelar')
    }
  }

  const handleAcceptFollowRequest = async (requesterId) => {
    try {
      await api.post(`/social/${requesterId}/accept-follow`)
      toast.success('Solicitud aceptada')
      setFollowRequests((prev) => prev.filter((r) => (r.user?._id || r.user) !== requesterId))
      setFollowStatus((prev) => ({
        ...prev,
        followersCount: (prev.followersCount || 0) + 1
      }))
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al aceptar solicitud')
    }
  }

  const handleRejectFollowRequest = async (requesterId) => {
    try {
      await api.post(`/social/${requesterId}/reject-follow`)
      toast.success('Solicitud rechazada')
      setFollowRequests((prev) => prev.filter((r) => (r.user?._id || r.user) !== requesterId))
    } catch (error) {
      toast.error('Error al rechazar solicitud')
    }
  }

  const handleMessage = async () => {
    const allowMessages = user?.settings?.privacy?.allowMessages !== false
    if (!allowMessages) {
      await dialog.alert(
        'Este usuario tiene desactivada la mensajería por ahora. Cuando la active podrás escribirle; inténtalo de nuevo más tarde.',
        {
          title: 'Mensajería no disponible',
          confirmLabel: 'Entendido',
          tone: 'info'
        }
      )
      return
    }
    navigate('/chat', {
      state: {
        startWith: {
          _id: resolvedId || id,
          name: user?.name,
          username: user?.username,
          avatar: user?.avatar
        }
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Usuario no encontrado</p>
        <Link to="/dashboard" className="btn-primary mt-4 inline-block">
          Volver al inicio
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <FiArrowLeft size={20} />
        Volver
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card text-center overflow-hidden p-0"
      >
        <div data-protected-media="1" className="relative h-[150px] sm:h-[236px] overflow-hidden">
          {user.profile?.coverUrl ? (
            <ProtectedMedia
              src={user.profile.coverUrl}
              alt=""
              className="h-full w-full scale-[1.02] object-cover object-center"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  'linear-gradient(135deg, rgba(var(--color-primary-rgb),0.42), rgba(var(--color-accent-rgb),0.16) 55%, rgba(var(--color-primary-rgb),0.22))'
              }}
            />
          )}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-16"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.28), rgba(0,0,0,0.08) 45%, transparent)'
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 85% at 50% 20%, transparent 40%, rgba(0,0,0,0.18) 100%)'
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] sm:h-[68%]"
            style={{
              background: `
                linear-gradient(
                  to top,
                  var(--bg-card) 0%,
                  color-mix(in srgb, var(--bg-card) 92%, transparent) 18%,
                  color-mix(in srgb, var(--bg-card) 55%, transparent) 42%,
                  color-mix(in srgb, var(--bg-card) 18%, transparent) 68%,
                  transparent 100%
                )
              `
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
            style={{
              background:
                'linear-gradient(to top, rgba(var(--color-primary-rgb),0.12), rgba(var(--color-primary-rgb),0.04) 45%, transparent)'
            }}
          />
        </div>
        <div className="relative z-10 -mt-16 px-4 pb-5 sm:-mt-[4.5rem] sm:px-6">
        <div className="relative mb-4 inline-block">
          <div className="absolute -inset-1 rounded-full bg-[color:var(--bg-card)]/80 blur-[1px]" aria-hidden />
          <div className="relative">
          <ProfileAvatar
            avatar={user.avatar}
            name={user.name}
            size="xl"
            hasStories={hasStories}
            onViewStory={openStory}
          />
          </div>
        </div>

        <h1 className="font-display text-2xl mb-1">{user.name}</h1>
        <p className="text-gray-400 mb-4 break-all text-sm sm:text-base">
          {user.username ? `@${user.username}` : 'Sin username'}
        </p>

        <div className="flex items-center justify-center gap-6 mb-4">
          <button
            type="button"
            onClick={() => openList('followers')}
            className="text-center hover:text-primary-400 transition-colors"
          >
            <div className="font-semibold text-lg">
              {followStatus.followersCount || user.social?.followers?.length || 0}
            </div>
            <div className="text-sm text-gray-400">Seguidores</div>
          </button>
          <button
            type="button"
            onClick={() => openList('following')}
            className="text-center hover:text-primary-400 transition-colors"
          >
            <div className="font-semibold text-lg">
              {followStatus.followingCount || user.social?.following?.length || 0}
            </div>
            <div className="text-sm text-gray-400">Seguidos</div>
          </button>
        </div>

        {!isOwnProfile && (
          <div className="flex flex-wrap gap-2 justify-center">
            {followStatus.isFollowing ? (
              <button
                onClick={handleUnfollow}
                className="btn-secondary py-2 px-4 sm:px-6 flex items-center gap-2"
              >
                <FiUserX size={18} />
                Dejar de seguir
              </button>
            ) : followStatus.hasPendingRequest ? (
              <button
                onClick={handleCancelRequest}
                className="btn-secondary py-2 px-4 sm:px-6 flex items-center gap-2"
              >
                <FiClock size={18} />
                Cancelar solicitud
              </button>
            ) : (
              <button
                onClick={handleFollow}
                className="btn-primary py-2 px-4 sm:px-6 flex items-center gap-2"
              >
                <FiUserPlus size={18} />
                Seguir
              </button>
            )}
            <button
              onClick={handleMessage}
              className="btn-secondary py-2 px-4 sm:px-6 flex items-center gap-2"
            >
              <FiMessageCircle size={18} />
              Mensaje
            </button>
          </div>
        )}
        </div>
      </motion.div>

      {isOwnProfile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card"
        >
          <h2 className="font-display text-xl flex items-center gap-2 mb-4">
            <FiUserPlus className="text-primary-500" />
            Solicitudes de seguimiento
            {followRequests.length > 0 && (
              <span className="text-sm bg-primary-500 text-white px-2 py-0.5 rounded-full">
                {followRequests.length}
              </span>
            )}
          </h2>
          {loadingRequests ? (
            <div className="text-center py-6">
              <div className="w-6 h-6 border-2 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : followRequests.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No hay solicitudes pendientes</p>
          ) : (
            <div className="space-y-3">
              {followRequests.map((req) => {
                const requester = typeof req.user === 'object' ? req.user : { _id: req.user }
                const requesterId = requester._id || requester.id
                return (
                  <div
                    key={req.id || req._id}
                    className="flex items-center gap-3 p-3 bg-dark-200 rounded-xl"
                  >
                    <Link to={`/user/${requesterId}`} className="flex-shrink-0">
                      <Avatar avatar={requester.avatar} name={requester.name} size="md" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/user/${requesterId}`}
                        className="font-medium hover:text-primary-400 truncate block"
                      >
                        {requester.name || 'Usuario'}
                      </Link>
                      {req.requestedAt && (
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(req.requestedAt), {
                            addSuffix: true,
                            locale: es
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAcceptFollowRequest(requesterId)}
                        className="p-2 bg-primary-500 rounded-lg text-white hover:bg-primary-600"
                        aria-label="Aceptar"
                      >
                        <FiCheck size={18} />
                      </button>
                      <button
                        onClick={() => handleRejectFollowRequest(requesterId)}
                        className="p-2 bg-dark-100 rounded-lg text-gray-300 hover:text-red-400"
                        aria-label="Rechazar"
                      >
                        <FiX size={18} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-2 sm:gap-4"
      >
        {[
          { label: 'Entrenamientos', value: user.stats?.totalWorkouts || 0, icon: FiTrendingUp },
          { label: 'Días Activo', value: user.stats?.longestStreak || 0, icon: FiCalendar },
          { label: 'Nivel', value: user.stats?.level || 1, icon: FiAward }
        ].map((stat) => (
          <div key={stat.label} className="card text-center p-3 sm:p-4">
            <stat.icon className="mx-auto mb-2 text-primary-500" size={22} />
            <div className="font-display text-xl sm:text-2xl text-primary-500">{stat.value}</div>
            <div className="text-gray-400 text-xs sm:text-sm">{stat.label}</div>
          </div>
        ))}
      </motion.div>

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
            style={{ width: `${Math.min(100, (user.stats?.xp || 0) % 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {100 - ((user.stats?.xp || 0) % 100)} XP hasta el siguiente nivel
        </div>
      </motion.div>

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
          {canViewPrivateContent && (user.badges?.length > 0 || isOwnProfile) && (
            <button
              onClick={() => setShowBadges(true)}
              className="text-primary-500 hover:text-primary-400 text-sm"
            >
              Ver todas
            </button>
          )}
        </div>

        {isLockedVisitor || waitingPrivateGate ? (
          <div className="text-center py-8 px-3">
            <FiLock size={32} className="mx-auto mb-3 opacity-50" style={{ color: 'var(--text-muted)' }} />
            <p className="font-semibold mb-2">Insignias ocultas</p>
            <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Sigue a este usuario para ver sus publicaciones e insignias e interactuar con él.
            </p>
            {isLockedVisitor && !followStatus.hasPendingRequest && (
              <button
                type="button"
                onClick={handleFollow}
                className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
              >
                <FiUserPlus size={16} /> Seguir
              </button>
            )}
          </div>
        ) : user.badges && user.badges.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {user.badges.slice(0, 8).map((badge, index) => (
              <div
                key={badge.id || badge._id || index}
                className="text-center p-2 sm:p-3 bg-dark-200 rounded-xl hover:bg-dark-100 transition-colors cursor-pointer"
                onClick={() => setShowBadges(true)}
              >
                <div className="text-2xl sm:text-3xl mb-1">{badge.icon}</div>
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

      {(isOwnProfile || canViewPrivateContent || isLockedVisitor || waitingPrivateGate) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl flex items-center gap-2">
              <FiUsers className="text-primary-500" />
              Publicaciones
            </h2>
            {!isOwnProfile && canViewPrivateContent && (
              <button
                onClick={() => {
                  if (!showPosts && posts.length === 0) {
                    loadUserPosts(resolvedId || id)
                  } else {
                    setShowPosts(!showPosts)
                  }
                }}
                className="text-primary-500 hover:text-primary-400 text-sm"
              >
                {showPosts ? 'Ocultar' : 'Ver'}
              </button>
            )}
          </div>

          {isLockedVisitor || waitingPrivateGate || postsLocked ? (
            <div className="card text-center py-10 px-4">
              <FiLock size={36} className="mx-auto mb-3 opacity-50" style={{ color: 'var(--text-muted)' }} />
              <p className="font-semibold mb-2">Perfil no público</p>
              <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Sigue a este usuario para ver sus publicaciones e insignias e interactuar con él.
              </p>
              {!isOwnProfile && isLockedVisitor && !followStatus.hasPendingRequest && (
                <button
                  type="button"
                  onClick={handleFollow}
                  className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <FiUserPlus size={16} /> Seguir
                </button>
              )}
            </div>
          ) : (isOwnProfile || showPosts || canViewPrivateContent) && (
            <ProfileFeed
              posts={posts}
              loading={loadingPosts}
              emptyLabel={isOwnProfile ? 'Aún no has publicado nada' : 'Este usuario aún no ha publicado nada'}
              onOpenRoutine={(workout, author) => setSelectedRoutine({ workout, author })}
              currentUserId={currentUser?._id}
              onDelete={async (postId) => {
                const ok = await dialog.confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.', {
                  title: 'Eliminar publicación',
                  confirmLabel: 'Eliminar',
                  tone: 'danger'
                })
                if (!ok) return
                try {
                  await api.delete(`/social/${postId}`)
                  setPosts((prev) => prev.filter((p) => (p._id || p.id) !== postId))
                  toast.success('Publicación eliminada')
                } catch {
                  toast.error('No se pudo eliminar')
                }
              }}
              onReact={async (postId, emoji) => {
                try {
                  const { data } = await api.post(`/social/${postId}/like`, { emoji })
                  setPosts((prev) =>
                    prev.map((p) => {
                      if ((p._id || p.id) !== postId) return p
                      const uid = currentUser?._id
                      let likes = [...(p.likes || [])]
                      const has = likes.some((id) => (id?._id || id) === uid)
                      const nextReaction = data.liked
                        ? (data.myReaction || emoji || '❤️')
                        : null
                      if (data.liked && !has) likes.push(uid)
                      if (!data.liked) likes = likes.filter((id) => (id?._id || id) !== uid)

                      let reactionSummary = [...(p.reactionSummary || [])]
                      let reactors = [...(p.reactors || [])]
                      const prevReaction = p.myReaction
                      if (prevReaction) {
                        reactionSummary = reactionSummary
                          .map((r) => (r.emoji === prevReaction ? { ...r, count: r.count - 1 } : r))
                          .filter((r) => r.count > 0)
                        reactors = reactors.filter((r) => r.userId !== uid)
                      }
                      if (nextReaction) {
                        const existing = reactionSummary.find((r) => r.emoji === nextReaction)
                        if (existing) {
                          reactionSummary = reactionSummary.map((r) =>
                            r.emoji === nextReaction ? { ...r, count: r.count + 1 } : r
                          )
                        } else {
                          reactionSummary = [...reactionSummary, { emoji: nextReaction, count: 1 }]
                        }
                        reactors = [
                          ...reactors.filter((r) => r.userId !== uid),
                          {
                            userId: uid,
                            emoji: nextReaction,
                            name: currentUser?.name,
                            username: currentUser?.username,
                            avatar: currentUser?.avatar
                          }
                        ]
                      }

                      return {
                        ...p,
                        likes,
                        myReaction: nextReaction,
                        reactionSummary: Array.isArray(data.reactionSummary)
                          ? data.reactionSummary
                          : reactionSummary,
                        reactors
                      }
                    })
                  )
                } catch {
                  toast.error('Error al reaccionar')
                }
              }}
              onShare={(post) => setSharePostTarget(post)}
              onShowReactors={(post) => setReactorsPost(post)}
              onOpenPost={(post) => setDetailPost(post)}
              onOpenImage={(post, index) => setImageViewer({ post, index })}
            />
          )}
        </motion.div>
      )}

      <RoutineDetailModal
        open={Boolean(selectedRoutine)}
        onClose={() => setSelectedRoutine(null)}
        routine={selectedRoutine?.workout}
        author={selectedRoutine?.author || user}
        onAdopt={() => adoptRoutineFromPost(selectedRoutine?.workout)}
      />

      <PostDetailSheet
        open={Boolean(detailPost)}
        post={detailPost}
        onClose={() => setDetailPost(null)}
        onShare={(post) => {
          setDetailPost(null)
          setSharePostTarget(post)
        }}
        onOpenRoutine={(workout, author) => setSelectedRoutine({ workout, author })}
        onPostUpdated={(updated) => {
          if (!updated) return
          setPosts((prev) =>
            prev.map((p) =>
              (p._id || p.id) === (updated._id || updated.id) ? { ...p, ...updated } : p
            )
          )
          setDetailPost((curr) =>
            curr && (curr._id || curr.id) === (updated._id || updated.id)
              ? { ...curr, ...updated }
              : curr
          )
          setImageViewer((curr) =>
            curr?.post && (curr.post._id || curr.post.id) === (updated._id || updated.id)
              ? { ...curr, post: { ...curr.post, ...updated } }
              : curr
          )
        }}
      />

      <PostImageViewer
        open={Boolean(imageViewer)}
        post={imageViewer?.post}
        initialIndex={imageViewer?.index || 0}
        onClose={() => setImageViewer(null)}
        onShare={(p) => {
          setImageViewer(null)
          setSharePostTarget(p)
        }}
        onPostUpdated={(updated) => {
          if (!updated) return
          setPosts((prev) =>
            prev.map((p) =>
              (p._id || p.id) === (updated._id || updated.id) ? { ...p, ...updated } : p
            )
          )
          setImageViewer((curr) =>
            curr?.post && (curr.post._id || curr.post.id) === (updated._id || updated.id)
              ? { ...curr, post: { ...curr.post, ...updated } }
              : curr
          )
        }}
      />

      <SharePostSheet
        open={Boolean(sharePostTarget)}
        post={sharePostTarget}
        onClose={() => !sharingPost && setSharePostTarget(null)}
        sharingCommunity={sharingPost}
        onShareCommunity={async ({ content, mood, poll }) => {
          if (!sharePostTarget) return
          try {
            setSharingPost(true)
            await api.post(`/social/${sharePostTarget._id || sharePostTarget.id}/share`, {
              content,
              mood,
              poll
            })
            setSharePostTarget(null)
            toast.success('Publicación compartida en tu feed')
          } catch (error) {
            toast.error(error.response?.data?.message || 'Error al compartir')
          } finally {
            setSharingPost(false)
          }
        }}
      />

      <PostReactorsModal
        open={Boolean(reactorsPost)}
        onClose={() => setReactorsPost(null)}
        postId={reactorsPost?._id || reactorsPost?.id}
        reactors={reactorsPost?.reactors || []}
      />

      <AnimatePresence>
        {listModal && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="card max-w-md w-full rounded-b-none sm:rounded-2xl max-h-[80dvh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl">
                  {listModal === 'followers' ? 'Seguidores' : 'Seguidos'}
                </h2>
                <button onClick={() => setListModal(null)} aria-label="Cerrar">
                  <FiX size={24} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 min-h-0">
                {loadingList ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
                  </div>
                ) : listUsers.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Lista vacía</p>
                ) : (
                  listUsers.map((u) => (
                    <Link
                      key={u._id || u.id}
                      to={`/user/${u._id || u.id}`}
                      onClick={() => setListModal(null)}
                      className="flex items-center gap-3 p-3 hover:bg-dark-200 rounded-xl"
                    >
                      <Avatar avatar={u.avatar} name={u.name} size="md" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name}</div>
                        {u.username && (
                          <div className="text-sm text-primary-500 truncate">@{u.username}</div>
                        )}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BadgesModal
        isOpen={showBadges && canViewPrivateContent}
        onClose={() => setShowBadges(false)}
        userId={resolvedId || id}
      />
    </div>
  )
}
