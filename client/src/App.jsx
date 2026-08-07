import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useEffect, lazy, Suspense } from 'react'
import UpdateCenter from './components/UpdateCenter'
import AppToaster from './components/AppToaster'
import InstallAppPrompt from './components/InstallAppPrompt'
import WorkoutFloatingPanel from './components/WorkoutFloatingPanel'
import WorkoutSessionManager from './components/WorkoutSessionManager'
import SessionTheater from './components/SessionTheater'
import { installRuntimeIntegrityGuards } from './utils/runtimeIntegrity'

// Layouts (keep eager — shell of the app)
import MainLayout from './layouts/MainLayout'
import AdminLayout from './layouts/AdminLayout'

// Public — eager for first paint
import HomeEntry from './pages/HomeEntry'
import Login from './pages/Login'

const Register = lazy(() => import('./pages/Register'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

// User pages — code-split for faster navigation
const Dashboard = lazy(() => import('./pages/user/Dashboard'))
const Social = lazy(() => import('./pages/user/Social'))
const Workouts = lazy(() => import('./pages/user/Workouts'))
const MyWorkouts = lazy(() => import('./pages/user/MyWorkouts'))
const MyChallenges = lazy(() => import('./pages/user/MyChallenges'))
const Progress = lazy(() => import('./pages/user/Progress'))
const Profile = lazy(() => import('./pages/user/Profile'))
const UserProfile = lazy(() => import('./pages/user/UserProfile'))
const Notifications = lazy(() => import('./pages/user/Notifications'))
const UserSettings = lazy(() => import('./pages/user/Settings'))
const Classes = lazy(() => import('./pages/user/Classes'))
const Challenges = lazy(() => import('./pages/user/Challenges'))
const Chat = lazy(() => import('./pages/user/Chat'))
const ExploreRoutines = lazy(() => import('./pages/user/ExploreRoutines'))

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const Users = lazy(() => import('./pages/admin/Users'))
const AdminClasses = lazy(() => import('./pages/admin/Classes'))
const Memberships = lazy(() => import('./pages/admin/Memberships'))
const Attendance = lazy(() => import('./pages/admin/Attendance'))
const Reports = lazy(() => import('./pages/admin/Reports'))
const Settings = lazy(() => import('./pages/admin/Settings'))

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border-subtle)]"
        style={{ borderTopColor: 'var(--color-primary)' }}
      />
    </div>
  )
}

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    // Don't bounce marketing `/` into an endless login?redirect=/ loop
    if (location.pathname === '/' || location.pathname === '') {
      return <Navigate to="/login" replace />
    }
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  // Avoid blank MainLayout crash while session user is still restoring
  if (!user) {
    return <PageFallback />
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function PushNavigationBridge() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    const pending = sessionStorage.getItem('pendingPushNav')
    if (pending && isAuthenticated) {
      sessionStorage.removeItem('pendingPushNav')
      navigate(pending)
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.type === 'CHAT_DELIVERED_ACK' && event.data.fromUserId && isAuthenticated) {
        import('./utils/api')
          .then(({ default: api }) => api.post(`/chat/delivered/${event.data.fromUserId}`))
          .catch(() => {})
        return
      }
      if (event.data?.type !== 'NOTIFICATION_CLICK') return
      const url = event.data.url || '/notifications'
      if (isAuthenticated) {
        navigate(url)
      } else {
        sessionStorage.setItem('pendingPushNav', url)
        navigate(`/login?redirect=${encodeURIComponent(url)}`)
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [navigate, isAuthenticated])

  return null
}

function App() {
  const { checkAuth, initializing, loading, authIntent } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => installRuntimeIntegrityGuards(), [])

  useEffect(() => {
    const hash = window.location.hash || ''
    if (!hash.includes('type=recovery') && !hash.includes('type%3Drecovery')) return
    if (window.location.pathname === '/reset-password') return
    window.location.replace(`/reset-password${hash}`)
  }, [])

  if (initializing) {
    return (
      <SessionTheater
        visible
        variant="boot"
        title="QYNTRA"
        subtitle="Verificando tu sesión…"
      />
    )
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppToaster />

      <UpdateCenter />
      <InstallAppPrompt />
      <WorkoutSessionManager />
      <WorkoutFloatingPanel />
      <PushNavigationBridge />

      <SessionTheater
        visible={loading && !initializing}
        variant={authIntent === 'logout' ? 'logout' : 'auth'}
        title={authIntent === 'logout' ? 'HASTA PRONTO' : 'QYNTRA'}
        subtitle={
          authIntent === 'logout' ? 'Cerrando tu sesión con seguridad' : 'Entrando a tu cuenta'
        }
      />

      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<HomeEntry />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* IMPORTANT: no `index` here — it stole `/` from the landing and forced login?redirect=/ */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="social" element={<Social />} />
            <Route path="workouts" element={<Workouts />} />
            <Route path="explore-routines" element={<ExploreRoutines />} />
            <Route path="my-workouts" element={<MyWorkouts />} />
            <Route path="my-challenges" element={<MyChallenges />} />
            <Route path="progress" element={<Progress />} />
            <Route path="profile" element={<Profile />} />
            <Route path="user/:id" element={<UserProfile />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<UserSettings />} />
            <Route path="classes" element={<Classes />} />
            <Route path="challenges" element={<Challenges />} />
            <Route path="chat" element={<Chat />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="classes" element={<AdminClasses />} />
            <Route path="memberships" element={<Memberships />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
