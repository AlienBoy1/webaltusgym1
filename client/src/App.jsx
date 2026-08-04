import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useEffect } from 'react'
import UpdateCenter from './components/UpdateCenter'
import WorkoutFloatingPanel from './components/WorkoutFloatingPanel'
import WorkoutSessionManager from './components/WorkoutSessionManager'

// Layouts
import MainLayout from './layouts/MainLayout'
import AdminLayout from './layouts/AdminLayout'

// Public Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

// User Pages
import Dashboard from './pages/user/Dashboard'
import Social from './pages/user/Social'
import Workouts from './pages/user/Workouts'
import Progress from './pages/user/Progress'
import Profile from './pages/user/Profile'
import UserProfile from './pages/user/UserProfile'
import Notifications from './pages/user/Notifications'
import UserSettings from './pages/user/Settings'
import Classes from './pages/user/Classes'
import Challenges from './pages/user/Challenges'
import Chat from './pages/user/Chat'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import Users from './pages/admin/Users'
import Memberships from './pages/admin/Memberships'
import Attendance from './pages/admin/Attendance'
import Reports from './pages/admin/Reports'
import Settings from './pages/admin/Settings'

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()
  
  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
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
  const { checkAuth, initializing } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Recovery links sometimes land on /#access_token=...&type=recovery — send to reset UI
  useEffect(() => {
    const hash = window.location.hash || ''
    if (!hash.includes('type=recovery') && !hash.includes('type%3Drecovery')) return
    if (window.location.pathname === '/reset-password') return
    window.location.replace(`/reset-password${hash}`)
  }, [])

  if (initializing) {
    return (
      <div className="min-h-screen bg-dark-500 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-dark-300/90 p-8 shadow-2xl">
          <div className="w-16 h-16 border-4 border-white/15 border-t-white rounded-full animate-spin" />
          <div className="text-lg font-semibold">Verificando tu sesión...</div>
        </div>
      </div>
    )
  }
  
  return (
    <BrowserRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#14141C',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          },
          success: {
            iconTheme: { primary: '#22C55E', secondary: '#fff' }
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#fff' }
          }
        }}
      />
      
      <UpdateCenter />
      <WorkoutSessionManager />
      <WorkoutFloatingPanel />
      <PushNavigationBridge />

      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* User Routes */}
        <Route element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="social" element={<Social />} />
          <Route path="workouts" element={<Workouts />} />
          <Route path="progress" element={<Progress />} />
          <Route path="profile" element={<Profile />} />
          <Route path="user/:id" element={<UserProfile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<UserSettings />} />
          <Route path="classes" element={<Classes />} />
          <Route path="challenges" element={<Challenges />} />
          <Route path="chat" element={<Chat />} />
        </Route>
        
        {/* Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute adminOnly>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="memberships" element={<Memberships />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
