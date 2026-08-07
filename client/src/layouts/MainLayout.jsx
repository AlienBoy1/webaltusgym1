import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiHome, FiUsers, FiActivity, FiTrendingUp, FiUser, FiBell, FiSettings, FiCalendar, FiTarget, FiMessageCircle, FiLogOut, FiArrowLeft, FiSearch, FiX, FiMoon, FiSun, FiUserPlus, FiBookOpen } from 'react-icons/fi'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import NotificationPrompt from '../components/NotificationPrompt'
import InviteFriendsModal from '../components/InviteFriendsModal'
import UsernameSetupModal from '../components/UsernameSetupModal'
import AppTutorial, { openTutorialHub } from '../components/AppTutorial'
import TutorialHub from '../components/TutorialHub'
import NewTutorialPrompt from '../components/NewTutorialPrompt'
import MembershipExpiryNotice from '../components/MembershipExpiryNotice'
import { initSocket, disconnectSocket } from '../utils/socket'
import api from '../utils/api'
import { Link } from 'react-router-dom'
import QyntraLogo from '../components/QyntraLogo'
import { Avatar } from '../utils/avatarUtils'
import {
  applyAppearanceSettings,
  cacheAppearance,
  loadCachedSettings,
  bindSystemThemeListener,
  applyThemeMode
} from '../utils/theme'
import { StoryViewerProvider } from '../components/StoryViewerContext'
import PresenceManager from '../components/PresenceManager'
import PresenceDot from '../components/PresenceDot'
import { installMediaProtection } from '../components/ProtectedMedia'
import { prefetchRoute } from '../utils/routePrefetch'

const navItems = [
  { path: '/dashboard', icon: FiHome, label: 'Inicio', tour: 'nav-dashboard' },
  { path: '/social', icon: FiUsers, label: 'Social', tour: 'nav-social' },
  { path: '/workouts', icon: FiActivity, label: 'Entrenos', tour: 'nav-workouts' },
  { path: '/progress', icon: FiTrendingUp, label: 'Progreso', tour: 'nav-progress' },
  { path: '/profile', icon: FiUser, label: 'Perfil', tour: 'nav-profile' },
]

const headerIcons = [
  { path: '/classes', icon: FiCalendar, tour: 'nav-classes' },
  { path: '/challenges', icon: FiTarget, tour: 'nav-challenges' },
  { path: '/chat', icon: FiMessageCircle, tour: 'nav-chat' },
  { path: '/settings', icon: FiSettings },
  { path: '/notifications', icon: FiBell, tour: 'nav-notifications' },
]

