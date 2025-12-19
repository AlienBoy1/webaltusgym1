import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiKey, FiMail, FiLock, FiCheck } from 'react-icons/fi'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function CodeAccessModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1) // 1: email + code, 2: password
  const [email, setEmail] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [codeValid, setCodeValid] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState(3)
  
  const handleVerifyCode = async () => {
    if (!email.trim() || !accessCode.trim()) {
      toast.error('Completa todos los campos')
      return
    }
    
    setVerifying(true)
    try {
      const { data } = await api.post('/auth/verify-code', { email, accessCode: accessCode.toUpperCase() })
      
      if (data.valid) {
        setCodeValid(true)
        setStep(2)
        toast.success('Código verificado correctamente')
      }
    } catch (error) {
      const attempts = error.response?.data?.attemptsRemaining
      if (attempts !== undefined) {
        setAttemptsRemaining(attempts)
        if (attempts <= 0) {
          toast.error('Máximo de intentos alcanzado. La solicitud ha sido cancelada.')
          onClose()
          return
        }
      }
      toast.error(error.response?.data?.message || 'Código inválido')
    } finally {
      setVerifying(false)
    }
  }
  
  const handleCompleteRegistration = async () => {
    if (!password || !confirmPassword) {
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
    
    setRegistering(true)
    try {
      const { data } = await api.post('/auth/complete-registration', {
        email,
        accessCode: accessCode.toUpperCase(),
        password,
        confirmPassword
      })
      
      // Show loading animation
      toast.loading('Estamos trabajando en tu nueva membresía, nos tardamos menos de lo que pega un press...', {
        duration: 5000
      })
      
      // Simulate processing (max 5 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Store token and user
      localStorage.setItem('token', data.token)
      
      toast.success('¡Bienvenido a Altus Gym! Tu membresía está lista.', {
        duration: 4000
      })
      
      onSuccess()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al completar registro')
    } finally {
      setRegistering(false)
    }
  }
  
  const handleClose = () => {
    setStep(1)
    setEmail('')
    setAccessCode('')
    setPassword('')
    setConfirmPassword('')
    setCodeValid(false)
    setAttemptsRemaining(3)
    onClose()
  }
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="card max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl flex items-center gap-2">
                <FiKey className="text-primary-500" />
                Código de Acceso
              </h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-dark-200 rounded-lg"
              >
                <FiX size={24} />
              </button>
            </div>
            
            {step === 1 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Correo Electrónico</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field pl-10 w-full"
                      placeholder="tu@email.com"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Código de Acceso</label>
                  <div className="relative">
                    <FiKey className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                      className="input-field pl-10 w-full uppercase"
                      placeholder="XXXX"
                      maxLength={8}
                    />
                  </div>
                  {attemptsRemaining < 3 && (
                    <p className="text-xs text-yellow-500 mt-1">
                      Intentos restantes: {attemptsRemaining}
                    </p>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleVerifyCode}
                    disabled={verifying || !email.trim() || !accessCode.trim()}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {verifying ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiCheck size={18} />
                        Verificar
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FiCheck size={32} className="text-primary-500" />
                  </div>
                  <p className="text-gray-400 text-sm">
                    Código verificado. Ahora crea tu contraseña para completar el registro.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Contraseña</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pl-10 w-full"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Confirmar Contraseña</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field pl-10 w-full"
                      placeholder="Repite tu contraseña"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setStep(1)
                      setPassword('')
                      setConfirmPassword('')
                    }}
                    className="btn-secondary flex-1"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={handleCompleteRegistration}
                    disabled={registering || !password || !confirmPassword}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {registering ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiCheck size={18} />
                        Completar Registro
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

