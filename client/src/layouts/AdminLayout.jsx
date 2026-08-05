import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiGrid, FiUsers, FiCreditCard, FiFileText, FiSettings, FiArrowLeft, FiClock, FiMenu, FiX, FiCalendar } from 'react-icons/fi'
import QyntraLogo from '../components/QyntraLogo'

const sidebarItems = [
  { path: '/admin', icon: FiGrid, label: 'Dashboard', exact: true },
  { path: '/admin/users', icon: FiUsers, label: 'Usuarios' },
  { path: '/admin/classes', icon: FiCalendar, label: 'Clases' },
  { path: '/admin/memberships', icon: FiCreditCard, label: 'Membresías' },
  { path: '/admin/attendance', icon: FiClock, label: 'Asistencias' },
  { path: '/admin/reports', icon: FiFileText, label: 'Reportes' },
  { path: '/admin/settings', icon: FiSettings, label: 'Configuración' },
]

function NavItems({ onNavigate, compact = false }) {
  const location = useLocation()

  return sidebarItems.map((item) => {
    const isActive = item.exact
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path)
    const Icon = item.icon

    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-xl transition-all ${
          compact ? 'flex-col gap-1 px-2 py-2 min-w-0 flex-1' : 'px-4 py-3 mb-2'
        } ${
          isActive
            ? 'bg-[rgba(var(--color-primary-rgb),0.12)] text-[color:var(--color-primary)]'
            : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] hover:text-[color:var(--text-primary)]'
        }`}
      >
        <Icon size={compact ? 18 : 20} />
        <span className={`font-medium ${compact ? 'text-[10px] leading-tight text-center truncate w-full' : ''}`}>
          {item.label}
        </span>
        {!compact && isActive && (
          <motion.div
            layoutId="admin-indicator"
            className="ml-auto h-1.5 w-1.5 rounded-full bg-[color:var(--color-primary)]"
          />
        )}
      </NavLink>
    )
  })
}

export default function AdminLayout() {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-app flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed left-0 top-0 bottom-0 border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] z-40">
        <div className="p-6 border-b border-[color:var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <QyntraLogo size="md" />
            <div>
              <span className="font-display text-xl tracking-wider">QYNTRA</span>
              <span className="text-xs text-[color:var(--color-primary)] block">ADMIN PANEL</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-6 px-4 overflow-y-auto">
          <NavItems />
        </nav>

        <div className="p-4 border-t border-[color:var(--border-subtle)]">
          <NavLink
            to="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] hover:text-[color:var(--text-primary)] transition-all"
          >
            <FiArrowLeft size={20} />
            <span>Volver a la App</span>
          </NavLink>
        </div>
      </aside>

      {/* Tablet/mobile top bar */}
      <header className="lg:hidden glass fixed top-0 left-0 right-0 z-50 px-4 py-3 safe-top">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-xl text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]"
              aria-label="Abrir menú"
            >
              <FiMenu size={20} />
            </button>
            <NavLink to="/dashboard" className="p-2 text-[color:var(--text-secondary)]" aria-label="Volver">
              <FiArrowLeft size={18} />
            </NavLink>
            <span className="font-display text-xl tracking-wider truncate">ADMIN</span>
          </div>
          <QyntraLogo size="sm" />
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar menú"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-[60] bg-black/55"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-[70] w-[min(18rem,86vw)] bg-[color:var(--bg-elevated)] border-r border-[color:var(--border-subtle)] flex flex-col"
            >
              <div className="p-5 border-b border-[color:var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <QyntraLogo size="md" />
                  <span className="font-display text-xl">ADMIN</span>
                </div>
                <button type="button" onClick={() => setDrawerOpen(false)} className="p-2 text-[color:var(--text-secondary)]">
                  <FiX size={20} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-4">
                <NavItems onNavigate={() => setDrawerOpen(false)} />
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 pb-24 lg:pb-0 min-w-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="min-w-0"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>

      {/* Mobile bottom nav — scrollable labels */}
      <nav className="lg:hidden glass fixed bottom-0 left-0 right-0 z-50 px-1 py-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-between gap-0.5 overflow-x-auto scrollbar-hide">
          <NavItems compact />
        </div>
      </nav>
    </div>
  )
}
