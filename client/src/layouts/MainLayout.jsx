import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiHome, FiUsers, FiActivity, FiTrendingUp, FiUser, FiBell, FiSettings, FiCalendar, FiTarget, FiMessageCircle, FiLogOut, FiArrowLeft, FiSearch, FiX } from 'react-icons/fi'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import NotificationPrompt from '../components/NotificationPrompt'
import { initSocket, disconnectSocket } from '../utils/socket'
import api from '../utils/api'
import { Link } from 'react-router-dom'
import QyntraLogo from '../components/QyntraLogo'
import { Avatar } from '../utils/avatarUtils'

const navItems = [
  { path: '/dashboard', icon: FiHome, label: 'Inicio' },
  { path: '/social', icon: FiUsers, label: 'Social' },
  { path: '/workouts', icon: FiActivity, label: 'Entrenos' },
  { path: '/progress', icon: FiTrendingUp, label: 'Progreso' },
  { path: '/profile', icon: FiUser, label: 'Perfil' },
]

const headerIcons = [
  { path: '/classes', icon: FiCalendar },
  { path: '/challenges', icon: FiTarget },
  { path: '/chat', icon: FiMessageCircle },
  { path: '/settings', icon: FiSettings },
  { path: '/notifications', icon: FiBell },
]

export default function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { unreadCount, fetchNotifications, subscribeRealtime, unsubscribeRealtime } = useNotificationStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [searching, setSearching] = useState(false)
  
  const isDashboard = location.pathname === '/dashboard'
  const canGoBack = !isDashboard && location.pathname !== '/'
  
  useEffect(() => { 
    fetchNotifications()
    const id = user?.id || user?._id
    if (id) {
      initSocket(id)
      subscribeRealtime(id)
    }
    return () => {
      disconnectSocket()
      unsubscribeRealtime()
    }
  }, [user])

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
          <span className="truncate">{result.email}</span>
        </div>
      </div>
    </Link>
  )
  
  return (
    <div className="min-h-screen bg-dark-500">
      {/* Header */}
      <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
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
            
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md hidden md:block">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSearch(true)}
                  placeholder="Buscar usuarios..."
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
                    className="absolute top-full left-0 right-0 mt-2 bg-dark-200 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50"
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
            
            <div className="flex items-center gap-1.5 sm:gap-3 ml-1 sm:ml-2 pl-1.5 sm:pl-2 border-l border-white/10">
              <NavLink to="/profile" className="flex items-center gap-2">
                <div className="relative">
                  <Avatar avatar={user?.avatar} name={user?.name} size="sm" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary-500 rounded-full sm:hidden" />
                  )}
                </div>
                <span className="hidden md:block text-sm">{user?.name}</span>
              </NavLink>
              {user?.role === 'admin' && (
                <NavLink to="/admin" className="hidden sm:inline-flex px-2 py-1 bg-accent-purple/20 text-accent-purple text-xs rounded-full">Admin</NavLink>
              )}
              <button onClick={logout} className="p-1.5 sm:p-2 text-gray-400 hover:text-red-500" aria-label="Cerrar sesión"><FiLogOut size={18} /></button>
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
                  placeholder="Buscar usuarios..."
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
      <main className="pt-16 pb-24 md:pb-6 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Outlet />
          </motion.div>
        </div>
      </main>
      
      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden glass fixed bottom-0 left-0 right-0 z-50 px-2 py-2">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <NavLink key={item.path} to={item.path} className={`flex flex-col items-center p-2 rounded-lg transition-colors ${isActive ? 'text-primary-500' : 'text-gray-500'}`}>
                <item.icon size={20} />
                <span className="text-xs mt-1">{item.label}</span>
                {isActive && <motion.div layoutId="nav-indicator" className="absolute bottom-0 w-1 h-1 bg-primary-500 rounded-full" />}
              </NavLink>
            )
          })}
        </div>
      </nav>
      
      {/* Notification Prompt */}
      <NotificationPrompt />
    </div>
  )
}
