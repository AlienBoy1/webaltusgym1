import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiArrowRight, FiCheck, FiX } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import api from '../utils/api'

const slides = [
  {
    title: '¡Bienvenido a ALTUS!',
    description: 'Tu compañero de entrenamiento que te ayudará a alcanzar tus metas.',
    emoji: '💪',
    color: 'primary'
  },
  {
    title: 'Registra tus Entrenos',
    description: 'Lleva un control de tus rutinas, pesos y repeticiones.',
    emoji: '📊',
    color: 'cyan'
  },
  {
    title: 'Conecta con la Comunidad',
    description: 'Comparte tu progreso y motívate con otros atletas.',
    emoji: '👥',
    color: 'purple'
  },
  {
    title: 'Logra tus Metas',
    description: 'Establece objetivos y celebra cada logro.',
    emoji: '🏆',
    color: 'yellow'
  }
]

export default function Onboarding({ onComplete }) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const { updateUser } = useAuthStore()
  
  const next = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1)
    } else {
      completeOnboarding()
    }
  }
  
  const skip = () => {
    completeOnboarding()
  }
  
  const completeOnboarding = async () => {
    try {
      await api.post('/users/complete-onboarding')
      updateUser({ onboardingCompleted: true })
      onComplete?.()
    } catch (error) {
      console.error('Error completing onboarding:', error)
      onComplete?.()
    }
  }
  
  const slide = slides[currentSlide]
  
  return (
    <div className="fixed inset-0 bg-dark-500 z-50 flex items-center justify-center p-4">
      {/* Skip button */}
      <button
        onClick={skip}
        className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white"
      >
        <FiX size={24} />
      </button>
      
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="text-center"
          >
            {/* Emoji */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center text-6xl mb-8 ${
                slide.color === 'primary' ? 'bg-primary-500/20' :
                slide.color === 'cyan' ? 'bg-accent-cyan/20' :
                slide.color === 'purple' ? 'bg-accent-purple/20' :
                'bg-accent-yellow/20'
              }`}
            >
              {slide.emoji}
            </motion.div>
            
            {/* Content */}
            <h1 className="font-display text-3xl mb-4">{slide.title}</h1>
            <p className="text-gray-400 text-lg mb-12">{slide.description}</p>
          </motion.div>
        </AnimatePresence>
        
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentSlide 
                  ? 'w-8 bg-primary-500' 
                  : i < currentSlide 
                  ? 'bg-primary-500/50' 
                  : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
        
        {/* Button */}
        <button
          onClick={next}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {currentSlide === slides.length - 1 ? (
            <>
              <FiCheck /> Comenzar
            </>
          ) : (
            <>
              Siguiente <FiArrowRight />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

