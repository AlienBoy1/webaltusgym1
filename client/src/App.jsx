import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useEffect } from 'react'
import UpdateCenter from './components/UpdateCenter'

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
  const { refreshUser, isAuthenticated } = useAuthStore()
  
  useEffect(() => {
    if (isAuthenticated) {
      refreshUser()
    }
  }, [isAuthenticated])

  // Recovery links sometimes land on /#access_token=...&type=recovery — send to reset UI
  useEffect(() => {
    const hash = window.location.hash || ''
    if (!hash.includes('type=recovery') && !hash.includes('type%3Drecovery')) return
    if (window.location.pathname === '/reset-password') return
    window.location.replace(`/reset-password${hash}`)
  }, [])
  
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
      <PushNavigationBridge />

      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* User Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
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
      </Routes>
    </BrowserRouter>
  )
}

export default App
