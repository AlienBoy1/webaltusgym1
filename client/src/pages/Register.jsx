import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiUser, FiMail, FiLock, FiUserPlus, FiCheck } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isFirstUser, setIsFirstUser] = useState(false)
  const { register, loading } = useAuthStore()
  const navigate = useNavigate()
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!name || !email || !password || !confirmPassword) {
      toast.error('Completa todos los campos')
      return
    }
    
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    
    const result = await register(name, email, password)
    
    if (result.success) {
      if (result.isFirstUser) {
        setIsFirstUser(true)
        // Confetti explosion
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FF6B35', '#00F5FF', '#A855F7', '#22C55E']
        })
        setTimeout(() => {
          confetti({
            particleCount: 50,
            spread: 100,
            origin: { y: 0.5 }
          })
        }, 250)
      } else {
        toast.success('¡Cuenta creada exitosamente!')
        navigate('/dashboard')
      }
    } else {
      toast.error(result.message)
    }
  }
  
  const goToDashboard = () => {
    navigate('/admin')
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
          <p className="text-gray-400">Únete a la comunidad</p>
        </div>
        
        {/* Card */}
        <div className="glass rounded-3xl p-8">
          <AnimatePresence mode="wait">
            {isFirstUser ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
              >
                <div className="w-20 h-20 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FiCheck className="text-accent-green" size={40} />
                </div>
                <h2 className="font-display text-2xl mb-4">🎉 ¡Felicidades!</h2>
                <p className="text-gray-300 mb-2">
                  Eres el <span className="text-primary-500 font-bold">primer usuario</span> de ALTUS GYM
                </p>
                <p className="text-gray-400 mb-6">
                  Has sido asignado como <span className="text-accent-purple font-semibold">Administrador</span> con acceso completo al sistema
                </p>
                
                <div className="bg-dark-300/50 rounded-xl p-4 mb-6 text-left">
                  <h3 className="text-sm text-gray-400 mb-2">Tus beneficios:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2 text-accent-green">
                      <FiCheck size={16} /> Membresía Elite gratis por 1 año
                    </li>
                    <li className="flex items-center gap-2 text-accent-green">
                      <FiCheck size={16} /> Acceso al panel de administración
                    </li>
                    <li className="flex items-center gap-2 text-accent-green">
                      <FiCheck size={16} /> Control total de usuarios y membresías
                    </li>
                  </ul>
                </div>
                
                <button onClick={goToDashboard} className="btn-primary w-full">
                  Ir al Panel de Admin
                </button>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2 className="font-display text-2xl text-center mb-6">Crear Cuenta</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Nombre</label>
                    <div className="relative">
                      <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-field pl-12"
                        placeholder="Tu nombre"
                      />
                    </div>
                  </div>
                  
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
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Confirmar Contraseña</label>
                    <div className="relative">
                      <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-field pl-12"
                        placeholder="••••••••"
                      />
                    </div>
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
                        <FiUserPlus /> Crear Cuenta
                      </>
                    )}
                  </button>
                </form>
                
                <div className="mt-6 text-center">
                  <p className="text-gray-400">
                    ¿Ya tienes cuenta?{' '}
                    <Link to="/login" className="text-primary-500 hover:text-primary-400 font-medium">
                      Inicia sesión
                    </Link>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Back to home */}
        {!isFirstUser && (
          <div className="mt-6 text-center">
            <Link to="/" className="text-gray-500 hover:text-white text-sm">
              ← Volver al inicio
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  )
}
