import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiUser, FiMail, FiLock, FiUserPlus, FiCheck } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'
import AuthShell, { AuthLabel } from '../components/AuthShell'

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

  return (
    <AuthShell
      title={isFirstUser ? '¡Bienvenido!' : 'Crear cuenta'}
      subtitle={
        isFirstUser
          ? 'Tu acceso de administrador está listo.'
          : 'Únete a la comunidad y empieza a medir tu progreso.'
      }
      panelHeadline="ÚNETE AL SISTEMA"
      showBackHome={!isFirstUser}
    >
      <AnimatePresence mode="wait">
        {isFirstUser ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: 'rgba(34, 197, 94, 0.15)' }}
            >
              <FiCheck style={{ color: '#22C55E' }} size={40} />
            </div>
            <h2 className="font-display mb-3 text-2xl tracking-wide">Felicidades</h2>
            <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>
              Eres el <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>primer usuario</span> de
              QYNTRA GYM
            </p>
            <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
              Has sido asignado como{' '}
              <span className="font-semibold" style={{ color: '#A855F7' }}>
                Administrador
              </span>{' '}
              con acceso completo al sistema
            </p>

            <div
              className="mb-6 rounded-xl p-4 text-left"
              style={{ background: 'var(--bg-muted)' }}
            >
              <h3 className="mb-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                Tus beneficios:
              </h3>
              <ul className="space-y-2 text-sm">
                {[
                  'Membresía Elite gratis por 1 año',
                  'Acceso al panel de administración',
                  'Control total de usuarios y membresías'
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2" style={{ color: '#22C55E' }}>
                    <FiCheck size={16} /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <button type="button" onClick={() => navigate('/admin')} className="btn-primary w-full">
              Ir al Panel de Admin
            </button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <AuthLabel>Nombre</AuthLabel>
                <div className="relative">
                  <FiUser
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field pl-12"
                    placeholder="Tu nombre"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div>
                <AuthLabel>Email</AuthLabel>
                <div className="relative">
                  <FiMail
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-12"
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <AuthLabel>Contraseña</AuthLabel>
                <div className="relative">
                  <FiLock
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-12"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div>
                <AuthLabel>Confirmar contraseña</AuthLabel>
                <div className="relative">
                  <FiLock
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field pl-12"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex w-full items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black/80" />
                ) : (
                  <>
                    <FiUserPlus /> Crear cuenta
                  </>
                )}
              </button>
            </form>

            <div className="auth-readable-secondary mt-6 text-center text-sm">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="font-medium" style={{ color: 'var(--color-primary)' }}>
                Inicia sesión
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}
