import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiGrid, FiUsers, FiCreditCard, FiFileText, FiSettings, FiArrowLeft, FiClock } from 'react-icons/fi'

const sidebarItems = [
  { path: '/admin', icon: FiGrid, label: 'Dashboard', exact: true },
  { path: '/admin/users', icon: FiUsers, label: 'Usuarios' },
  { path: '/admin/memberships', icon: FiCreditCard, label: 'Membresías' },
  { path: '/admin/attendance', icon: FiClock, label: 'Asistencias' },
  { path: '/admin/reports', icon: FiFileText, label: 'Reportes' },
  { path: '/admin/settings', icon: FiSettings, label: 'Configuración' },
]

export default function AdminLayout() {
  const location = useLocation()
  
  return (
    <div className="min-h-screen bg-dark-500 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-dark-300 flex-col fixed left-0 top-0 bottom-0 border-r border-white/5">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <span className="font-display text-xl">A</span>
            </div>
            <div>
              <span className="font-display text-xl tracking-wider">ALTUS</span>
              <span className="text-xs text-primary-500 block">ADMIN PANEL</span>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 py-6 px-4">
          {sidebarItems.map((item) => {
            const isActive = item.exact 
              ? location.pathname === item.path 
              : location.pathname.startsWith(item.path)
            const Icon = item.icon
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-2 transition-all ${
                  isActive 
                    ? 'bg-primary-500/10 text-primary-500' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="admin-indicator"
                    className="ml-auto w-1.5 h-1.5 bg-primary-500 rounded-full"
                  />
                )}
              </NavLink>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-white/5">
          <NavLink
            to="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all"
          >
            <FiArrowLeft size={20} />
            <span>Volver a la App</span>
          </NavLink>
        </div>
      </aside>
      
      {/* Mobile Header */}
      <header className="md:hidden glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NavLink to="/dashboard" className="p-2 text-gray-400">
              <FiArrowLeft size={20} />
            </NavLink>
            <span className="font-display text-xl">ADMIN</span>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        <div className="p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
      
      {/* Mobile Bottom Nav */}
      <nav className="md:hidden glass fixed bottom-0 left-0 right-0 z-50 px-2 py-2">
        <div className="flex justify-around">
          {sidebarItems.map((item) => {
            const isActive = item.exact 
              ? location.pathname === item.path 
              : location.pathname.startsWith(item.path)
            const Icon = item.icon
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center p-2 rounded-lg ${
                  isActive ? 'text-primary-500' : 'text-gray-500'
                }`}
              >
                <Icon size={20} />
                <span className="text-xs mt-1">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

