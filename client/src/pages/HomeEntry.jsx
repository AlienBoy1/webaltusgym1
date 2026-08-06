import { Navigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { isInstalledApp } from '../utils/appMode'
import Landing from './Landing'

/**
 * Web browser → marketing landing.
 * Installed PWA → dashboard if session, otherwise login.
 */
export default function HomeEntry() {
  const { isAuthenticated, initializing } = useAuthStore()

  if (initializing) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border-subtle)]"
          style={{ borderTopColor: 'var(--color-primary)' }}
        />
      </div>
    )
  }

  if (isInstalledApp()) {
    return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
  }

  // Authenticated users on the web can still see landing, with quick enter
  if (isAuthenticated) {
    return (
      <div className="relative">
        <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 px-4 w-full max-w-md">
          <Link
            to="/dashboard"
            className="btn-primary flex w-full items-center justify-center py-3 shadow-2xl"
          >
            Entrar a la app
          </Link>
        </div>
        <Landing />
      </div>
    )
  }

  return <Landing />
}