export default function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const loadMyMedia = useAuthStore((s) => s.loadMyMedia)
  const { unreadCount, fetchUnreadCount, subscribeRealtime, unsubscribeRealtime } = useNotificationStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [searching, setSearching] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [chatThreadOpen, setChatThreadOpen] = useState(false)
  const [themeMode, setThemeMode] = useState(() => {
    const id = user?.id || user?._id
    const cached = id ? loadCachedSettings(id) : loadCachedSettings(null)
    if (cached?.theme === 'dark') return 'dark'
    if (cached?.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  })
  const avatarMenuRef = useRef(null)
  const avatarMenuPanelRef = useRef(null)
  
  const isDashboard = location.pathname === '/dashboard'
  const canGoBack = !isDashboard && location.pathname !== '/'

  useEffect(() => {
    const sync = () => setChatThreadOpen(document.body.dataset.chatThread === '1')
    sync()
    window.addEventListener('qyntra:chat-thread', sync)
    return () => window.removeEventListener('qyntra:chat-thread', sync)
  }, [])

  useEffect(() => {
    if (location.pathname !== '/chat') {
      setChatThreadOpen(false)
      delete document.body.dataset.chatThread
      delete document.body.dataset.chatStyled
      window.dispatchEvent(new CustomEvent('qyntra:chat-thread'))
    }
  }, [location.pathname])

  useEffect(() => {
    if (!avatarMenuOpen) return
    const onDoc = (e) => {
      // Keep menu open while the product tour is controlling it
      if (document.body.dataset.qyntraTutorial === '1') return
      const t = e.target
      if (avatarMenuRef.current?.contains(t)) return
      if (avatarMenuPanelRef.current?.contains(t)) return
      setAvatarMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [avatarMenuOpen])

  useEffect(() => {
    const onMenu = (e) => {
      const open = Boolean(e?.detail?.open)
      setAvatarMenuOpen(open)
    }
    window.addEventListener('qyntra:avatar-menu', onMenu)
    return () => window.removeEventListener('qyntra:avatar-menu', onMenu)
  }, [])

  const persistTheme = async (nextTheme) => {
    setThemeMode(nextTheme)
    applyThemeMode(nextTheme)
    const id = user?.id || user?._id
    const cached = (id ? loadCachedSettings(id) : null) || {}
    const next = { ...cached, theme: nextTheme, colorTheme: cached.colorTheme || 'orange' }
    applyAppearanceSettings(next)
    cacheAppearance(next)
    if (id) {
      try {
        const saved = localStorage.getItem(`settings_${id}`)
        const parsed = saved ? JSON.parse(saved) : {}
        const merged = { ...parsed, ...next, theme: nextTheme }
        localStorage.setItem(`settings_${id}`, JSON.stringify(merged))
        await api.put('/users/profile', { settings: merged })
      } catch {
        /* local already updated */
      }
    }
  }

  const toggleTheme = () => {
    persistTheme(themeMode === 'light' ? 'dark' : 'light')
  }
  
  useEffect(() => {
    const id = user?.id || user?._id
    fetchUnreadCount()
    if (id) {
      initSocket(id)
      subscribeRealtime(id)
    }
    return () => {
      disconnectSocket()
      unsubscribeRealtime()
    }
    // Intentionally only on user id — full user object changes must not reconnect sockets
  }, [user?.id, user?._id])

  useEffect(() => installMediaProtection(), [])

  // Restore avatar/cover stripped by slim /auth/me (after first paint)
  useEffect(() => {
    const id = user?.id || user?._id
    if (!id) return undefined
    const needsMedia =
      !user?.avatar ||
      (user?.avatar && String(user.avatar).startsWith('icon:')) ||
      !user?.profile?.coverUrl
    // Always refresh once per session user — cover/avatar live outside /auth/me
    let cancelled = false
    const run = () => {
      if (!cancelled) loadMyMedia()
    }
    const t = window.setTimeout(() => {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(run, { timeout: 1500 })
      } else {
        run()
      }
    }, needsMedia ? 50 : 400)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [user?.id, user?._id, loadMyMedia])

  // Chat conversations load only on /chat (no global prefetch competing with every page)

  // Apply saved theme / accent — prefer cache; fetch light settings only if missing
  useEffect(() => {
    const id = user?.id || user?._id
    if (!id) return
    const cached = loadCachedSettings(id)
    if (cached) {
      applyAppearanceSettings(cached)
      bindSystemThemeListener(() => cached.theme || 'dark')
      setThemeMode(
        cached.theme === 'light'
          ? 'light'
          : cached.theme === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
            : cached.theme === 'dark'
              ? 'dark'
              : 'light'
      )
      return
    }
    ;(async () => {
      try {
        const { data } = await api.get('/users/profile')
        if (data?.settings) {
          applyAppearanceSettings(data.settings)
          cacheAppearance(data.settings)
          localStorage.setItem(`settings_${id}`, JSON.stringify(data.settings))
          bindSystemThemeListener(() => data.settings.theme || 'dark')
          setThemeMode(
            data.settings.theme === 'light'
              ? 'light'
              : data.settings.theme === 'system'
                ? window.matchMedia('(prefers-color-scheme: dark)').matches
                  ? 'dark'
                  : 'light'
                : 'dark'
          )
        }
      } catch {
        /* keep defaults */
      }
    })()
  }, [user?.id, user?._id])

  // Re-sync Web Push subscription when permission already granted
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const { isPushSupported, subscribeToPush } = await import('../utils/push')
        if (!(await isPushSupported())) return
        if (Notification.permission !== 'granted') return
        if (cancelled) return
        await subscribeToPush()
      } catch (err) {
        console.warn('Push sync skipped:', err?.message || err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id || user?._id])
  
  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        searchUsers()
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setSearchResults([])
    }
  }, [searchQuery])
  
  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const encodedQuery = encodeURIComponent(searchQuery.trim())
      const { data } = await api.get(`/users/search?q=${encodedQuery}`)
      setSearchResults(data || [])
    } catch (error) {
      console.error('Error searching users:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }
  
  const planLabel = (result) => {
    const plan = result.membership?.plan
    if (!plan) return null
    return String(plan).charAt(0).toUpperCase() + String(plan).slice(1)
  }

  const SearchResultRow = ({ result, onSelect }) => (
    <Link
      to={`/user/${result._id || result.id}`}
      onClick={onSelect}
      className="flex items-center gap-3 p-3 hover:bg-dark-100 transition-colors border-b border-white/5 last:border-0"
    >
      <Avatar avatar={result.avatar} name={result.name} size="sm" className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{result.name}</div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
          {result.stats?.level != null && (
            <span className="text-primary-400">Nv. {result.stats.level}</span>
          )}
          {planLabel(result) && (
            <span className="px-1.5 py-0.5 rounded bg-dark-300 text-gray-300">
              {planLabel(result)}
            </span>
          )}
          <span className="truncate">{result.username ? `@${result.username}` : result.name}</span>
        </div>
      </div>
    </Link>
  )
  
  return (
    <StoryViewerProvider>
    <PresenceManager />
    <div className="min-h-screen bg-dark-500">
      {/* Header — keep under tutorial overlay (z-200) so tip text never hides behind the avatar menu */}
      <header className="chat-app-bar glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {canGoBack && (
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-200 transition-colors flex-shrink-0"
              >
                <FiArrowLeft size={20} />
              </button>
            )}
            <NavLink to="/dashboard" className="flex items-center gap-2 flex-shrink-0">
              <QyntraLogo size="sm" rounded="lg" />
              <span className="font-display text-xl tracking-wider hidden sm:block">QYNTRA</span>
            </NavLink>

            {/* Desktop primary nav (also used as tutorial targets when bottom nav is hidden) */}
            <nav className="ml-2 hidden items-center gap-0.5 md:flex" aria-label="Navegación principal">
              {navItems.map((item) => (
                <NavLink
                  key={`desk-${item.path}`}
                  to={item.path}
                  data-tour={item.tour}
                  onMouseEnter={() => prefetchRoute(item.path)}
                  onFocus={() => prefetchRoute(item.path)}
                  onTouchStart={() => prefetchRoute(item.path)}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-[rgba(var(--color-primary-rgb),0.14)] text-primary-500'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <item.icon size={16} />
                  <span className="hidden lg:inline">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md hidden md:block">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSearch(true)}
                  placeholder="Buscar por nombre o @username…"
                  className="w-full pl-10 pr-4 py-2 bg-dark-200 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSearchResults([])
                      setShowSearch(false)
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <FiX size={18} />
                  </button>
                )}
              </div>
              
              {/* Search Results Dropdown */}
              <AnimatePresence>
                {showSearch && (searchQuery.trim() || searchResults.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="chat-escape-panel absolute top-full left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] shadow-xl"
                    onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                  >
                    {searching ? (
                      <div className="p-4 text-center">
                        <div className="w-5 h-5 border-2 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
                      </div>
                    ) : searchResults.length === 0 && searchQuery.trim() ? (
                      <div className="p-4 text-center text-gray-400 text-sm">
                        No se encontraron usuarios
                      </div>
                    ) : (
                      searchResults.map((result) => (
                        <SearchResultRow
                          key={result._id || result.id}
                          result={result}
                          onSelect={() => {
                            setSearchQuery('')
                            setSearchResults([])
                            setShowSearch(false)
                          }}
                        />
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="flex items-center gap-0.5 sm:gap-2 flex-shrink-0">
            {/* Mobile Search Button */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
              aria-label="Buscar"
            >
              <FiSearch size={20} />
            </button>
            
            {headerIcons.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                data-tour={item.tour || undefined}
                onMouseEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                onTouchStart={() => prefetchRoute(item.path)}
                className={({ isActive }) =>
                  `p-1.5 sm:p-2 rounded-lg transition-colors relative ${
                    isActive ? 'text-primary-500' : 'text-gray-400 hover:text-white'
                  } ${item.path === '/settings' ? 'hidden sm:inline-flex' : ''}`
                }
              >
                <item.icon size={20} />
                {item.path === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-0.5 bg-primary-500 rounded-full text-[10px] flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </NavLink>
            ))}
            
            <div className="relative flex items-center gap-1.5 sm:gap-3 ml-1 sm:ml-2 pl-1.5 sm:pl-2 border-l border-white/10" ref={avatarMenuRef}>
              <button
                type="button"
                data-tour="nav-avatar"
                onClick={() => setAvatarMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg p-0.5 transition hover:bg-white/5"
                aria-label="Menú de cuenta"
                aria-expanded={avatarMenuOpen}
              >
                <div className="relative">
                  <Avatar avatar={user?.avatar} name={user?.name} size="sm" />
                  <PresenceDot userId={user?.id || user?._id} size="sm" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary-500 rounded-full sm:hidden" />
                  )}
                </div>
                <span className="hidden md:block text-sm">{user?.name}</span>
              </button>

              <AnimatePresence>
                {avatarMenuOpen &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <motion.div
                      ref={avatarMenuPanelRef}
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      data-tour="tour-avatar-menu-panel"
                      className="chat-escape-panel fixed z-[80] w-64 overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] shadow-2xl"
                      style={{
                        top: avatarMenuRef.current
                          ? avatarMenuRef.current.getBoundingClientRect().bottom + 8
                          : 56,
                        right: avatarMenuRef.current
                          ? Math.max(12, window.innerWidth - avatarMenuRef.current.getBoundingClientRect().right)
                          : 12
                      }}
                    >
                    <div className="px-4 py-3 border-b border-[color:var(--border-subtle)]">
                      <p className="font-semibold text-sm truncate text-[color:var(--text-primary)]">{user?.name}</p>
                      <p className="text-xs text-[color:var(--text-muted)] truncate">
                        {user?.username ? `@${user.username}` : user?.email}
                      </p>
                    </div>
                    <div className="p-1.5">
                      <button
                        type="button"
                        data-tour="menu-profile"
                        onClick={() => {
                          setAvatarMenuOpen(false)
                          navigate('/profile')
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)] transition"
                      >
                        <FiUser size={16} className="text-primary-500" />
                        Ver perfil
                      </button>
                      <button
                        type="button"
                        data-tour="menu-settings"
                        onClick={() => {
                          setAvatarMenuOpen(false)
                          navigate('/settings')
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)] transition"
                      >
                        <FiSettings size={16} className="text-accent-cyan" />
                        Configuración
                      </button>
                      <button
                        type="button"
                        data-tour="menu-invite"
                        onClick={() => {
                          setAvatarMenuOpen(false)
                          setInviteOpen(true)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)] transition"
                      >
                        <FiUserPlus size={16} className="text-accent-yellow" />
                        Invitar a amigos
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarMenuOpen(false)
                          openTutorialHub()
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)] transition"
                      >
                        <FiBookOpen size={16} className="text-accent-cyan" />
                        Tutoriales de la app
                      </button>

                      <div
                        data-tour="menu-theme"
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[color:var(--text-primary)]"
                      >
                        <span className="flex items-center gap-3 text-sm">
                          {themeMode === 'light' ? (
                            <FiSun size={16} className="text-accent-yellow" />
                          ) : (
                            <FiMoon size={16} className="text-accent-purple" />
                          )}
                          Tema {themeMode === 'light' ? 'claro' : 'oscuro'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={themeMode === 'dark'}
                          onClick={toggleTheme}
                          className={`relative h-7 w-12 rounded-full transition-colors ${
                            themeMode === 'dark' ? 'bg-primary-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform ${
                              themeMode === 'dark' ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          >
                            {themeMode === 'dark' ? (
                              <FiMoon size={12} className="text-primary-500" />
                            ) : (
                              <FiSun size={12} className="text-amber-500" />
                            )}
                          </span>
                        </button>
                      </div>

                      <button
                        type="button"
                        data-tour="menu-logout"
                        onClick={async () => {
                          setAvatarMenuOpen(false)
                          await logout()
                          navigate('/', { replace: true })
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition"
                      >
                        <FiLogOut size={16} />
                        Cerrar sesión
                      </button>
                    </div>
                    </motion.div>,
                    document.body
                  )}
              </AnimatePresence>

              {user?.role === 'admin' && (
                <NavLink to="/admin" className="hidden sm:inline-flex px-2 py-1 bg-accent-purple/20 text-accent-purple text-xs rounded-full">Admin</NavLink>
              )}
              <button
                onClick={async () => {
                  await logout()
                  navigate('/', { replace: true })
                }}
                className="hidden sm:inline-flex p-1.5 sm:p-2 text-gray-400 hover:text-red-500"
                aria-label="Cerrar sesión"
              >
                <FiLogOut size={18} />
              </button>
            </div>
          </div>        </div>
        
        {/* Mobile Search Bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-3"
            >
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o @username…"
                  className="w-full pl-10 pr-10 py-2 bg-dark-200 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSearchResults([])
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <FiX size={18} />
                  </button>
                )}
              </div>
              {searchQuery.trim() && (
                <div className="mt-2 bg-dark-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {searching ? (
                    <div className="p-4 text-center">
                      <div className="w-5 h-5 border-2 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">
                      No se encontraron usuarios
                    </div>
                  ) : (
                    searchResults.map((result) => (
                      <SearchResultRow
                        key={result._id || result.id}
                        result={result}
                        onSelect={() => {
                          setSearchQuery('')
                          setSearchResults([])
                          setShowSearch(false)
                        }}
                      />
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      
      {/* Main Content */}
      <main
        className={`overflow-x-hidden pt-16 ${
          chatThreadOpen ? 'pb-0 md:pb-6' : 'pb-24 md:pb-6'
        }`}
      >
        <div
          className={
            chatThreadOpen
              ? 'mx-auto max-w-7xl px-0 py-0 md:px-4 md:py-6'
              : 'mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6'
          }
        >
          <Outlet />
        </div>
      </main>
      
      {/* Bottom Navigation (Mobile) — hide while a chat thread is open */}
      <nav
        className={`glass fixed bottom-0 left-0 right-0 z-50 px-2 py-2 md:hidden ${
          chatThreadOpen ? 'pointer-events-none invisible translate-y-full' : ''
        }`}
      >
        <div className="flex justify-around">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-tour={item.tour}
                onMouseEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                onTouchStart={() => prefetchRoute(item.path)}
                className={`flex flex-col items-center p-2 rounded-lg transition-colors ${isActive ? 'text-primary-500' : 'text-gray-500'}`}
              >
                <item.icon size={20} />
                <span className="text-xs mt-1">{item.label}</span>
                {isActive && document.body.dataset.qyntraTutorial !== '1' && (
                  <motion.div layoutId="nav-indicator" className="absolute bottom-0 w-1 h-1 bg-primary-500 rounded-full" />
                )}
                {isActive && document.body.dataset.qyntraTutorial === '1' && (
                  <div className="absolute bottom-0 w-1 h-1 rounded-full bg-primary-500" />
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
      
      {/* Notification Prompt */}
      <NotificationPrompt />
      <InviteFriendsModal open={inviteOpen} onClose={() => setInviteOpen(false)} user={user} />
      <UsernameSetupModal open={Boolean(user && !user.username)} />
      <AppTutorial />
      <TutorialHub />
      <NewTutorialPrompt />
      <MembershipExpiryNotice />
    </div>
    </StoryViewerProvider>
  )
}
