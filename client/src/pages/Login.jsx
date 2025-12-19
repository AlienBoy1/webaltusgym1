import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiMail, FiLock, FiLogIn, FiX, FiKey } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import api from '../utils/api'
import toast from 'react-hot-toast'
import TermsModal from '../components/TermsModal'
import CodeAccessModal from '../components/CodeAccessModal'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showRequestAccess, setShowRequestAccess] = useState(false)
  const [requestEmail, setRequestEmail] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showCodeAccess, setShowCodeAccess] = useState(false)
  const { login, loading } = useAuthStore()
  const navigate = useNavigate()
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error('Completa todos los campos')
      return
    }
    
    const result = await login(email, password)
    
    if (result.success) {
      toast.success('¡Bienvenido!')
      navigate('/dashboard')
    } else {
      toast.error(result.message)
    }
  }
  
  const handleRequestAccess = async () => {
    if (!requestEmail.trim()) {
      toast.error('Por favor ingresa tu correo')
      return
    }
    
    setRequesting(true)
    try {
      await api.post('/auth/request-access', { email: requestEmail })
      setShowRequestAccess(false)
      setShowTerms(true)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al enviar solicitud')
    } finally {
      setRequesting(false)
    }
  }
  
  const handleAcceptTerms = () => {
    setShowTerms(false)
    toast.success('Solicitud enviada. Completa tu proceso de suscripción con tu administrador de Altus Gym para obtener tu código de acceso y continuar con tu registro en nuestra app', {
      duration: 6000
    })
    setRequestEmail('')
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-400 via-dark-300 to-dark-400 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl mb-2">
            <span className="text-primary-500">ALTUS</span> GYM
          </h1>
          <p className="text-gray-400">Eleva tu potencial</p>
        </div>
        
        {/* Card */}
        <div className="glass rounded-3xl p-8">
          <h2 className="font-display text-2xl text-center mb-6">Iniciar Sesión</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-12"
                  placeholder="tu@email.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Contraseña</label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-12"
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-400">
                <input type="checkbox" className="rounded bg-dark-200 border-dark-100" />
                Recordarme
              </label>
              <Link to="/forgot-password" className="text-primary-500 hover:text-primary-400">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FiLogIn /> Iniciar Sesión
                </>
              )}
            </button>
          </form>
          
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowCodeAccess(true)}
              className="w-full btn-secondary flex items-center justify-center gap-2"
            >
              <FiKey size={18} />
              Tengo una clave de acceso
            </button>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-gray-400 mb-2">
              ¿No tienes cuenta?
            </p>
            <button
              type="button"
              onClick={() => setShowRequestAccess(true)}
              className="text-primary-500 hover:text-primary-400 font-medium"
            >
              Solicitar acceso
            </button>
          </div>
        </div>
        
        {/* Back to home */}
        <div className="mt-6 text-center">
          <Link to="/" className="text-gray-500 hover:text-white text-sm">
            ← Volver al inicio
          </Link>
        </div>
      </motion.div>
      
      {/* Request Access Modal */}
      <AnimatePresence>
        {showRequestAccess && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl">Solicitar Acceso</h2>
                <button
                  onClick={() => {
                    setShowRequestAccess(false)
                    setRequestEmail('')
                  }}
                  className="p-2 hover:bg-dark-200 rounded-lg"
                >
                  <FiX size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Correo Electrónico</label>
                  <input
                    type="email"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    className="input-field w-full"
                    placeholder="tu@email.com"
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRequestAccess(false)
                      setRequestEmail('')
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRequestAccess}
                    disabled={requesting || !requestEmail.trim()}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {requesting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Continuar'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Terms Modal */}
      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={handleAcceptTerms}
      />
      
      {/* Code Access Modal */}
      <CodeAccessModal
        isOpen={showCodeAccess}
        onClose={() => setShowCodeAccess(false)}
        onSuccess={() => {
          setShowCodeAccess(false)
          navigate('/dashboard')
        }}
      />
    </div>
  )
}
