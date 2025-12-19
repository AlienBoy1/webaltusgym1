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
  const { unreadCount, fetchNotifications } = useNotificationStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [searching, setSearching] = useState(false)
  
  const isDashboard = location.pathname === '/dashboard'
  const canGoBack = !isDashboard && location.pathname !== '/'
  
  useEffect(() => { 
    fetchNotifications()
    if (user?._id) {
      initSocket(user._id)
    }
    return () => disconnectSocket()
  }, [user])
  
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
  
  const getAvatarDisplay = (user) => {
    if (user?.avatar) {
      if (user.avatar.startsWith('data:') || user.avatar.startsWith('http')) {
        return <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
      }
      return user.avatar
    }
    return user?.name?.charAt(0) || '👤'
  }
  
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
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <span className="font-display text-lg">A</span>
              </div>
              <span className="font-display text-xl tracking-wider hidden sm:block">ALTUS</span>
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
                        <Link
                          key={result._id}
                          to={`/user/${result._id}`}
                          onClick={() => {
                            setSearchQuery('')
                            setSearchResults([])
                            setShowSearch(false)
                          }}
                          className="flex items-center gap-3 p-3 hover:bg-dark-100 transition-colors border-b border-white/5 last:border-0"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-primary-500 font-medium overflow-hidden flex-shrink-0">
                            {getAvatarDisplay(result)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{result.name}</div>
                            <div className="text-sm text-gray-400 truncate">{result.email}</div>
                          </div>
                        </Link>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mobile Search Button */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <FiSearch size={20} />
            </button>
            
            {headerIcons.map((item) => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => `p-2 rounded-lg transition-colors relative ${isActive ? 'text-primary-500' : 'text-gray-400 hover:text-white'}`}>
                <item.icon size={20} />
                {item.path === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full text-xs flex items-center justify-center">{unreadCount}</span>
                )}
              </NavLink>
            ))}
            
            <div className="flex items-center gap-3 ml-2 pl-2 border-l border-white/10">
              <NavLink to="/profile" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-primary-500 font-medium overflow-hidden">
                  {user?.avatar && (user.avatar.startsWith('data:') || user.avatar.startsWith('http')) ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    user?.name?.charAt(0) || 'U'
                  )}
                </div>
                <span className="hidden md:block text-sm">{user?.name}</span>
              </NavLink>
              {user?.role === 'admin' && (
                <NavLink to="/admin" className="px-2 py-1 bg-accent-purple/20 text-accent-purple text-xs rounded-full">Admin</NavLink>
              )}
              <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500"><FiLogOut size={18} /></button>
            </div>
          </div>
        </div>
        
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
                      <Link
                        key={result._id}
                        to={`/user/${result._id}`}
                        onClick={() => {
                          setSearchQuery('')
                          setSearchResults([])
                          setShowSearch(false)
                        }}
                        className="flex items-center gap-3 p-3 hover:bg-dark-100 transition-colors border-b border-white/5 last:border-0"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-primary-500 font-medium overflow-hidden flex-shrink-0">
                          {getAvatarDisplay(result)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{result.name}</div>
                          <div className="text-sm text-gray-400 truncate">{result.email}</div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      
      {/* Main Content */}
      <main className="pt-16 pb-20 md:pb-6">
        <div className="max-w-7xl mx-auto px-4 py-6">
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
